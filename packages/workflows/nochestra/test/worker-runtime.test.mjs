import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { executeTriageWorker, executeWorker, hasMeaningfulContent, inferNextStep } from "../application/worker-runtime.mjs";

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
			destination: "implement",
		}),
		/Unsupported worker destination: implement/,
	);
});
