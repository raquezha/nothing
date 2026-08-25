import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { executeTriageWorker } from "../worker-runtime.mjs";

const TRIAGE_HELPER_PATH = path.join(process.cwd(), "packages/workflows/norpiv/scripts/triage_helper.sh");
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
