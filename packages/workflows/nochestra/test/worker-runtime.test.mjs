import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { executeNotesWorker, executeResearchWorker, executeTriageWorker, executeWorker, extractWikiLinks, hasMeaningfulContent, hasUncheckedAfkSlice, inferNextStep, parseFrontmatter, parsePlanSliceLine, resolveVaultNotePath, stringifyFrontmatter, verifyVaultLinks } from "../application/worker-runtime.mjs";

const TRIAGE_HELPER_PATH = path.join(process.cwd(), "packages/workflows/norpiv/scripts/triage_helper.sh");
const RESEARCH_HELPER_PATH = path.join(process.cwd(), "packages/workflows/noresearch/scripts/research_helper.sh");
const WORKER_RUNTIME_PATH = path.join(process.cwd(), "packages/workflows/nochestra/application/worker-runtime.mjs");

function makeRepo() {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-worker-runtime-"));
	spawnSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.name", "Nochestra Test"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.email", "nochestra@example.com"], { cwd: repoDir, stdio: "ignore" });
	fs.writeFileSync(path.join(repoDir, ".gitignore"), "node_modules\n", "utf8");
	spawnSync("git", ["add", ".gitignore"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["commit", "-m", "init"], { cwd: repoDir, stdio: "ignore" });
	return repoDir;
}

function handoffFor(id) {
	return {
		assignment: `Triage local:${id}`,
		destination: "triage",
		artifact: { source: "local", id },
		acceptedDecisions: ["Use bounded handoff only"],
		constraints: ["No parent transcript"],
		openQuestions: [],
		selectedSkills: ["triage"],
		permissions: ["write-checkout"],
		contextBudget: { maxTokens: 4000 },
		expectedResultShape: { required: ["status", "taskId", "summary", "nextStep"] },
	};
}

test("parsePlanSliceLine accurately categorizes slice completion, AFK/HITL, BLOCKED, and waived states", () => {
	assert.deepEqual(parsePlanSliceLine("- [ ] **AFK Slice 1: Feature**"), {
		isCompleted: false,
		isAfk: true,
		isHitl: false,
		isBlocked: false,
		isWaived: false,
		isReady: true,
		content: "**AFK Slice 1: Feature**",
	});

	assert.deepEqual(parsePlanSliceLine("- [x] **AFK Slice 1: Feature**"), {
		isCompleted: true,
		isAfk: true,
		isHitl: false,
		isBlocked: false,
		isWaived: false,
		isReady: true,
		content: "**AFK Slice 1: Feature**",
	});

	assert.deepEqual(parsePlanSliceLine("- [ ] **AFK Slice 2 [BLOCKED: missing UI evidence]**"), {
		isCompleted: false,
		isAfk: true,
		isHitl: false,
		isBlocked: true,
		isWaived: false,
		isReady: false,
		content: "**AFK Slice 2 [BLOCKED: missing UI evidence]**",
	});

	assert.deepEqual(parsePlanSliceLine("- [ ] **AFK Slice 2 [BLOCKED: missing UI evidence] (waived: human override)**"), {
		isCompleted: false,
		isAfk: true,
		isHitl: false,
		isBlocked: true,
		isWaived: true,
		isReady: true,
		content: "**AFK Slice 2 [BLOCKED: missing UI evidence] (waived: human override)**",
	});

	assert.equal(parsePlanSliceLine("- Dependencies: None"), null);
});

test("hasUncheckedAfkSlice validates unchecked AFK slices and ignores blocked or completed slices", () => {
	assert.equal(hasUncheckedAfkSlice("## [PLAN]\n- [ ] **AFK Slice 1: Implement worker**"), true);
	assert.equal(hasUncheckedAfkSlice("## [PLAN]\n- [x] **AFK Slice 1: Implement worker**"), false);
	assert.equal(hasUncheckedAfkSlice("## [PLAN]\n- [ ] **AFK Slice 1 [BLOCKED: missing UI evidence]**"), false);
	assert.equal(hasUncheckedAfkSlice("## [PLAN]\n- [ ] **AFK Slice 1 [BLOCKED: missing UI evidence] (waived: human override)**"), true);
	assert.equal(hasUncheckedAfkSlice("## [PLAN]\n- [x] **AFK Slice 1**\n- [ ] **AFK Slice 2 [BLOCKED: missing formula]**"), false);
	assert.equal(hasUncheckedAfkSlice("## [PLAN]\n- [x] **AFK Slice 1**\n- [ ] **AFK Slice 2: Valid slice**"), true);
});

