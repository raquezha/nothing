import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, beforeEach } from "node:test";
import { readCheckpoint } from "../adapters/checkpoint.mjs";
import { acquireWriterLock, isWriterLocked, releaseWriterLock, resetWriterLock } from "../adapters/writer-lock.mjs";
import { buildExecutionEvidence, buildWorkerEnv, emitExecutionEvidence, spawnWorkerProcess } from "../adapters/process-runner.mjs";
import { buildBoundedHandoff, dispatchExecutor } from "../application/executor-dispatch.mjs";

const FIXTURE_PATH = path.join(
	process.cwd(),
	"packages/workflows/nochestra/test/fixtures/checkpoint.json",
);

const TEST_LOCK_PATH = path.join(os.tmpdir(), "nochestra-test-writer.lock");
const WORKER_RUNTIME_PATH = path.join(process.cwd(), "packages/workflows/nochestra/application/worker-runtime.mjs");

beforeEach(() => {
	resetWriterLock(TEST_LOCK_PATH);
});

test("buildBoundedHandoff creates handoff with explicit context budget and accepted decisions", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Implement feature slice 1",
		checkpoint,
		artifactSnapshot: { file: "lib/core.js" },
		contextBudget: { maxTokens: 8000, maxTurns: 10 },
		selectedSkills: ["ponytail"],
		permissions: ["write-checkout"],
	});

	assert.equal(handoff.assignment, "Implement feature slice 1");
	assert.deepEqual(handoff.contextBudget, { maxTokens: 8000, maxTurns: 10 });
	assert.deepEqual(handoff.acceptedDecisions, checkpoint.decisions);
	assert.deepEqual(handoff.selectedSkills, ["ponytail"]);
	assert.deepEqual(handoff.expectedResultShape, {
		required: ["status", "taskId", "summary", "nextStep"],
		optional: ["artifacts", "verification", "blockers", "warnings", "recovery", "evidence", "fallbackApplied"],
	});
	assert.equal("parentTranscript" in handoff, false);
	assert.equal("transcript" in handoff, false);
});

test("buildBoundedHandoff requires assignment and explicit context budget", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	assert.throws(
		() => buildBoundedHandoff({ checkpoint }),
		/assignment string is required/,
	);
	assert.throws(
		() => buildBoundedHandoff({ assignment: "task", checkpoint }),
		/contextBudget object is required/,
	);
	assert.throws(
		() => buildBoundedHandoff({ assignment: "task", checkpoint, contextBudget: null }),
		/non-empty contextBudget object is required/,
	);
	assert.throws(
		() => buildBoundedHandoff({ assignment: "task", checkpoint, contextBudget: {} }),
		/non-empty contextBudget object is required/,
	);
});

test("dispatchExecutor launches predefined executor and returns compact parent presentation without transcript", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Execute bounded assignment",
		checkpoint,
		contextBudget: { maxTokens: 4000, maxTurns: 5 },
		permissions: ["write-checkout"],
	});

	let executed = false;
	let approvalRequest = null;
	const result = await dispatchExecutor({
		handoff,
		ownerId: "parent-1",
		requiresWriteLock: true,
		lockPath: TEST_LOCK_PATH,
		approveWriteDispatch: (request) => {
			approvalRequest = request;
			return true;
		},
		executor: (h) => {
			executed = true;
			assert.equal(h.assignment, "Execute bounded assignment");
			return {
				status: "ok",
				taskId: "github-79",
				summary: "Bounded executor finished successfully",
				nextStep: "/verify",
			};
		},
	});

	assert.equal(executed, true);
	assert.deepEqual(approvalRequest, {
		assignment: "Execute bounded assignment",
		destination: null,
		permissions: ["write-checkout"],
		writeScope: null,
		requiresWriteLock: true,
	});
	assert.equal(result.status, "ok");
	assert.equal(result.taskId, "github-79");
	assert.equal(result.summary, "Bounded executor finished successfully");
	assert.equal(result.nextStep, "/verify");
	assert.equal(result.writeLockAcquired, true);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false, "Lock should be released after execution");
});

