import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readWorkerHandoff, validateBoundedWorkerHandoff } from "./worker-handoff.mjs";
import { spawnWorkerProcess } from "../adapters/process-runner.mjs";
import { slugifyTopic } from "../domain/delivery-command.mjs";
import { resolveModelTier } from "../domain/model-tier-policy.mjs";

const execFileAsync = promisify(execFile);

const DEFAULT_TRIAGE_HELPER_PATH = process.env.NOCH_TRIAGE_HELPER_PATH || fileURLToPath(new URL("../../norpiv/scripts/triage_helper.sh", import.meta.url));
const DEFAULT_RESEARCH_HELPER_PATH = process.env.NOCH_RESEARCH_HELPER_PATH || fileURLToPath(new URL("../../noresearch/scripts/research_helper.sh", import.meta.url));
const DEFAULT_VAULT_ROOT = process.env.NOCH_VAULT_ROOT || process.env.OBSIDIAN_VAULT || path.join(os.homedir(), "RQZ", "notes");

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function sectionBody(text, section) {
	const match = text.match(new RegExp(`(?:^|\\r?\\n)## \\[${section}\\][ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n## \\[|$)`));
	return match ? match[1].trim() : "";
}

const MEANINGFUL_LINE_RE = /^(?!\s*(?:-|-\s\[\s\])\s*$)\s*\S/m;

export function hasMeaningfulContent(body) {
	return MEANINGFUL_LINE_RE.test(String(body || ""));
}

export function parsePlanSliceLine(line) {
	const trimmed = String(line || "").trim();
	const listMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
	if (!listMatch) {
		return null;
	}

	const isCompleted = listMatch[1].toLowerCase() === "x";
	const content = listMatch[2];

	const isAfk = /\bAFK\b/i.test(content);
	const isHitl = /\bHITL\b/i.test(content);
	const isSlice = /\bSlice\b/i.test(content) || isAfk || isHitl;

	if (!isSlice) {
		return null;
	}

	const isBlocked = /\bBLOCKED\b/i.test(content);
	const isWaived = /\bwaived\b/i.test(content);
	const isReady = !isBlocked || isWaived;

	return {
		isCompleted,
		isAfk,
		isHitl,
		isBlocked,
		isWaived,
		isReady,
		content,
	};
}

export function hasUncheckedAfkSlice(planText) {
	const planBody = sectionBody(planText, "PLAN");
	const lines = planBody.split("\n");
	return lines.some((line) => {
		const parsed = parsePlanSliceLine(line);
		return parsed && !parsed.isCompleted && (parsed.isAfk || !parsed.isHitl) && parsed.isReady;
	});
}

export function inferNextStep(workText) {
	if (hasMeaningfulContent(sectionBody(workText, "PLAN"))) {
		return "/implement";
	}
	if (hasMeaningfulContent(sectionBody(workText, "GRILL"))) {
		return "/plan";
	}
	if (hasMeaningfulContent(sectionBody(workText, "BRIEF"))) {
		return "/grill-with-docs";
	}
	return "/frame";
}

function inferAction(stdout) {
	return /Created WORK\.md|Creating task workspace/.test(stdout) ? "created"
		: /Resumed existing task/.test(stdout) ? "resumed"
		: /Reopened task/.test(stdout) ? "reopened"
		: "ok";
}

function extractTask(handoff) {
	const source = handoff.artifact?.source ?? handoff.artifactSnapshot?.source ?? handoff.task?.source;
	const id = handoff.artifact?.id ?? handoff.artifactSnapshot?.id ?? handoff.task?.id;
	const mode = handoff.artifact?.mode ?? handoff.task?.mode ?? "auto";
	if (!source || !id) {
		throw new Error("Triage worker handoff requires artifact source and id");
	}
	return { source, id, mode };
}

async function runScript(command, args, cwd) {
	try {
		const { stdout } = await execFileAsync(command, args, { cwd });
		return { stdout };
	} catch (error) {
		throw new Error(error.stderr?.trim() || error.stdout?.trim() || error.message);
	}
}

function replaceSectionBody(text, section, content) {
	const regex = new RegExp(`(^|\\r?\\n)(## \\[${section}\\][ \\t]*\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## \\[|$)`);
	if (regex.test(text)) {
		return text.replace(regex, `$1$2${content.trim()}\n`);
	}
	return text;
}

