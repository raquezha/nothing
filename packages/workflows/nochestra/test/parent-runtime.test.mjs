import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { buildNochestraDeliveryHandoff, dispatchNochestraInput, formatNochestraResult, formatWriteApprovalPrompt } from "../application/parent-runtime.mjs";
import { readCheckpoint } from "../adapters/checkpoint.mjs";
import { parseNochestraInput } from "../domain/delivery-command.mjs";

const PARENT_RUNTIME_PATH = path.join(process.cwd(), "packages/workflows/nochestra/application/parent-runtime.mjs");
const CHECKPOINT_FIXTURE_PATH = path.join(process.cwd(), "packages/workflows/nochestra/test/fixtures/checkpoint.json");

function makeRepo() {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-parent-runtime-"));
	spawnSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.name", "Nochestra Test"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.email", "nochestra@example.com"], { cwd: repoDir, stdio: "ignore" });
	fs.mkdirSync(path.join(repoDir, ".workflow"), { recursive: true });
	fs.copyFileSync(CHECKPOINT_FIXTURE_PATH, path.join(repoDir, ".workflow", "nochestra-checkpoint.json"));
	fs.writeFileSync(path.join(repoDir, ".gitignore"), "node_modules\n", "utf8");
	spawnSync("git", ["add", ".gitignore"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["commit", "-m", "init"], { cwd: repoDir, stdio: "ignore" });
	return repoDir;
}

test("buildNochestraDeliveryHandoff keeps delivery state bounded and transcript-free", () => {
	const checkpoint = readCheckpoint(CHECKPOINT_FIXTURE_PATH);
	const parsed = parseNochestraInput("/triage github:143 reopen");
	const handoff = buildNochestraDeliveryHandoff({
		parsed,
		checkpoint,
		active: {
			id: "github-140",
			taskPath: ".workflow/tasks/github-140",
			stateFile: ".workflow/tasks/github-140/WORK.md",
			branch: "feat/140",
		},
	});

	assert.equal(handoff.destination, "triage");
	assert.deepEqual(handoff.artifact, {
		source: "github",
		id: "143",
		mode: "reopen",
		stateFile: ".workflow/tasks/github-140/WORK.md",
	});
	assert.equal(handoff.assignment, "Run triage for github:143");
	assert.equal(handoff.artifactSnapshot.activeWorkflow.branch, "feat/140");
	assert.equal("transcript" in handoff, false);
	assert.equal("messages" in handoff, false);
});

test("formatWriteApprovalPrompt renders friendly write dispatch prompt", () => {
	assert.equal(formatWriteApprovalPrompt({
		assignment: "Run triage for github:159",
		destination: "triage",
		permissions: ["write-checkout"],
		requiresWriteLock: true,
	}), [
		"Approve write-capable Nochestra dispatch?",
		"Task: Run triage for github:159",
		"Will run: triage",
		"Can change: write-checkout",
		"Other write workers will be paused while this runs",
	].join("\n"));
});