test("dispatchExecutor can prove an end-to-end subprocess worker with compact result and local model fallback", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Run triage subprocess proof",
		checkpoint,
		contextBudget: { maxTokens: 4000, maxTurns: 4 },
		permissions: ["write-checkout"],
		model: { provider: "ollama", name: "qwen:7b", contextWindow: 8192 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-e2e-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		const fs = require('fs');
		const args = process.argv.slice(2);
		const handoffPath = args[args.indexOf('--handoff') + 1];
		const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
		const provider = args[args.indexOf('--provider') + 1];
		const model = args[args.indexOf('--model') + 1];
		if (!args.includes('--no-context-files')) process.exit(2);
		if (handoff.assignment !== 'Run triage subprocess proof') process.exit(3);
		if (provider !== 'cloud-anthropic' || model !== 'claude-3-5-sonnet') process.exit(4);
		if (!fs.existsSync(process.env.TEST_LOCK_PATH)) process.exit(5);
		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-144',
			summary: 'Fresh subprocess triage proof returned compact result',
			nextStep: '/verify'
		}));
	`, "utf8");

	let workerProcessResult = null;
	try {
		const result = await dispatchExecutor({
			handoff,
			ownerId: "dispatch-e2e-parent",
			lockPath: TEST_LOCK_PATH,
			approveWriteDispatch: () => true,
			executor: async (boundedHandoff) => {
				workerProcessResult = await spawnWorkerProcess({
					handoff: boundedHandoff,
					command: process.execPath,
					args: [scriptPath],
					env: { ...process.env, TEST_LOCK_PATH },
					lockPath: TEST_LOCK_PATH,
					requiresWriteLock: false,
					fallbackModel: { provider: "cloud-anthropic", name: "claude-3-5-sonnet" },
					checkProviderAvailable: (provider) => provider !== "ollama",
				});
				return workerProcessResult;
			},
		});

		assert.equal(result.status, "ok");
		assert.equal(result.taskId, "github-144");
		assert.equal(result.summary, "Fresh subprocess triage proof returned compact result");
		assert.equal(result.nextStep, "/verify");
		assert.equal(result.writeLockAcquired, true);
		assert.equal(workerProcessResult.fallbackApplied, true);
		assert.equal(workerProcessResult.writeLockAcquired, false);
		assert.equal("transcript" in result, false);
		assert.equal("rawWorkerLog" in result, false);
		assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("dispatchExecutor can invoke the actual worker-runtime subprocess with a fake triage helper", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-dispatch-runtime-"));
	const helperPath = path.join(repoDir, "fake-triage-helper.cjs");
	const handoff = buildBoundedHandoff({
		assignment: "Run triage for local:runtime-proof",
		checkpoint,
		artifactSnapshot: { source: "local", id: "runtime-proof" },
		contextBudget: { maxTokens: 4000 },
		selectedSkills: ["triage"],
		permissions: ["write-checkout"],
	});
	const routedHandoff = {
		...handoff,
		destination: "triage",
		artifact: { source: "local", id: "runtime-proof" },
	};

	fs.mkdirSync(path.join(repoDir, ".workflow", "tasks", "local-runtime-proof"), { recursive: true });
	fs.writeFileSync(helperPath, `#!/usr/bin/env node
		const fs = require('fs');
		const path = require('path');
		const [source, id] = process.argv.slice(2);
		const stateFile = path.join('.workflow', 'tasks', source + '-' + id, 'WORK.md');
		fs.mkdirSync(path.dirname(stateFile), { recursive: true });
		fs.writeFileSync(path.join('.workflow', 'active.json'), JSON.stringify({ id: source + '-' + id, stateFile }));
		fs.writeFileSync(stateFile, '## [BRIEF]\\nready\\n## [PLAN]\\n- [ ]\\n');
		console.log('Creating task workspace');
	`, "utf8");
	fs.chmodSync(helperPath, 0o755);

	try {
		const result = await dispatchExecutor({
			handoff: routedHandoff,
			ownerId: "runtime-proof-parent",
			lockPath: TEST_LOCK_PATH,
			approveWriteDispatch: () => true,
			executor: (h) => spawnWorkerProcess({
				handoff: h,
				command: process.execPath,
				args: [WORKER_RUNTIME_PATH],
				cwd: repoDir,
				env: { ...process.env, NOCH_TRIAGE_HELPER_PATH: helperPath },
				lockPath: TEST_LOCK_PATH,
				requiresWriteLock: false,
			}),
		});

		assert.equal(result.status, "created");
		assert.equal(result.taskId, "local-runtime-proof");
		assert.equal(result.summary, "Triage created for local:runtime-proof");
		assert.equal(result.nextStep, "/grill-with-docs");
		assert.equal(result.writeLockAcquired, true);
		assert.deepEqual(result.artifacts, [{ path: ".workflow/tasks/local-runtime-proof/WORK.md", kind: "workflow-state" }]);
		assert.ok(result.evidence);
		assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchExecutor defaults read-only handoff to no writer lock", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Read-only unlocked task",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	await acquireWriterLock("worker-A", TEST_LOCK_PATH);
	try {
		const result = await dispatchExecutor({
			handoff,
			ownerId: "parent-readonly-unlocked",
			lockPath: TEST_LOCK_PATH,
			approveWriteDispatch: () => {
				throw new Error("approval should not be requested");
			},
			executor: () => ({ status: "ok", taskId: "t1", summary: "read-only done", nextStep: "/verify" }),
		});

		assert.equal(result.status, "ok");
		assert.equal(result.writeLockAcquired, false);
		assert.equal(isWriterLocked(TEST_LOCK_PATH), true);
	} finally {
		await releaseWriterLock("worker-A", TEST_LOCK_PATH);
	}
});

test("dispatchExecutor does not request approval for read-only handoff that still needs a writer lock", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Read-only locked task",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const result = await dispatchExecutor({
		handoff,
		ownerId: "parent-readonly-lock",
		requiresWriteLock: true,
		lockPath: TEST_LOCK_PATH,
		approveWriteDispatch: () => {
			throw new Error("approval should not be requested");
		},
		executor: () => ({ status: "ok", taskId: "t1", summary: "read-only done", nextStep: "/verify" }),
	});

	assert.equal(result.status, "ok");
	assert.equal(result.writeLockAcquired, true);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
});

test("dispatchExecutor cancels rejected write-capable dispatch before lock or executor", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Needs human approval",
		checkpoint,
		artifactSnapshot: { id: "github-147" },
		contextBudget: { maxTokens: 4000 },
		permissions: ["write-checkout"],
	});

	let executed = false;
	const result = await dispatchExecutor({
		handoff,
		ownerId: "parent-reject",
		requiresWriteLock: false,
		lockPath: TEST_LOCK_PATH,
		approveWriteDispatch: () => ({ userAction: "cancel" }),
		executor: () => {
			executed = true;
			return { status: "ok", taskId: "github-147", summary: "bad", nextStep: "/verify" };
		},
	});

	assert.equal(executed, false);
	assert.equal(result.status, "cancelled");
	assert.equal(result.taskId, "github-147");
	assert.equal(result.nextStep, "manual-takeover");
	assert.equal(result.writeLockAcquired, false);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
});

test("writer lock prevents concurrent write dispatches", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Concurrent task",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	await acquireWriterLock("worker-A", TEST_LOCK_PATH);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), true);
	assert.equal(fs.existsSync(`${TEST_LOCK_PATH}.owner.json`), true);

	await assert.rejects(
		() => dispatchExecutor({
			handoff,
			ownerId: "worker-B",
			requiresWriteLock: true,
			lockPath: TEST_LOCK_PATH,
			executor: () => ({ status: "ok", taskId: "t1", summary: "s", nextStep: "n" }),
		}),
		/Writer lock is currently held by another executor/,
	);

	await assert.rejects(
		() => dispatchExecutor({
			handoff,
			ownerId: "worker-A",
			requiresWriteLock: true,
			lockPath: TEST_LOCK_PATH,
			executor: () => ({ status: "ok", taskId: "t1", summary: "s", nextStep: "n" }),
		}),
		/Writer lock is currently held by another executor/,
	);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), true, "Nested same-owner dispatch must not release outer lock");

	await releaseWriterLock("worker-A", TEST_LOCK_PATH);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
});

test("writer lock can recover a stale lock directory", async () => {
	fs.mkdirSync(TEST_LOCK_PATH);
	const old = new Date(Date.now() - 10000);
	fs.utimesSync(TEST_LOCK_PATH, old, old);

	assert.equal(await acquireWriterLock("worker-stale", TEST_LOCK_PATH, { stale: 5000, update: 1000 }), true);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), true);
	await releaseWriterLock("worker-stale", TEST_LOCK_PATH);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
});

test("buildWorkerEnv passes worker role and parent session correlation env vars", () => {
	const env = buildWorkerEnv({ NOCHESTRA_SESSION_ID: "parent-session-1" });
	assert.equal(env.NOCHESTRA_WORKER, "1");
	assert.equal(env.NOCHESTRA_ROLE, "worker");
	assert.equal(env.NOCHESTRA_PARENT_SESSION_ID, "parent-session-1");
});

test("dispatchExecutor awaits async executor before validating result and releasing lock", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Async bounded task",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const result = await dispatchExecutor({
		handoff,
		ownerId: "parent-async",
		requiresWriteLock: true,
		lockPath: TEST_LOCK_PATH,
		executor: async () => {
			assert.equal(isWriterLocked(TEST_LOCK_PATH), true);
			return {
				status: "ok",
				taskId: "github-79",
				summary: "async worker done",
				nextStep: "/verify",
			};
		},
	});

	assert.equal(result.summary, "async worker done");
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
});

test("dispatchExecutor rejects executor output containing forbidden full transcript fields", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Task with bad result",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	await assert.rejects(
		() => dispatchExecutor({
			handoff,
			ownerId: "parent-1",
			requiresWriteLock: false,
			executor: async () => ({
				status: "ok",
				taskId: "github-79",
				summary: "bad",
				nextStep: "/verify",
				transcript: ["full worker transcript"],
			}),
		}),
		/Forbidden worker result field: transcript/,
	);
});

test("spawnWorkerProcess launches sub-process, passes handoff packet and --no-context-files flag, and parses stdout JSON result", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "CLI worker test assignment",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		const fs = require('fs');
		const args = process.argv.slice(2);
		const hasNoContext = args.includes('--no-context-files');
		const handoffIdx = args.indexOf('--handoff');
		const handoffPath = handoffIdx !== -1 ? args[handoffIdx + 1] : null;
		const handoffData = handoffPath ? JSON.parse(fs.readFileSync(handoffPath, 'utf8')) : null;

		if (!hasNoContext || !handoffData || handoffData.assignment !== 'CLI worker test assignment') {
			process.exit(1);
		}

		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-140',
			summary: 'Sub-process executed successfully',
			nextStep: '/verify'
		}));
	`, "utf8");

	try {
		const result = await spawnWorkerProcess({
			handoff,
			command: process.execPath,
			args: [scriptPath],
			lockPath: TEST_LOCK_PATH,
			ownerId: "worker-proc-1",
		});

		assert.equal(result.status, "ok");
		assert.equal(result.taskId, "github-140");
		assert.equal(result.summary, "Sub-process executed successfully");
		assert.equal(result.nextStep, "/verify");
		assert.equal(result.writeLockAcquired, false);
		assert.equal(isWriterLocked(TEST_LOCK_PATH), false, "Lock must be released after sub-process finishes");
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess defaults read-only handoff to no writer lock", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "CLI worker read-only assignment",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-worker-readonly-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-140-readonly',
			summary: 'Read-only sub-process executed successfully',
			nextStep: '/verify'
		}));
	`, "utf8");

	await acquireWriterLock("worker-A", TEST_LOCK_PATH);
	try {
		const result = await spawnWorkerProcess({
			handoff,
			command: process.execPath,
			args: [scriptPath],
			lockPath: TEST_LOCK_PATH,
			ownerId: "worker-proc-readonly",
		});

		assert.equal(result.status, "ok");
		assert.equal(result.taskId, "github-140-readonly");
		assert.equal(result.writeLockAcquired, false);
		assert.equal(isWriterLocked(TEST_LOCK_PATH), true);
	} finally {
		await releaseWriterLock("worker-A", TEST_LOCK_PATH);
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess cancels rejected write-capable dispatch before spawning", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "CLI worker needs approval",
		checkpoint,
		artifactSnapshot: { id: "github-147" },
		contextBudget: { maxTokens: 4000 },
		permissions: ["write-checkout"],
	});

	let approvalRequest = null;
	const result = await spawnWorkerProcess({
		handoff,
		command: process.execPath,
		args: ["-e", "process.exit(1)"],
		lockPath: TEST_LOCK_PATH,
		ownerId: "worker-proc-reject",
		requiresWriteLock: false,
		approveWriteDispatch: (request) => {
			approvalRequest = request;
			return { userAction: "cancel" };
		},
	});

	assert.deepEqual(approvalRequest, {
		assignment: "CLI worker needs approval",
		destination: null,
		permissions: ["write-checkout"],
		writeScope: null,
		requiresWriteLock: false,
	});
	assert.equal(result.status, "cancelled");
	assert.equal(result.taskId, "github-147");
	assert.equal(result.nextStep, "manual-takeover");
	assert.equal(result.writeLockAcquired, false);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false);
});

test("spawnWorkerProcess handles stdin handoffMode and validates worker output", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Stdin worker test",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-stdin-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		let data = '';
		process.stdin.on('data', chunk => { data += chunk; });
		process.stdin.on('end', () => {
			const handoffData = JSON.parse(data);
			if (handoffData.assignment !== 'Stdin worker test') {
				process.exit(1);
			}
			console.log(JSON.stringify({
				status: 'ok',
				taskId: 'github-140-stdin',
				summary: 'Stdin sub-process success',
				nextStep: '/sync'
			}));
		});
	`, "utf8");

	try {
		const result = await spawnWorkerProcess({
			handoff,
			command: process.execPath,
			args: [scriptPath],
			handoffMode: "stdin",
			lockPath: TEST_LOCK_PATH,
			requiresWriteLock: false,
		});

		assert.equal(result.status, "ok");
		assert.equal(result.taskId, "github-140-stdin");
		assert.equal(result.writeLockAcquired, false);
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess rejects malformed stdout JSON from worker sub-process", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Bad output task",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-bad-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `console.log("NOT_VALID_JSON");`, "utf8");

	try {
		await assert.rejects(
			() => spawnWorkerProcess({
				handoff,
				command: process.execPath,
				args: [scriptPath],
				lockPath: TEST_LOCK_PATH,
				requiresWriteLock: false,
			}),
			/Failed to parse worker stdout JSON/,
		);
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess cleans up temporary handoff files on process fallback", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Temp file cleanup test",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
		model: { provider: "ollama", name: "qwen:7b", contextWindow: 8192 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-temp-cleanup-${Date.now()}.cjs`);
	let createdTempFile = null;

	fs.writeFileSync(scriptPath, `
		const fs = require('fs');
		const args = process.argv.slice(2);
		const providerIdx = args.indexOf('--provider');
		const providerVal = providerIdx !== -1 ? args[providerIdx + 1] : null;
		const handoffIdx = args.indexOf('--handoff');
		const handoffPath = handoffIdx !== -1 ? args[handoffIdx + 1] : null;
		if (handoffPath && fs.existsSync(handoffPath)) {
			console.error('TEMP_PATH:' + handoffPath);
		}
		if (providerVal === 'ollama') process.exit(1);
		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-194-temp',
			summary: 'Temp cleanup fallback success',
			nextStep: '/verify'
		}));
	`, "utf8");

	try {
		const result = await spawnWorkerProcess({
			handoff,
			command: process.execPath,
			args: [scriptPath],
			handoffMode: "file",
			fallbackModel: { provider: "cloud-anthropic", name: "claude-3-5-sonnet" },
			lockPath: TEST_LOCK_PATH,
			requiresWriteLock: false,
		});

		assert.equal(result.status, "ok");
		assert.equal(result.fallbackApplied, true);

		if (result.evidence?.tempFilePath) {
			assert.equal(fs.existsSync(result.evidence.tempFilePath), false, "Temporary handoff file should be unlinked");
		}
	} finally {
		if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
	}
});

test("buildBoundedHandoff supports valid model specification and rejects malformed model config", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Model test task",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
		model: { provider: "ollama", name: "qwen:7b", contextWindow: 8192 },
	});

	assert.deepEqual(handoff.model, { provider: "ollama", name: "qwen:7b", contextWindow: 8192 });

	assert.throws(
		() => buildBoundedHandoff({ checkpoint, assignment: "t", contextBudget: { maxTokens: 100 }, model: "invalid" }),
		/model must be an object/,
	);
	assert.throws(
		() => buildBoundedHandoff({ checkpoint, assignment: "t", contextBudget: { maxTokens: 100 }, model: { name: "qwen" } }),
		/model.provider string is required/,
	);
	assert.throws(
		() => buildBoundedHandoff({ checkpoint, assignment: "t", contextBudget: { maxTokens: 100 }, model: { provider: "ollama" } }),
		/model.name string is required/,
	);
	assert.throws(
		() => buildBoundedHandoff({ checkpoint, assignment: "t", contextBudget: { maxTokens: 100 }, model: { provider: "ollama", name: "qwen", contextWindow: -5 } }),
		/model.contextWindow must be a positive number/,
	);
});

test("spawnWorkerProcess passes --provider and --model CLI flags and enforces context budget vs model contextWindow", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);

	// Context budget exceeding model contextWindow should reject without fallback
	const handoffOverBudget = buildBoundedHandoff({
		assignment: "Over budget model test",
		checkpoint,
		contextBudget: { maxTokens: 16000 },
		model: { provider: "ollama", name: "qwen:7b", contextWindow: 8192 },
	});

	await assert.rejects(
		() => spawnWorkerProcess({
			handoff: handoffOverBudget,
			command: process.execPath,
			args: [],
			lockPath: TEST_LOCK_PATH,
			requiresWriteLock: false,
		}),
		/Context budget \(maxTokens\) exceeds model context window \(16000 > 8192\)/,
	);

	// Valid context budget passes --provider and --model flags
	const handoffValid = buildBoundedHandoff({
		assignment: "Local model flags test",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
		model: { provider: "ollama", name: "qwen:7b", contextWindow: 8192 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-model-flags-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		const args = process.argv.slice(2);
		const providerIdx = args.indexOf('--provider');
		const modelIdx = args.indexOf('--model');
		const providerVal = providerIdx !== -1 ? args[providerIdx + 1] : null;
		const modelVal = modelIdx !== -1 ? args[modelIdx + 1] : null;

		if (providerVal !== 'ollama' || modelVal !== 'qwen:7b') {
			process.exit(1);
		}

		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-141-flags',
			summary: 'Model flags verified',
			nextStep: '/verify'
		}));
	`, "utf8");

	try {
		const result = await spawnWorkerProcess({
			handoff: handoffValid,
			command: process.execPath,
			args: [scriptPath],
			lockPath: TEST_LOCK_PATH,
			requiresWriteLock: false,
		});

		assert.equal(result.status, "ok");
		assert.equal(result.taskId, "github-141-flags");
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess handles local provider daemon unavailability and process failure fallback", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Local fallback test",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
		model: { provider: "ollama", name: "qwen:7b", contextWindow: 8192 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-fallback-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		const args = process.argv.slice(2);
		const providerIdx = args.indexOf('--provider');
		const providerVal = providerIdx !== -1 ? args[providerIdx + 1] : null;

		if (providerVal === 'ollama') {
			// Simulate local daemon failure
			process.exit(1);
		}

		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-141-fallback',
			summary: 'Fallback execution success',
			nextStep: '/sync'
		}));
	`, "utf8");

	try {
		// 1. Unavailability via checkProviderAvailable with fallbackModel
		const resultUnavailable = await spawnWorkerProcess({
			handoff,
			command: process.execPath,
			args: [scriptPath],
			fallbackModel: { provider: "cloud-anthropic", name: "claude-3-5-sonnet" },
			checkProviderAvailable: (provider) => provider !== "ollama",
			lockPath: TEST_LOCK_PATH,
			requiresWriteLock: false,
		});
		assert.equal(resultUnavailable.status, "ok");
		assert.equal(resultUnavailable.fallbackApplied, true);

		// 2. Process execution exit code failure triggers fallbackModel
		const resultExitFallback = await spawnWorkerProcess({
			handoff,
			command: process.execPath,
			args: [scriptPath],
			fallbackModel: { provider: "cloud-anthropic", name: "claude-3-5-sonnet" },
			lockPath: TEST_LOCK_PATH,
			requiresWriteLock: false,
		});
		assert.equal(resultExitFallback.status, "ok");
		assert.equal(resultExitFallback.fallbackApplied, true);
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess defaults command to process.env.PI_BINARY or pi CLI binary", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Default command test",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-pi-binary-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-141-pibinary',
			summary: 'PI_BINARY command success',
			nextStep: '/verify'
		}));
	`, "utf8");

	try {
		const result = await spawnWorkerProcess({
			handoff,
			env: { ...process.env, PI_BINARY: process.execPath },
			args: [scriptPath],
			lockPath: TEST_LOCK_PATH,
			requiresWriteLock: false,
		});
		assert.equal(result.status, "ok");
		assert.equal(result.taskId, "github-141-pibinary");
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess supervision enforces timeout watchdog and releases writer lock on timeout", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Supervision timeout test",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-timeout-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		// Ignore SIGTERM to force watchdog SIGKILL escalation
		process.on('SIGTERM', () => {});
		setTimeout(() => {}, 60000);
	`, "utf8");

	try {
		await assert.rejects(
			() => spawnWorkerProcess({
				handoff,
				command: process.execPath,
				args: [scriptPath],
				timeout: 100,
				lockPath: TEST_LOCK_PATH,
				requiresWriteLock: true,
				ownerId: "supervision-test-runner",
			}),
			/Worker process timed out after 100ms/,
		);

		assert.equal(isWriterLocked(TEST_LOCK_PATH), false, "Writer lock must be safely released after timeout");
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess supervision releases lock and truncates raw log context on crash", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Supervision crash test",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-crash-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		console.error("A".repeat(500));
		process.exit(1);
	`, "utf8");

	try {
		await assert.rejects(
			() => spawnWorkerProcess({
				handoff,
				command: process.execPath,
				args: [scriptPath],
				lockPath: TEST_LOCK_PATH,
				requiresWriteLock: true,
				ownerId: "crash-test-runner",
			}),
			(err) => {
				assert.match(err.message, /Worker process exited with code 1/);
				assert.equal(err.message.length < 300, true, "Raw stderr must be truncated to prevent prompt context bloat");
				return true;
			},
		);

		assert.equal(isWriterLocked(TEST_LOCK_PATH), false, "Writer lock must be safely released on worker crash");
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("spawnWorkerProcess preserves optional envelope fields in returned result", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Rich envelope test assignment",
		checkpoint,
		contextBudget: { maxTokens: 4000 },
	});

	const scriptPath = path.join(os.tmpdir(), `test-rich-worker-${Date.now()}.cjs`);
	fs.writeFileSync(scriptPath, `
		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-173',
			summary: 'Sub-process executed successfully',
			nextStep: '/verify',
			artifacts: [{ path: '.workflow/tasks/github-173/WORK.md', kind: 'workflow-state' }],
			verification: [{ command: 'node --test', status: 'passed' }],
			blockers: [],
			warnings: ['Low memory'],
			recovery: null
		}));
	`, "utf8");

	try {
		const result = await spawnWorkerProcess({
			handoff,
			command: process.execPath,
			args: [scriptPath],
		});

		assert.equal(result.status, "ok");
		assert.equal(result.taskId, "github-173");
		assert.deepEqual(result.artifacts, [{ path: ".workflow/tasks/github-173/WORK.md", kind: "workflow-state" }]);
		assert.deepEqual(result.verification, [{ command: "node --test", status: "passed" }]);
		assert.deepEqual(result.blockers, []);
		assert.deepEqual(result.warnings, ["Low memory"]);
		assert.equal(result.recovery, null);
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
});

