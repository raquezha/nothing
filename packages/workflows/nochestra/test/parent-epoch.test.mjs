import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { readCheckpoint } from "../adapters/checkpoint.mjs";
import {
	buildParentEpochContext,
	transitionParentEpoch,
	retrieveArchivedTurns,
	shouldCompactParentEpoch,
	compactParentEpoch,
} from "../application/parent-epoch.mjs";

const FIXTURE_PATH = path.join(
	process.cwd(),
	"packages/workflows/nochestra/test/fixtures/checkpoint.json",
);

test("buildParentEpochContext constructs hot context containing instructions, checkpoint, recent turns, approvals, and task material", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const recentTurns = [{ role: "user", content: "Can we proceed to delivery?" }];
	const currentApprovals = ["jira-update-approved"];
	const taskMaterial = { issueId: "github-82" };

	const context = buildParentEpochContext({
		instructions: "System prompt for parent",
		checkpoint,
		recentTurns,
		currentApprovals,
		taskMaterial,
	});

	assert.equal(context.instructions, "System prompt for parent");
	assert.equal(context.checkpoint.subject, checkpoint.subject);
	assert.deepEqual(context.recentTurns, recentTurns);
	assert.deepEqual(context.currentApprovals, currentApprovals);
	assert.deepEqual(context.taskMaterial, taskMaterial);
});

test("buildParentEpochContext rejects invalid checkpoint", () => {
	assert.throws(
		() => buildParentEpochContext({ checkpoint: { invalid: true } }),
		/Missing required checkpoint field/,
	);
});

test("transitionParentEpoch ends current epoch and starts fresh hot context without raw transcript replay", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const archivedTranscript = [
		{ role: "user", content: "Turn 1" },
		{ role: "assistant", content: "Turn 2" },
		{ role: "user", content: "Turn 3" },
	];
	const recentTurns = [{ role: "user", content: "Turn 4" }];
	const contextSnapshot = {
		activeTokens: 25000,
		peakTokens: 30000,
		contextWindow: 200000,
	};

	const result = transitionParentEpoch({
		currentEpochId: "epoch-1",
		checkpoint,
		instructions: "Parent prompt",
		recentTurns,
		archivedTranscript,
		contextSnapshot,
	});

	assert.equal(result.epochId, "epoch-2");
	assert.equal(result.previousEpochId, "epoch-1");
	assert.equal(result.hotContext.recentTurns.length, 1);
	assert.equal(result.coldArchive.archivedTurns.length, 3);
	assert.deepEqual(result.coldArchive.archivedTurns, archivedTranscript);

	assert.equal(result.metrics.beforeActiveTokens, 25000);
	assert.equal(result.metrics.beforePeakTokens, 30000);
	assert.equal(result.metrics.contextWindow, 200000);
	assert.ok(typeof result.metrics.afterActiveTokensEstimate === "number");
});

test("transitionParentEpoch handles null/missing context snapshot metrics gracefully", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const result = transitionParentEpoch({
		checkpoint,
		contextSnapshot: null,
	});

	assert.equal(result.metrics.beforeActiveTokens, null);
	assert.equal(result.metrics.beforePeakTokens, null);
	assert.equal(result.metrics.contextWindow, null);
});

test("retrieveArchivedTurns allows selective retrieval without replaying full history by default", () => {
	const archivedTurns = [
		{ role: "user", content: "Turn 0" },
		{ role: "assistant", content: "Turn 1" },
		{ role: "user", content: "Turn 2" },
	];
	const coldArchive = { archivedTurns };

	const selected = retrieveArchivedTurns({ coldArchive, turnIndices: [1] });
	assert.deepEqual(selected, [{ role: "assistant", content: "Turn 1" }]);

	const all = retrieveArchivedTurns({ coldArchive });
	assert.deepEqual(all, archivedTurns);
});

test("shouldCompactParentEpoch triggers deterministically when token or turn limits are crossed", () => {
	assert.equal(shouldCompactParentEpoch({ activeTokens: 3000, maxTokens: 4000 }), false);
	assert.equal(shouldCompactParentEpoch({ activeTokens: 4000, maxTokens: 4000 }), true);
	assert.equal(shouldCompactParentEpoch({ turnCount: 3, turnThreshold: 5 }), false);
	assert.equal(shouldCompactParentEpoch({ turnCount: 5, turnThreshold: 5 }), true);

	process.env.NOCH_COMPACTION_TOKEN_THRESHOLD = "3500";
	try {
		assert.equal(shouldCompactParentEpoch({ activeTokens: 3400 }), false);
		assert.equal(shouldCompactParentEpoch({ activeTokens: 3500 }), true);
	} finally {
		delete process.env.NOCH_COMPACTION_TOKEN_THRESHOLD;
	}
});

test("compactParentEpoch performs deterministic transition, preserves quarantine window, and maintains valid checkpoint without transcript accumulation", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const transcript = [
		{ role: "user", content: "Turn 1" },
		{ role: "assistant", content: "Turn 2" },
		{ role: "user", content: "Turn 3" },
		{ role: "user", content: "Turn 4 (quarantined user turn 1)" },
		{ role: "assistant", content: "Turn 5 (quarantined turn 2)" },
	];

	const transition = compactParentEpoch({
		currentEpochId: "epoch-1",
		checkpoint,
		instructions: "System prompt",
		transcript,
		quarantineWindowSize: 2,
	});

	assert.equal(transition.epochId, "epoch-2");
	assert.equal(transition.previousEpochId, "epoch-1");
	assert.equal(transition.hotContext.recentTurns.length, 2);
	assert.deepEqual(transition.hotContext.recentTurns, transcript.slice(3));
	assert.equal(transition.coldArchive.archivedTurns.length, 3);
	assert.deepEqual(transition.coldArchive.archivedTurns, transcript.slice(0, 3));

	// Verify checkpoint validation passes and contains no transcript accumulation
	assert.equal("transcript" in transition.hotContext.checkpoint, false);
	assert.equal("messages" in transition.hotContext.checkpoint, false);
	assert.equal("history" in transition.hotContext.checkpoint, false);
});

