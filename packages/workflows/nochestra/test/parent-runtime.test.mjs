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
			taskId: "parent-runtime-cancel",
			summary: "Write-capable dispatch cancelled by user.",
			nextStep: "manual-takeover",
		});
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput fails delivery without an explicit checkpoint", async () => {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-no-checkpoint-"));
	try {
		await assert.rejects(
			() => dispatchNochestraInput({ input: "/triage local:no-checkpoint", cwd: repoDir }),
			/No Nochestra checkpoint found/,
		);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("parent runtime CLI prints compact delivery summary for slash commands", () => {
	const repoDir = makeRepo();
	try {
		const result = spawnSync(process.execPath, [PARENT_RUNTIME_PATH, "/triage", "local:cli-parent-proof"], {
			cwd: repoDir,
			encoding: "utf8",
			input: "y\n",
		});

		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stderr, /Task: Run triage for local:cli-parent-proof/);
		assert.match(result.stdout, /Command: \/triage/);
		assert.match(result.stdout, /Task: local:cli-parent-proof/);
		assert.match(result.stdout, /Next step: \/frame/);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});