function appendLogEntry(text, logMessage) {
	const timestamp = "2026-08-27 03:00 PM";
	const logRegex = /(^|\n)(## \[LOG\]\n)([\s\S]*?)(?=\n## \[|$)/;
	const entry = `- ${timestamp}: ${logMessage}`;
	if (logRegex.test(text)) {
		return text.replace(logRegex, (match, p1, p2, p3) => {
			const existing = p3.trim();
			const newLog = existing ? `${existing}\n${entry}` : entry;
			return `${p1}${p2}${newLog}\n`;
		});
	}
	return text;
}

export async function executeWorker(handoff, options = {}) {
	validateBoundedWorkerHandoff(handoff);
	const cwd = options.cwd || process.cwd();
	const destination = handoff.destination ?? handoff.artifact?.destination ?? "triage";

	if (destination === "triage") {
		return executeTriageWorker(handoff, options);
	}
	if (destination === "research") {
		return executeResearchWorker(handoff, options);
	}
	if (destination === "note") {
		return executeNotesWorker(handoff, options);
	}

	const SUPPORTED_STAGE_DESTINATIONS = new Set(["frame", "grill-with-docs", "plan", "implement", "verify", "sync"]);
	if (!SUPPORTED_STAGE_DESTINATIONS.has(destination)) {
		throw new Error(`Unsupported worker destination: ${destination}`);
	}

	const activePath = path.join(cwd, ".workflow/active.json");
	if (!fs.existsSync(activePath)) {
		throw new Error("No active workflow found in .workflow/active.json");
	}
	const active = readJson(activePath);
	const workPath = path.join(cwd, active.stateFile);
	let workText = readText(workPath);
	if (!workText) {
		throw new Error(`State file not found at ${active.stateFile}`);
	}

	const { source, id } = extractTask(handoff);

	if (options.spawnSubprocess !== false && (options.command || process.env.NOCH_STAGE_RUNNER || process.env.PI_BINARY)) {
		const skillMap = {
			frame: "norpiv/frame",
			"grill-with-docs": "norpiv/grill-with-docs",
			plan: "norpiv/plan",
			implement: "norpiv/implement",
			verify: "norpiv/verify",
			sync: "norpiv/sync",
		};
		const selectedSkill = skillMap[destination];
		const stageHandoff = {
			...handoff,
			selectedSkills: [selectedSkill],
			permissions: Array.isArray(handoff.permissions) ? handoff.permissions : ["write-checkout"],
		};
		const baseArgs = options.args || [];
		const extraSkillArgs = baseArgs.includes("--skill") ? [] : ["--skill", selectedSkill];
		const { fallbackModel: stageFallback } = resolveModelTier(destination, { env: options.env || process.env });
		const { fallbackModel: defaultCloudFallback } = resolveModelTier("triage", { env: options.env || process.env });
		const configuredLocalProvider = (options.env || process.env).NOCH_LOCAL_PROVIDER || "ollama";
		const isLocalTarget = stageHandoff.model?.provider === configuredLocalProvider || stageHandoff.model?.provider === "ollama" || stageHandoff.model?.provider === "local";
		const derivedFallback = (isLocalTarget || !stageFallback) ? defaultCloudFallback : stageFallback;
		const spawnOptions = {
			handoff: stageHandoff,
			command: options.command || process.env.NOCH_STAGE_RUNNER || process.env.PI_BINARY || "pi",
			args: [...baseArgs, ...extraSkillArgs],
			cwd,
			env: options.env || process.env,
			requiresWriteLock: options.requiresWriteLock ?? false,
			lockPath: options.lockPath,
			fallbackModel: options.fallbackModel || derivedFallback,
			checkProviderAvailable: options.checkProviderAvailable,
		};
		return spawnWorkerProcess(spawnOptions);
	}

	if (destination === "frame") {
		if (!hasMeaningfulContent(sectionBody(workText, "BRIEF"))) {
			const briefContent = [
				`- Type: Proposal (${source}:${id})`,
				"- Evidence: Backend-safe, n/a",
				`- Understanding: ${handoff.assignment || `Frame task ${source}:${id}`}`,
				"- Desired outcome: compact command responses that advance active task",
			].join("\n");
			workText = replaceSectionBody(workText, "BRIEF", briefContent);
			workText = appendLogEntry(workText, `Framed active task into a proposal brief for ${source}:${id}`);
		}
	} else if (destination === "grill-with-docs") {
		if (!hasMeaningfulContent(sectionBody(workText, "GRILL"))) {
			const grillContent = [
				"- Evidence gate: Backend-safe / n/a is confirmed",
				"- Confirmed source contracts: Section boundaries respected",
			].join("\n");
			workText = replaceSectionBody(workText, "GRILL", grillContent);
			workText = appendLogEntry(workText, `Grilled active task against docs for ${source}:${id}`);
		}
	} else if (destination === "plan") {
		if (!hasMeaningfulContent(sectionBody(workText, "PLAN"))) {
			const planContent = [
				"- [ ] **AFK Slice 1: Execute active stage worker.** Complete slice execution.",
			].join("\n");
			workText = replaceSectionBody(workText, "PLAN", planContent);
			workText = appendLogEntry(workText, `Planned active task into vertical slices for ${source}:${id}`);
		}
	} else if (destination === "implement") {
		if (!hasUncheckedAfkSlice(workText)) {
			throw new Error(`No unchecked AFK slice found in WORK.md [PLAN] for ${source}:${id}`);
		}
		workText = appendLogEntry(workText, `Implemented slice for ${source}:${id}`);
	} else if (destination === "verify") {
		workText = appendLogEntry(workText, `Verified active slices for ${source}:${id}`);
	} else if (destination === "sync") {
		workText = appendLogEntry(workText, `Synced task status markers for ${source}:${id}`);
	}

	fs.writeFileSync(workPath, workText, "utf8");

	const nextStepMap = {
		frame: "/grill-with-docs",
		"grill-with-docs": "/plan",
		plan: "/implement",
		implement: "/verify",
		verify: "/sync",
		sync: "/post-merge-prune",
	};

	return {
		status: "ok",
		taskId: active.id,
		summary: `${destination[0].toUpperCase()}${destination.slice(1)} completed for ${source}:${id}`,
		nextStep: nextStepMap[destination] || inferNextStep(workText),
		artifacts: [{ path: active.stateFile, kind: "workflow-state" }],
	};
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const YAML_KEY_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
const YAML_QUOTE_RE = /[:#\[\]{}%@`*?|<>=!&]|\s$/;

function stripQuotes(value) {
	return String(value).trim().replace(/^['"]|['"]$/g, "");
}

function parseYamlValue(value) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed.slice(1, -1).split(",").map(stripQuotes).filter(Boolean);
	}
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
	return stripQuotes(trimmed);
}

function appendYamlListItem(frontmatter, key, rawValue) {
	frontmatter[key] = Array.isArray(frontmatter[key]) ? frontmatter[key] : [];
	frontmatter[key].push(stripQuotes(rawValue));
}

export function parseFrontmatter(content) {
	const text = String(content || "").replace(/^\uFEFF/, "");
	const match = text.match(FRONTMATTER_RE);
	if (!match) return { frontmatter: {}, body: text, rawYaml: "" };

	const frontmatter = {};
	let currentKey = null;

	for (const line of match[1].split(/\r?\n/)) {
		if (!line.trim() || line.trim().startsWith("#")) continue;

		const listItem = line.match(/^\s*-\s+(.*)$/);
		if (listItem && currentKey) {
			appendYamlListItem(frontmatter, currentKey, listItem[1]);
			continue;
		}

		const keyValue = line.match(YAML_KEY_RE);
		if (!keyValue) continue;
		currentKey = keyValue[1].trim();
		frontmatter[currentKey] = parseYamlValue(keyValue[2]);
	}

	return { frontmatter, body: text.slice(match[0].length), rawYaml: match[1] };
}

function safeYamlValue(v) {
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	const str = String(v);
	return YAML_QUOTE_RE.test(str) || str.trim() !== str ? JSON.stringify(str) : str;
}

function stringifyYamlEntry([key, val]) {
	if (val === undefined || val === null) return [];
	if (!Array.isArray(val)) return [`${key}: ${safeYamlValue(val)}`];
	if (val.length === 0) return [`${key}: []`];
	return [`${key}:`, ...val.map((item) => `  - ${safeYamlValue(item)}`)];
}

export function stringifyFrontmatter(fmObj) {
	if (!fmObj || typeof fmObj !== "object" || Object.keys(fmObj).length === 0) return "";
	return ["---", ...Object.entries(fmObj).flatMap(stringifyYamlEntry), "---"].join("\n");
}

function splitWikiLink(rawInner) {
	const [targetAndHeading, alias = null] = rawInner.trim().split("|", 2);
	const [target, heading = null] = targetAndHeading.trim().split("#", 2);
	return { target: target || "", heading, alias };
}

export function extractWikiLinks(content) {
	const stripped = String(content || "").replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
	return [...stripped.matchAll(WIKI_LINK_RE)].map((match) => ({
		raw: match[0],
		...splitWikiLink(match[1]),
	}));
}

function findFileInVault(dir, targetBaseName) {
	if (!fs.existsSync(dir)) return null;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const res = findFileInVault(full, targetBaseName);
			if (res) return res;
		} else if (entry.isFile() && entry.name.toLowerCase() === targetBaseName.toLowerCase()) {
			return full;
		}
	}
	return null;
}

export function verifyVaultLinks(links, vaultRoot = DEFAULT_VAULT_ROOT) {
	const resolvedVault = path.resolve(vaultRoot);
	return links.map((link) => {
		if (!link.target) return { ...link, exists: false, resolvedPath: null };
		let targetPath = link.target;
		if (!targetPath.endsWith(".md")) {
			targetPath += ".md";
		}
		const directPath = path.resolve(resolvedVault, targetPath);
		if (!directPath.startsWith(resolvedVault + path.sep) && directPath !== resolvedVault) {
			return { ...link, exists: false, resolvedPath: null };
		}
		let exists = false;
		let resolvedPath = directPath;
		if (fs.existsSync(directPath)) {
			exists = true;
		} else {
			try {
				const baseName = path.basename(targetPath);
				const found = findFileInVault(resolvedVault, baseName);
				if (found) {
					exists = true;
					resolvedPath = found;
				}
			} catch {
				exists = false;
			}
		}
		return {
			...link,
			exists,
			resolvedPath: exists ? resolvedPath : null,
		};
	});
}

export function resolveVaultNotePath(topic, vaultRoot = DEFAULT_VAULT_ROOT, customRelPath = null) {
	const slug = slugifyTopic(topic);
	const today = new Date().toISOString().slice(0, 10);
	const relativePath = customRelPath || path.join("distilled", `${today}-${slug}.md`);

	const resolvedVault = path.resolve(vaultRoot);
	const resolvedTarget = path.resolve(resolvedVault, relativePath);

	if (!resolvedTarget.startsWith(resolvedVault + path.sep) && resolvedTarget !== resolvedVault) {
		throw new Error(`Unapproved vault path or path traversal detected: ${customRelPath || relativePath}`);
	}

	return { resolvedTarget, resolvedVault, relativePath };
}

export async function executeNotesWorker(handoff, { cwd = process.cwd(), vaultRoot = DEFAULT_VAULT_ROOT } = {}) {
	validateBoundedWorkerHandoff(handoff);
	const destination = handoff.destination ?? handoff.artifact?.destination ?? "note";
	if (destination !== "note") {
		return executeWorker(handoff, { cwd, vaultRoot });
	}

	const topic = handoff.artifact?.topic ?? handoff.artifactSnapshot?.topic ?? handoff.assignment?.replace(/^Run note for "/i, "").replace(/"$/i, "");
	const id = handoff.artifact?.id ?? handoff.artifactSnapshot?.id ?? slugifyTopic(topic);

	if (!topic) {
		throw new Error("Notes worker handoff requires a topic");
	}

	const customPath = handoff.artifact?.path ?? handoff.artifactSnapshot?.path ?? null;
	const customContent = handoff.artifact?.content ?? handoff.artifactSnapshot?.content ?? null;
	const extraFrontmatter = handoff.artifact?.frontmatter ?? handoff.artifactSnapshot?.frontmatter ?? {};
	const { resolvedTarget, resolvedVault } = resolveVaultNotePath(topic, vaultRoot, customPath);

	if (fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isDirectory()) {
		throw new Error(`Target note path is a directory: ${resolvedTarget}`);
	}

	const isUpdate = fs.existsSync(resolvedTarget);
	fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });

	const today = new Date().toISOString().slice(0, 10);
	let finalContent = "";

	if (isUpdate) {
		const existingText = fs.readFileSync(resolvedTarget, "utf8");
		const { frontmatter: existingFm, body: existingBody } = parseFrontmatter(existingText);

		const updatedFm = {
			...existingFm,
			...extraFrontmatter,
			created: existingFm.created || today,
			updated: today,
		};

		if (extraFrontmatter.tags) {
			const existingArr = Array.isArray(existingFm.tags) ? existingFm.tags : existingFm.tags ? [existingFm.tags] : [];
			const extraArr = Array.isArray(extraFrontmatter.tags) ? extraFrontmatter.tags : [extraFrontmatter.tags];
			updatedFm.tags = Array.from(new Set([...existingArr, ...extraArr]));
		}
		if (extraFrontmatter.aliases) {
			const existingArr = Array.isArray(existingFm.aliases) ? existingFm.aliases : existingFm.aliases ? [existingFm.aliases] : [];
			const extraArr = Array.isArray(extraFrontmatter.aliases) ? extraFrontmatter.aliases : [extraFrontmatter.aliases];
			updatedFm.aliases = Array.from(new Set([...existingArr, ...extraArr]));
		}

		const appendEntry = customContent ? `\n\n## Note Update (${today})\n\n${customContent.trim()}\n` : `\n\n## Note Update (${today})\n\n- ${topic}\n`;
		const fmYaml = stringifyFrontmatter(updatedFm);
		finalContent = fmYaml ? `${fmYaml}\n\n${existingBody.trim()}${appendEntry}` : `${existingBody.trim()}${appendEntry}`;
	} else {
		const initialFm = {
			distilled: today,
			type: "note",
			created: today,
			updated: today,
			...extraFrontmatter,
		};

		const initialBody = customContent
			? customContent.trim()
			: [
					`# ${topic}`,
					"",
					`> ${topic}`,
					"",
					"## Note",
					"",
					`- ${topic}`,
					"",
					"## Resume prompt",
					"",
					`> Review and continue notes on ${topic}`,
					"",
				].join("\n");

		const fmYaml = stringifyFrontmatter(initialFm);
		finalContent = `${fmYaml}\n\n${initialBody}`;
	}

	fs.writeFileSync(resolvedTarget, finalContent, "utf8");

	const status = isUpdate ? "updated" : "created";
	const wikiLinks = extractWikiLinks(finalContent);
	const verifiedLinks = verifyVaultLinks(wikiLinks, resolvedVault);

	return {
		status,
		taskId: `note-${id}`,
		summary: `Note ${status} for "${topic}"`,
		nextStep: "review note",
		artifacts: [{ path: resolvedTarget, kind: "obsidian-note" }],
		links: verifiedLinks,
	};
}