test("buildWorkerEnv sets correlation environment variables", () => {
	const env = buildWorkerEnv({}, {
		parentSessionId: "parent-sess-123",
		workerId: "nochestra-worker-456",
		workItemId: "github-175",
		runId: "run-789",
	});

	assert.equal(env.NOCHESTRA_WORKER, "1");
	assert.equal(env.NOCHESTRA_ROLE, "worker");
	assert.equal(env.NOCHESTRA_PARENT_SESSION_ID, "parent-sess-123");
	assert.equal(env.NOCHESTRA_WORKER_ID, "nochestra-worker-456");
	assert.equal(env.NOCHESTRA_WORK_ITEM_ID, "github-175");
	assert.equal(env.NOCHESTRA_RUN_ID, "run-789");
});

test("buildExecutionEvidence constructs compact evidence snapshot without transcripts", () => {
	const handoff = {
		destination: "triage",
		artifactSnapshot: { source: "github", id: "175", route: "delivery" },
		model: { provider: "ollama", name: "qwen:7b" },
	};
	const result = { status: "created", taskId: "github-175", nextStep: "/frame" };
	const evidence = buildExecutionEvidence({
		handoff,
		result,
		workerId: "nochestra-worker-175",
		fallbackApplied: false,
		handoffBytes: 1200,
	});

	assert.deepEqual(evidence, {
		route: "delivery",
		destination: "triage",
		workItemId: "github-175",
		workerId: "nochestra-worker-175",
		handoffBytes: 1200,
		resultStatus: "created",
		nextStep: "/frame",
		provider: "ollama",
		model: "qwen:7b",
		fallbackApplied: false,
	});
	assert.equal("parentTranscript" in evidence, false);
	assert.equal("transcript" in evidence, false);
});

