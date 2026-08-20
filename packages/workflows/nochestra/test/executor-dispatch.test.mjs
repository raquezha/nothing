import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, beforeEach } from "node:test";
import { readCheckpoint } from "../checkpoint.mjs";
import {
	acquireWriterLock,
	buildBoundedHandoff,
	dispatchExecutor,
	isWriterLocked,
	releaseWriterLock,
	resetWriterLock,
	spawnWorkerProcess,
} from "../executor-dispatch.mjs";

const FIXTURE_PATH = path.join(
	process.cwd(),
	"packages/workflows/nochestra/test/fixtures/checkpoint.json",
);

const TEST_LOCK_PATH = path.join(os.tmpdir(), "nochestra-test-writer.lock");

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
	});

	let executed = false;
	const result = await dispatchExecutor({
		handoff,
		ownerId: "parent-1",
		requiresWriteLock: true,
		lockPath: TEST_LOCK_PATH,
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
	assert.equal(result.status, "ok");
	assert.equal(result.taskId, "github-79");
	assert.equal(result.summary, "Bounded executor finished successfully");
	assert.equal(result.nextStep, "/verify");
	assert.equal(result.writeLockAcquired, true);
	assert.equal(isWriterLocked(TEST_LOCK_PATH), false, "Lock should be released after execution");
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
		assert.equal(result.writeLockAcquired, true);
		assert.equal(isWriterLocked(TEST_LOCK_PATH), false, "Lock must be released after sub-process finishes");
	} finally {
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
	}
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