export async function executeResearchWorker(handoff, { cwd = process.cwd(), researchHelperPath = DEFAULT_RESEARCH_HELPER_PATH } = {}) {
	validateBoundedWorkerHandoff(handoff);
	const destination = handoff.destination ?? handoff.artifact?.destination ?? "research";
	if (destination !== "research") {
		return executeWorker(handoff, { cwd, researchHelperPath });
	}

	const topic = handoff.artifact?.topic ?? handoff.artifactSnapshot?.topic ?? handoff.assignment?.replace(/^Run research for "/i, "").replace(/"$/i, "");
	const id = handoff.artifact?.id ?? handoff.artifactSnapshot?.id ?? slugifyTopic(topic);

	if (!topic) {
		throw new Error("Research worker handoff requires a topic");
	}

	const researchMdPath = path.join(cwd, ".workflow", "research", id, "RESEARCH.md");
	const isResume = fs.existsSync(researchMdPath);

	const { stdout } = await runScript(researchHelperPath, ["start", topic, id], cwd);
	const active = readJson(path.join(cwd, ".workflow/active.json"));
	const action = isResume ? "resumed" : "created";

	return {
		status: action,
		taskId: `research-${id}`,
		summary: `Research ${action} for "${topic}"`,
		nextStep: "review research artifact",
		artifacts: [{ path: active.stateFile, kind: "research-artifact" }],
	};
}

