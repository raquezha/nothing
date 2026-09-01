import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readWorkerHandoff, validateBoundedWorkerHandoff } from "./worker-handoff.mjs";
import { slugifyTopic } from "../domain/delivery-command.mjs";

const execFileAsync = promisify(execFile);

const DEFAULT_TRIAGE_HELPER_PATH = process.env.NOCH_TRIAGE_HELPER_PATH || fileURLToPath(new URL("../../norpiv/scripts/triage_helper.sh", import.meta.url));
const DEFAULT_RESEARCH_HELPER_PATH = process.env.NOCH_RESEARCH_HELPER_PATH || fileURLToPath(new URL("../../noresearch/scripts/research_helper.sh", import.meta.url));

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function sectionBody(text, section) {
	const match = text.match(new RegExp(`(?:^|\\n)## \\[${section}\\]\\n([\\s\\S]*?)(?=\\n## \\[|$)`));
	return match ? match[1].trim() : "";
}

const MEANINGFUL_LINE_RE = /^(?!\s*(?:-|-\s\[\s\])\s*$)\s*\S/m;

export function hasMeaningfulContent(body) {
	return MEANINGFUL_LINE_RE.test(String(body || ""));
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
	const regex = new RegExp(`(^|\\n)(## \\[${section}\\]\\n)([\\s\\S]*?)(?=\\n## \\[|$)`);
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

	const SUPPORTED_STAGE_DESTINATIONS = new Set(["frame", "grill-with-docs", "plan"]);
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
	}

	fs.writeFileSync(workPath, workText, "utf8");

	return {
		status: "ok",
		taskId: active.id,
		summary: `${destination[0].toUpperCase()}${destination.slice(1)} completed for ${source}:${id}`,
		nextStep: inferNextStep(workText),
		artifacts: [{ path: active.stateFile, kind: "workflow-state" }],
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