test("dispatchNochestraInput spawns a worker subprocess and returns compact next action", async () => {
	const repoDir = makeRepo();
	try {
		const result = await dispatchNochestraInput({
			input: "/triage local:parent-runtime-proof",
			cwd: repoDir,
		});

		assert.deepEqual(result, {
			kind: "delivery",
			command: "triage",
			task: { source: "local", id: "parent-runtime-proof" },
			status: "created",
			taskId: "local-parent-runtime-proof",
			summary: "Triage created for local:parent-runtime-proof",
			nextStep: "/frame",
			artifacts: [{ path: ".workflow/tasks/local-parent-runtime-proof/WORK.md", kind: "workflow-state" }],
		});
		assert.match(formatNochestraResult(result), /Next step: \/frame/);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput cancels write dispatch when approval callback rejects", async () => {
	const repoDir = makeRepo();
	try {
		const result = await dispatchNochestraInput({
			input: "/triage local:parent-runtime-cancel",
			cwd: repoDir,
			approveWriteDispatch: () => ({ userAction: "cancel" }),
		});

		assert.deepEqual(result, {
			kind: "delivery",
			command: "triage",
			task: { source: "local", id: "parent-runtime-cancel" },
			status: "cancelled",
			taskId: "local-parent-runtime-cancel",
			summary: "Write-capable dispatch cancelled by user.",
			nextStep: "manual-takeover",
			recovery: { action: "request user approval before write execution" },
		});
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput does not create checkpoint when missing dispatch is cancelled", async () => {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-cancel-no-checkpoint-"));
	spawnSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
	try {
		const result = await dispatchNochestraInput({
			input: "/triage local:no-checkpoint-cancel",
			cwd: repoDir,
			approveWriteDispatch: () => ({ userAction: "cancel" }),
		});

		assert.equal(result.status, "cancelled");
		assert.equal(result.taskId, "local-no-checkpoint-cancel");
		assert.equal(fs.existsSync(path.join(repoDir, ".workflow", "nochestra-checkpoint.json")), false);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput creates and updates a checkpoint when missing", async () => {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-no-checkpoint-"));
	spawnSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.name", "Nochestra Test"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.email", "nochestra@example.com"], { cwd: repoDir, stdio: "ignore" });
	fs.writeFileSync(path.join(repoDir, ".gitignore"), "node_modules\n", "utf8");
	spawnSync("git", ["add", ".gitignore"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["commit", "-m", "init"], { cwd: repoDir, stdio: "ignore" });
	try {
		const result = await dispatchNochestraInput({ input: "/triage local:no-checkpoint", cwd: repoDir });
		const checkpoint = readCheckpoint(path.join(repoDir, ".workflow", "nochestra-checkpoint.json"));

		assert.equal(result.status, "created");
		assert.equal(checkpoint.subject, "local:no-checkpoint");
		assert.equal(checkpoint.goal, "Run triage for local:no-checkpoint");
		assert.equal(checkpoint.suggestedNextRoute, "/frame");
		assert.match(checkpoint.decisions[0], /Triage created for local:no-checkpoint/);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("formatNochestraResult renders optional fields when present", () => {
	const result = {
		kind: "delivery",
		command: "triage",
		task: { source: "github", id: "173" },
		status: "ok",
		taskId: "github-173",
		summary: "Plan created",
		nextStep: "/implement",
		artifacts: [{ path: ".workflow/tasks/github-173/WORK.md", kind: "workflow-state" }],
		verification: [{ command: "node --test", status: "passed" }],
		blockers: ["Waiting for design review"],
		warnings: ["Stale main branch"],
		recovery: { action: "re-run with reset" },
	};

	const formatted = formatNochestraResult(result);
	assert.match(formatted, /Command: \/triage/);
	assert.match(formatted, /Task: github:173/);
	assert.match(formatted, /Status: ok/);
	assert.match(formatted, /Summary: Plan created/);
	assert.match(formatted, /Next step: \/implement/);
	assert.match(formatted, /Artifacts: \[\{"path":".workflow\/tasks\/github-173\/WORK.md","kind":"workflow-state"\}\]/);
	assert.match(formatted, /Verification: \[\{"command":"node --test","status":"passed"\}\]/);
	assert.match(formatted, /Blockers: \["Waiting for design review"\]/);
	assert.match(formatted, /Warnings: \["Stale main branch"\]/);
	assert.match(formatted, /Recovery: \{"action":"re-run with reset"\}/);
});

test("formatNochestraResult snapshots cover ok, blocked, failed, and cancelled states", () => {
	const okResult = formatNochestraResult({
		kind: "delivery",
		command: "triage",
		task: { source: "github", id: "173" },
		status: "ok",
		taskId: "github-173",
		summary: "Triage completed successfully",
		nextStep: "/frame",
		artifacts: [{ path: ".workflow/tasks/github-173/WORK.md", kind: "workflow-state" }],
	});
	assert.equal(okResult, [
		"Command: /triage",
		"Task: github:173",
		"Status: ok",
		"Summary: Triage completed successfully",
		"Next step: /frame",
		'Artifacts: [{"path":".workflow/tasks/github-173/WORK.md","kind":"workflow-state"}]',
	].join("\n"));

	const blockedResult = formatNochestraResult({
		kind: "delivery",
		command: "plan",
		task: { source: "github", id: "173" },
		status: "blocked",
		taskId: "github-173",
		summary: "Planning blocked by missing evidence",
		nextStep: "/grill-with-docs",
		blockers: ["Missing UI direct link"],
	});
	assert.equal(blockedResult, [
		"Command: /plan",
		"Task: github:173",
		"Status: blocked",
		"Summary: Planning blocked by missing evidence",
		"Next step: /grill-with-docs",
		'Blockers: ["Missing UI direct link"]',
	].join("\n"));

	const failedResult = formatNochestraResult({
		kind: "delivery",
		command: "implement",
		task: { source: "github", id: "173" },
		status: "failed",
		taskId: "github-173",
		summary: "Build execution failed",
		nextStep: "manual-fix",
		warnings: ["Compiler warning emitted"],
		recovery: { action: "re-run script" },
	});
	assert.equal(failedResult, [
		"Command: /implement",
		"Task: github:173",
		"Status: failed",
		"Summary: Build execution failed",
		"Next step: manual-fix",
		'Warnings: ["Compiler warning emitted"]',
		'Recovery: {"action":"re-run script"}',
	].join("\n"));

	const cancelledResult = formatNochestraResult({
		kind: "delivery",
		command: "triage",
		task: { source: "github", id: "173" },
		status: "cancelled",
		taskId: "github-173",
		summary: "Write dispatch cancelled by user",
		nextStep: "manual-takeover",
	});
	assert.equal(cancelledResult, [
		"Command: /triage",
		"Task: github:173",
		"Status: cancelled",
		"Summary: Write dispatch cancelled by user",
		"Next step: manual-takeover",
	].join("\n"));
});