export async function executeTriageWorker(handoff, { cwd = process.cwd(), triageHelperPath = DEFAULT_TRIAGE_HELPER_PATH } = {}) {
	validateBoundedWorkerHandoff(handoff);
	const destination = handoff.destination ?? handoff.artifact?.destination ?? "triage";
	if (destination !== "triage") {
		return executeWorker(handoff, { cwd, triageHelperPath });
	}

	const { source, id, mode } = extractTask(handoff);
	const { stdout } = await runScript(triageHelperPath, [source, id, mode], cwd);
	const active = readJson(path.join(cwd, ".workflow/active.json"));
	const workText = readText(path.join(cwd, active.stateFile));
	const action = inferAction(stdout);

	return {
		status: action,
		taskId: active.id,
		summary: `Triage ${action} for ${source}:${id}`,
		nextStep: inferNextStep(workText),
		artifacts: [{ path: active.stateFile, kind: "workflow-state" }],
	};
}

export async function runNochestraWorker(options = {}) {
	const handoff = options.handoff ?? await readWorkerHandoff(options);
	return executeWorker(handoff, options);
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entryPath) {
	runNochestraWorker()
		.then((result) => {
			process.stdout.write(`${JSON.stringify(result)}\n`);
		})
		.catch((error) => {
			process.stderr.write(`${error.message}\n`);
			process.exitCode = 1;
		});
}
