import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { readCheckpoint } from "../adapters/checkpoint.mjs";
import {
	buildJiraTriageProof,
	evaluateJiraTriageExecution,
	validateCompactWorkerResult,
} from "../jira-triage-proof.mjs";

const FIXTURE_PATH = path.join(
	process.cwd(),
	"packages/workflows/nochestra/test/fixtures/checkpoint.json",
);

test("buildJiraTriageProof creates a bounded Jira-to-triage handoff without transcript replay", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const proof = buildJiraTriageProof({
		checkpoint,
		jiraIssue: {
			key: "ABC-123",
			summary: "Incomplete ticket",
			description: "long body that should not be copied whole",
		},
		jiraUpdate: {
			fields: {
				description: "Refined acceptance criteria",
			},
		},
		triageTask: {
			source: "github",
			id: "83",
			destination: "triage",
			stateFile: ".workflow/tasks/github-83/WORK.md",
		},
		currentApprovals: ["jira-update-approved"],
		recentTurns: [{ role: "user", content: "Send this to triage." }],
		contextBudget: { maxTurns: 2, maxChars: 1200 },
	});

	assert.equal(proof.route, "jira-refine-then-triage");
	assert.equal(proof.jira.issue.key, "ABC-123");
	assert.equal(proof.jira.updateApproved, true);
	assert.equal(proof.handoff.destination, "triage");
	assert.deepEqual(proof.handoff.acceptedDecisions, checkpoint.decisions);
	assert.equal(proof.handoff.artifact.stateFile, ".workflow/tasks/github-83/WORK.md");
	assert.deepEqual(proof.parentContext.recentTurns, [{ role: "user", content: "Send this to triage." }]);
	assert.equal("transcript" in proof.handoff, false);
	assert.equal("description" in proof.jira.issue, false);
});

test("buildJiraTriageProof requires explicit approval before including a Jira update", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	assert.throws(
		() => buildJiraTriageProof({
			checkpoint,
			jiraIssue: { key: "ABC-123", summary: "Incomplete ticket" },
			jiraUpdate: { fields: { description: "Refined" } },
			triageTask: { source: "github", id: "83", destination: "triage" },
			currentApprovals: [],
		}),
		/jiraUpdate requires explicit jira-update-approved approval/,
	);
});

test("buildJiraTriageProof rejects non-triage destinations", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	assert.throws(
		() => buildJiraTriageProof({
			checkpoint,
			jiraIssue: { key: "ABC-123", summary: "Incomplete ticket" },
			triageTask: { source: "github", id: "83", destination: "research" },
		}),
		/triageTask.destination must be 'triage'/,
	);
});

test("validateCompactWorkerResult accepts compact results and rejects transcript-shaped payloads", () => {
	assert.equal(
		validateCompactWorkerResult({
			status: "ok",
			taskId: "github-83",
			summary: "WORK.md created",
			nextStep: "/frame",
			jiraUpdateApplied: true,
		}),
		true,
	);

	assert.throws(
		() => validateCompactWorkerResult({
			status: "ok",
			taskId: "github-83",
			summary: "bad",
			nextStep: "/frame",
			transcript: ["too much"],
		}),
		/Forbidden worker result field: transcript/,
	);
});

test("evaluateJiraTriageExecution handles user cancel / takeover without dispatching worker", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const proof = buildJiraTriageProof({
		checkpoint,
		jiraIssue: { key: "ABC-123", summary: "Incomplete ticket" },
		triageTask: { source: "github", id: "83", destination: "triage" },
	});

	let called = false;
	const result = evaluateJiraTriageExecution({
		proof,
		userAction: "cancel",
		workerRunner: () => {
			called = true;
			return { status: "ok", taskId: "github-83", summary: "done", nextStep: "/frame" };
		},
	});

	assert.equal(result.status, "cancelled");
	assert.equal(called, false);
	assert.equal(result.nextStep, "manual-takeover");
});

test("evaluateJiraTriageExecution applies Jira update and handles successful worker execution", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const proof = buildJiraTriageProof({
		checkpoint,
		jiraIssue: { key: "ABC-123", summary: "Incomplete ticket" },
		jiraUpdate: { fields: { description: "Updated" } },
		triageTask: { source: "github", id: "83", destination: "triage" },
		currentApprovals: ["jira-update-approved"],
	});

	let appliedUpdate = null;
	const result = evaluateJiraTriageExecution({
		proof,
		jiraAdapter: {
			applyUpdate: (update) => { appliedUpdate = update; },
		},
		workerRunner: (handoff) => ({
			status: "ok",
			taskId: handoff.artifact.source + "-" + handoff.artifact.id,
			summary: "Artifact created",
			nextStep: "/frame",
		}),
	});

	assert.equal(result.status, "ok");
	assert.equal(result.jiraUpdateApplied, true);
	assert.deepEqual(appliedUpdate, { fields: { description: "Updated" } });
	assert.equal(result.taskId, "github-83");
});

test("evaluateJiraTriageExecution rejects malformed worker result", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const proof = buildJiraTriageProof({
		checkpoint,
		jiraIssue: { key: "ABC-123", summary: "Incomplete ticket" },
		triageTask: { source: "github", id: "83", destination: "triage" },
	});

	const result = evaluateJiraTriageExecution({
		proof,
		workerRunner: () => ({
			status: "ok",
			taskId: "github-83",
			summary: "bad",
			nextStep: "/frame",
			rawWorkerLog: "full trace",
		}),
	});

	assert.equal(result.status, "rejected");
	assert.equal(result.summary, "Worker returned invalid payload.");
});

test("evaluateJiraTriageExecution handles post-Jira-mutation worker failure safely", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	const proof = buildJiraTriageProof({
		checkpoint,
		jiraIssue: { key: "ABC-123", summary: "Incomplete ticket" },
		jiraUpdate: { fields: { description: "Updated" } },
		triageTask: { source: "github", id: "83", destination: "triage" },
		currentApprovals: ["jira-update-approved"],
	});

	let mutationCount = 0;
	const result = evaluateJiraTriageExecution({
		proof,
		jiraAdapter: {
			applyUpdate: () => { mutationCount++; },
		},
		workerRunner: () => {
			throw new Error("Worker process crash");
		},
	});

	assert.equal(result.status, "failed");
	assert.equal(result.jiraUpdateApplied, true);
	assert.equal(result.workerFailure, "Worker process crash");
	assert.equal(mutationCount, 1);
});