test("dispatchExecutor records evidence and calls onEvidence and events.emit, with fail-open behavior", async () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const handoff = buildBoundedHandoff({
		assignment: "Execute evidence test assignment",
		checkpoint,
		artifactSnapshot: { source: "github", id: "175", route: "delivery" },
		contextBudget: { maxTokens: 4000, maxTurns: 5 },
		permissions: ["write-checkout"],
	});
	handoff.destination = "triage";

	const emittedEvents = [];
	let capturedEvidence = null;

	const result = await dispatchExecutor({
		handoff,
		ownerId: "parent-1",
		workerId: "worker-evidence-1",
		requiresWriteLock: true,
		lockPath: TEST_LOCK_PATH,
		onEvidence: (ev) => {
			capturedEvidence = ev;
		},
		events: {
			emit: (event, payload) => {
				emittedEvents.push({ event, payload });
			},
		},
		executor: () => ({
			status: "ok",
			taskId: "github-175",
			summary: "Worker executed with evidence",
			nextStep: "/frame",
		}),
	});

	assert.equal(result.status, "ok");
	assert.ok(result.evidence);
	assert.equal(result.evidence.workItemId, "github-175");
	assert.equal(result.evidence.route, "delivery");
	assert.equal(result.evidence.destination, "triage");
	assert.equal(result.evidence.workerId, "worker-evidence-1");

	assert.deepEqual(capturedEvidence, result.evidence);
	assert.equal(emittedEvents.length, 1);
	assert.equal(emittedEvents[0].event, "notrace.boundary");
	assert.equal(emittedEvents[0].payload.type, "worker_handoff");
	assert.equal(emittedEvents[0].payload.workItemId, "github-175");

	// Fail-open check: when onEvidence throws and events.emit throws, execution succeeds
	const failOpenResult = await dispatchExecutor({
		handoff,
		ownerId: "parent-1",
		requiresWriteLock: true,
		lockPath: TEST_LOCK_PATH,
		onEvidence: () => {
			throw new Error("Telemetry failure");
		},
		events: {
			emit: () => {
				throw new Error("Event emitter failure");
			},
		},
		executor: () => ({
			status: "ok",
			taskId: "github-175",
			summary: "Fail-open worker executed",
			nextStep: "/frame",
		}),
	});
	assert.equal(failOpenResult.status, "ok");
});
