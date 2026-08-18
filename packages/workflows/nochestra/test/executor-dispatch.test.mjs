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