test("hasMeaningfulContent ignores empty and placeholder-only lines", () => {
	const cases = [
		["", false],
		["   \n\t", false],
		["-", false],
		["- [ ]", false],
		["- [ ]\n", false],
		["- [x] done", true],
		["text", true],
		["  text  ", true],
		["\n- [ ]\nreal", true],
	];

	for (const [body, expected] of cases) {
		assert.equal(hasMeaningfulContent(body), expected, JSON.stringify(body));
	}
});

test("inferNextStep prefers PLAN, then GRILL, then BRIEF, then frame", () => {
	assert.equal(inferNextStep("## [PLAN]\nready\n"), "/implement");
	assert.equal(inferNextStep("## [PLAN]\n- [ ]\n## [GRILL]\nreview\n"), "/plan");
	assert.equal(inferNextStep("## [PLAN]\n- [ ]\n## [GRILL]\n- [ ]\n## [BRIEF]\nfocus\n"), "/grill-with-docs");
	assert.equal(inferNextStep("## [PLAN]\n- [ ]\n## [GRILL]\n- [ ]\n## [BRIEF]\n- [ ]\n"), "/frame");
});

test("executeTriageWorker routes triage handoff through RPIV helper and returns compact result", async () => {
	const repoDir = makeRepo();
	const id = `worker-${Date.now()}`;

	try {
		const result = await executeTriageWorker(handoffFor(id), {
			cwd: repoDir,
			triageHelperPath: TRIAGE_HELPER_PATH,
		});

		assert.deepEqual(result, {
			status: "created",
			taskId: `local-${id}`,
			summary: `Triage created for local:${id}`,
			nextStep: "/frame",
			artifacts: [{ path: `.workflow/tasks/local-${id}/WORK.md`, kind: "workflow-state" }],
		});
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("worker runtime CLI reads --handoff file and prints compact JSON only", () => {
	const repoDir = makeRepo();
	const id = `cli-${Date.now()}`;
	const handoffPath = path.join(repoDir, "handoff.json");
	fs.writeFileSync(handoffPath, JSON.stringify(handoffFor(id)), "utf8");

	try {
		const result = spawnSync(process.execPath, [WORKER_RUNTIME_PATH, "--handoff", handoffPath], {
			cwd: repoDir,
			env: { ...process.env, NOCH_TRIAGE_HELPER_PATH: TRIAGE_HELPER_PATH },
			encoding: "utf8",
		});

		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stderr, "");
		assert.deepEqual(JSON.parse(result.stdout), {
			status: "created",
			taskId: `local-${id}`,
			summary: `Triage created for local:${id}`,
			nextStep: "/frame",
			artifacts: [{ path: `.workflow/tasks/local-${id}/WORK.md`, kind: "workflow-state" }],
		});
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("executeWorker handles active RPIV frame, grill-with-docs, and plan stages", async () => {
	const repoDir = makeRepo();
	const id = `seq-${Date.now()}`;

	try {
		// 1. Triage
		const triageResult = await executeWorker(handoffFor(id), { cwd: repoDir, triageHelperPath: TRIAGE_HELPER_PATH });
		assert.equal(triageResult.status, "created");
		assert.equal(triageResult.nextStep, "/frame");

		// 2. Frame
		const frameHandoff = { ...handoffFor(id), destination: "frame", selectedSkills: ["frame"] };
		const frameResult = await executeWorker(frameHandoff, { cwd: repoDir });
		assert.equal(frameResult.status, "ok");
		assert.equal(frameResult.nextStep, "/grill-with-docs");

		// Verify allowed section write for frame: [BRIEF] and [LOG] modified
		const workTextFrame = fs.readFileSync(path.join(repoDir, `.workflow/tasks/local-${id}/WORK.md`), "utf8");
		assert.match(workTextFrame, /## \[BRIEF\]\n- Type: Proposal/);
		assert.match(workTextFrame, /## \[GRILL\]\n- /);
		assert.match(workTextFrame, /## \[PLAN\]\n- \[ \]/);

		// 3. Grill
		const grillHandoff = { ...handoffFor(id), destination: "grill-with-docs", selectedSkills: ["grill-with-docs"] };
		const grillResult = await executeWorker(grillHandoff, { cwd: repoDir });
		assert.equal(grillResult.status, "ok");
		assert.equal(grillResult.nextStep, "/plan");

		// Verify allowed section write for grill: [GRILL] and [LOG] modified
		const workTextGrill = fs.readFileSync(path.join(repoDir, `.workflow/tasks/local-${id}/WORK.md`), "utf8");
		assert.match(workTextGrill, /## \[GRILL\]\n- Evidence gate/);

		// 4. Plan
		const planHandoff = { ...handoffFor(id), destination: "plan", selectedSkills: ["plan"] };
		const planResult = await executeWorker(planHandoff, { cwd: repoDir });
		assert.equal(planResult.status, "ok");
		assert.equal(planResult.nextStep, "/implement");

		// Verify allowed section write for plan: [PLAN] and [LOG] modified
		const workTextPlan = fs.readFileSync(path.join(repoDir, `.workflow/tasks/local-${id}/WORK.md`), "utf8");
		assert.match(workTextPlan, /## \[PLAN\]\n- \[ \] \*\*AFK Slice 1/);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("executeWorker rejects when target note path is an existing directory", async () => {
	const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-dir-vault-"));
	const dirPath = path.join(vaultDir, "distilled", "conflict.md");
	fs.mkdirSync(dirPath, { recursive: true });

	const noteHandoff = {
		assignment: 'Run note for "conflict"',
		destination: "note",
		artifact: { source: "note", id: "conflict", topic: "conflict", path: "distilled/conflict.md" },
		contextBudget: { maxTokens: 4000 },
	};

	try {
		await assert.rejects(
			() => executeWorker(noteHandoff, { vaultRoot: vaultDir }),
			/Target note path is a directory/,
		);
	} finally {
		fs.rmSync(vaultDir, { recursive: true, force: true });
	}
});

test("resolveVaultNotePath handles nested custom vault paths, slugification, and path traversal rejection", () => {
	const vaultRoot = path.join(os.tmpdir(), "vault-test-root");

	// 1. Default distilled relative path
	const defaultRes = resolveVaultNotePath("frontend UX notes", vaultRoot);
	assert.equal(defaultRes.resolvedTarget.startsWith(path.resolve(vaultRoot)), true);
	assert.match(defaultRes.resolvedTarget, /distilled\/.*-frontend-ux-notes\.md$/);

	// 2. Custom nested relative path inside vault
	const customRes = resolveVaultNotePath("architecture", vaultRoot, "ai/architecture.md");
	assert.equal(customRes.resolvedTarget, path.resolve(vaultRoot, "ai/architecture.md"));

	// 3. Path traversal rejection
	assert.throws(
		() => resolveVaultNotePath("exploit", vaultRoot, "../../etc/passwd"),
		/Unapproved vault path or path traversal detected/,
	);
	assert.throws(
		() => resolveVaultNotePath("exploit", vaultRoot, "/tmp/outside-vault.md"),
		/Unapproved vault path or path traversal detected/,
	);
});

test("executeWorker handles active RPIV implement, verify, and sync execution stages", async () => {
	const repoDir = makeRepo();
	const id = `exec-${Date.now()}`;

	try {
		// 1. Setup triage + plan with an unchecked AFK slice
		await executeWorker(handoffFor(id), { cwd: repoDir, triageHelperPath: TRIAGE_HELPER_PATH });
		await executeWorker({ ...handoffFor(id), destination: "plan", selectedSkills: ["plan"] }, { cwd: repoDir });

		// 2. Implement unchecked slice
		const implHandoff = { ...handoffFor(id), destination: "implement", selectedSkills: ["implement"] };
		const implResult = await executeWorker(implHandoff, { cwd: repoDir });
		assert.equal(implResult.status, "ok");
		assert.equal(implResult.nextStep, "/verify");

		// Verify log entry added
		const workTextImpl = fs.readFileSync(path.join(repoDir, `.workflow/tasks/local-${id}/WORK.md`), "utf8");
		assert.match(workTextImpl, /Implemented slice for local:/);

		// 3. Verify stage
		const verifyHandoff = { ...handoffFor(id), destination: "verify", selectedSkills: ["verify"] };
		const verifyResult = await executeWorker(verifyHandoff, { cwd: repoDir });
		assert.equal(verifyResult.status, "ok");
		assert.equal(verifyResult.nextStep, "/sync");

		// 4. Sync stage
		const syncHandoff = { ...handoffFor(id), destination: "sync", selectedSkills: ["sync"] };
		const syncResult = await executeWorker(syncHandoff, { cwd: repoDir });
		assert.equal(syncResult.status, "ok");
		assert.equal(syncResult.nextStep, "/post-merge-prune");
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("executeWorker refuses implement when no unchecked AFK slice exists", async () => {
	const repoDir = makeRepo();
	const id = `no-afk-${Date.now()}`;

	try {
		// Triage only (empty PLAN section)
		await executeWorker(handoffFor(id), { cwd: repoDir, triageHelperPath: TRIAGE_HELPER_PATH });

		const implHandoff = { ...handoffFor(id), destination: "implement", selectedSkills: ["implement"] };
		await assert.rejects(
			() => executeWorker(implHandoff, { cwd: repoDir }),
			/No unchecked AFK slice found in WORK.md \[PLAN\]/,
		);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("executeWorker handles note destination creating, updating notes in vault, and rejecting unapproved path traversal", async () => {
	const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-vault-"));
	const topic = "summarize Nochestra front door UX";
	const id = "summarize-nochestra-front-door-ux";

	const noteHandoff = {
		assignment: `Run note for "${topic}"`,
		destination: "note",
		artifact: { source: "note", id, topic },
		acceptedDecisions: ["Use bounded handoff only"],
		constraints: ["No parent transcript"],
		openQuestions: [],
		selectedSkills: ["distill"],
		permissions: ["write-checkout"],
		contextBudget: { maxTokens: 4000 },
		expectedResultShape: { required: ["status", "taskId", "summary", "nextStep"] },
	};

	try {
		// 1. Create note
		const createResult = await executeWorker(noteHandoff, {
			vaultRoot: vaultDir,
		});

		assert.equal(createResult.status, "created");
		assert.equal(createResult.taskId, `note-${id}`);
		assert.equal(createResult.nextStep, "review note");
		assert.equal(createResult.artifacts[0].kind, "obsidian-note");

		const createdNotePath = createResult.artifacts[0].path;
		assert.equal(fs.existsSync(createdNotePath), true);
		assert.equal(createdNotePath.startsWith(vaultDir), true);

		// Artifact isolation check: no RPIV task workspace or Research workspace created
		assert.equal(fs.existsSync(path.join(process.cwd(), ".workflow/tasks/note-" + id)), false);
		assert.equal(fs.existsSync(path.join(process.cwd(), ".workflow/research/note-" + id)), false);

		// 2. Update existing note
		const updateResult = await executeWorker(noteHandoff, {
			vaultRoot: vaultDir,
		});

		assert.equal(updateResult.status, "updated");
		assert.equal(updateResult.taskId, `note-${id}`);
		const noteContent = fs.readFileSync(createdNotePath, "utf8");
		assert.match(noteContent, /## Note Update/);

		// 3. Path traversal rejection check
		const badPathHandoff = {
			...noteHandoff,
			artifact: { ...noteHandoff.artifact, path: "../../outside-vault.md" },
		};
		await assert.rejects(
			() => executeWorker(badPathHandoff, { vaultRoot: vaultDir }),
			/Unapproved vault path or path traversal detected/,
		);
	} finally {
		fs.rmSync(vaultDir, { recursive: true, force: true });
	}
});

test("executeWorker handles research destination creating and resuming research workspace without touching tasks", async () => {
	const repoDir = makeRepo();
	const topic = "best way to test Nochestra routing";
	const id = "best-way-to-test-nochestra-routing";

	const researchHandoff = {
		assignment: `Run research for "${topic}"`,
		destination: "research",
		artifact: { source: "research", id, topic },
		acceptedDecisions: ["Use bounded handoff only"],
		constraints: ["No parent transcript"],
		openQuestions: [],
		selectedSkills: ["research"],
		permissions: ["write-checkout"],
		contextBudget: { maxTokens: 4000 },
		expectedResultShape: { required: ["status", "taskId", "summary", "nextStep"] },
	};

	try {
		// 1. Create research
		const createResult = await executeWorker(researchHandoff, {
			cwd: repoDir,
			researchHelperPath: RESEARCH_HELPER_PATH,
		});

		assert.deepEqual(createResult, {
			status: "created",
			taskId: `research-${id}`,
			summary: `Research created for "${topic}"`,
			nextStep: "review research artifact",
			artifacts: [{ path: `.workflow/research/${id}/RESEARCH.md`, kind: "research-artifact" }],
		});

		// Verify files: .workflow/research/<id>/RESEARCH.md exists, .workflow/tasks/ does NOT exist
		assert.equal(fs.existsSync(path.join(repoDir, `.workflow/research/${id}/RESEARCH.md`)), true);
		assert.equal(fs.existsSync(path.join(repoDir, ".workflow/tasks")), false);

		// 2. Resume research
		const resumeResult = await executeWorker(researchHandoff, {
			cwd: repoDir,
			researchHelperPath: RESEARCH_HELPER_PATH,
		});

		assert.deepEqual(resumeResult, {
			status: "resumed",
			taskId: `research-${id}`,
			summary: `Research resumed for "${topic}"`,
			nextStep: "review research artifact",
			artifacts: [{ path: `.workflow/research/${id}/RESEARCH.md`, kind: "research-artifact" }],
		});
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("executeTriageWorker rejects unsupported worker destinations", async () => {
	await assert.rejects(
		() => executeTriageWorker({
			...handoffFor("bad-route"),
			destination: "publish",
		}),
		/Unsupported worker destination: publish/,
	);
});

test("executeWorker delegates stage execution to sub-process when command is supplied", async () => {
	const repoDir = makeRepo();
	const id = `subproc-${Date.now()}`;
	const scriptPath = path.join(os.tmpdir(), `test-stage-worker-${Date.now()}.cjs`);

	fs.writeFileSync(scriptPath, `
		const fs = require('fs');
		const args = process.argv.slice(2);
		const hasNoContext = args.includes('--no-context-files');
		const hasSkill = args.includes('--skill') && args[args.indexOf('--skill') + 1] === 'norpiv/frame';
		const handoffIdx = args.indexOf('--handoff');
		const handoffPath = handoffIdx !== -1 ? args[handoffIdx + 1] : null;
		const handoffData = handoffPath ? JSON.parse(fs.readFileSync(handoffPath, 'utf8')) : null;

		if (!hasNoContext || !hasSkill || !handoffData) {
			process.exit(1);
		}

		console.log(JSON.stringify({
			status: 'ok',
			taskId: '${id}',
			summary: 'Subprocess frame skill executed',
			nextStep: '/grill-with-docs'
		}));
	`, "utf8");

	try {
		await executeWorker(handoffFor(id), { cwd: repoDir, triageHelperPath: TRIAGE_HELPER_PATH });

		const frameHandoff = { ...handoffFor(id), destination: "frame" };
		const result = await executeWorker(frameHandoff, {
			cwd: repoDir,
			command: process.execPath,
			args: [scriptPath, "--skill", "norpiv/frame"],
		});

		assert.equal(result.status, "ok");
		assert.equal(result.summary, "Subprocess frame skill executed");
		assert.equal(result.nextStep, "/grill-with-docs");
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("parseFrontmatter and stringifyFrontmatter handle YAML frontmatter objects and arrays", () => {
	const sample = `---
tags:
  - obsidian
  - notes
aliases: [ai-note, distilled-note]
created: 2026-01-01
updated: 2026-01-01
---

# Title
Body text
`;

	const parsed = parseFrontmatter(sample);
	assert.deepEqual(parsed.frontmatter, {
		tags: ["obsidian", "notes"],
		aliases: ["ai-note", "distilled-note"],
		created: "2026-01-01",
		updated: "2026-01-01",
	});
	assert.equal(parsed.body.trim(), "# Title\nBody text");

	const reserialized = stringifyFrontmatter(parsed.frontmatter);
	assert.match(reserialized, /---/);
	assert.match(reserialized, /tags:/);
	assert.match(reserialized, /- obsidian/);
	assert.match(reserialized, /created: 2026-01-01/);
});

test("extractWikiLinks and verifyVaultLinks accurately extract and resolve links", () => {
	const text = "See [[Architecture Note#Section|Arch]], [[Missing Note]], and [[../../etc/passwd]].";
	const links = extractWikiLinks(text);
	assert.equal(links.length, 3);
	assert.equal(links[0].target, "Architecture Note");
	assert.equal(links[0].heading, "Section");
	assert.equal(links[0].alias, "Arch");

	assert.equal(links[1].target, "Missing Note");
	assert.equal(links[2].target, "../../etc/passwd");

	const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "vault-test-"));
	try {
		fs.writeFileSync(path.join(tempVault, "Architecture Note.md"), "# Arch", "utf8");
		fs.mkdirSync(path.join(tempVault, ".git"), { recursive: true });
		fs.writeFileSync(path.join(tempVault, ".git", "Secret.md"), "# Secret", "utf8");

		const verified = verifyVaultLinks(links, tempVault);
		assert.equal(verified[0].exists, true);
		assert.equal(verified[1].exists, false);
		assert.equal(verified[2].exists, false); // Traversal rejected

		const secretCheck = verifyVaultLinks([{ raw: "[[Secret]]", target: "Secret", heading: null, alias: null }], tempVault);
		assert.equal(secretCheck[0].exists, false); // Ignores .git folder
	} finally {
		fs.rmSync(tempVault, { recursive: true, force: true });
	}
});

test("executeNotesWorker creates and updates notes while preserving frontmatter", async () => {
	const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "vault-notes-"));
	try {
		const handoff = {
			assignment: 'Run note for "vault architecture"',
			destination: "note",
			artifact: {
				topic: "vault architecture",
				path: "ai/architecture.md",
				frontmatter: { tags: ["arch"], aliases: ["vault-arch"] },
			},
		};

		const createRes = await executeNotesWorker(handoff, { vaultRoot: tempVault });
		assert.equal(createRes.status, "created");
		assert.equal(createRes.artifacts.length, 1);

		const notePath = createRes.artifacts[0].path;
		assert.equal(fs.existsSync(notePath), true);

		const initialContent = fs.readFileSync(notePath, "utf8");
		const parsed1 = parseFrontmatter(initialContent);
		assert.deepEqual(parsed1.frontmatter.tags, ["arch"]);
		assert.equal(parsed1.frontmatter.type, "note");
		assert.ok(parsed1.frontmatter.created);

		// Now update note
		const updateHandoff = {
			assignment: 'Run note for "vault architecture"',
			destination: "note",
			artifact: {
				topic: "vault architecture",
				path: "ai/architecture.md",
				frontmatter: { tags: ["updated-tag"] },
			},
		};

		const updateRes = await executeNotesWorker(updateHandoff, { vaultRoot: tempVault });
		assert.equal(updateRes.status, "updated");

		const updatedContent = fs.readFileSync(notePath, "utf8");
		const parsed2 = parseFrontmatter(updatedContent);
		assert.ok(parsed2.frontmatter.tags.includes("arch"));
		assert.ok(parsed2.frontmatter.tags.includes("updated-tag"));
		assert.equal(parsed2.frontmatter.created, parsed1.frontmatter.created);
		assert.ok(parsed2.body.includes("Note Update"));
	} finally {
		fs.rmSync(tempVault, { recursive: true, force: true });
	}
});
