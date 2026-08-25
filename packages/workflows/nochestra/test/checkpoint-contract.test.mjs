import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { validateCheckpoint } from "../domain/checkpoint-contract.mjs";
import { readCheckpoint, writeCheckpoint } from "../adapters/checkpoint.mjs";

const FIXTURE_PATH = path.join(
	process.cwd(),
	"packages/workflows/nochestra/test/fixtures/checkpoint.json",
);

test("readCheckpoint reads and validates single rolling checkpoint fixture", () => {
	const checkpoint = readCheckpoint(FIXTURE_PATH);
	assert.equal(checkpoint.subject, "Jira ABC-123");
	assert.equal(checkpoint.goal, "Prepare and deliver the ticket");
	assert.deepEqual(checkpoint.decisions, [
		"Use replace-in-place rolling checkpoint contract",
	]);
	assert.deepEqual(checkpoint.constraints, [
		"Do not accumulate prior checkpoint bodies",
	]);
	assert.deepEqual(checkpoint.openQuestions, [
		"What is the final storage path?",
	]);
	assert.deepEqual(checkpoint.rejectedOptions, [
		"Append-only transcript log",
	]);
	assert.equal(checkpoint.currentRoute, "chat");
	assert.equal(checkpoint.suggestedNextRoute, "delivery");
});

test("writeCheckpoint replaces active checkpoint completely without accumulating prior state", () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-cp-"));
	const cpPath = path.join(tempDir, "checkpoint.json");

	const initialCheckpoint = {
		subject: "Initial Task",
		goal: "Start research",
		decisions: ["Decision 1"],
		constraints: ["Constraint 1"],
		openQuestions: ["Question 1"],
		rejectedOptions: ["Option 1"],
		currentRoute: "chat",
		suggestedNextRoute: "research",
	};

	writeCheckpoint(cpPath, initialCheckpoint);
	assert.deepEqual(readCheckpoint(cpPath), initialCheckpoint);

	const updatedCheckpoint = {
		subject: "Initial Task",
		goal: "Complete research",
		decisions: ["Decision 1", "Decision 2"],
		constraints: ["Constraint 1"],
		openQuestions: [],
		rejectedOptions: ["Option 1", "Option 2"],
		currentRoute: "research",
		suggestedNextRoute: "triage",
	};

	writeCheckpoint(cpPath, updatedCheckpoint);
	const onDisk = readCheckpoint(cpPath);

	assert.deepEqual(onDisk, updatedCheckpoint);
	assert.equal(
		Object.keys(onDisk).includes("previousCheckpoints"),
		false,
		"Must not keep previous checkpoints",
	);
	assert.equal(
		Object.keys(onDisk).includes("history"),
		false,
		"Must not keep turn history",
	);

	fs.rmSync(tempDir, { recursive: true, force: true });
});

test("validateCheckpoint rejects objects with transcript accumulation fields", () => {
	const invalidCheckpoint = {
		subject: "Task",
		goal: "Goal",
		decisions: [],
		constraints: [],
		openQuestions: [],
		rejectedOptions: [],
		currentRoute: "chat",
		suggestedNextRoute: "delivery",
		history: ["turn 1", "turn 2"],
	};

	assert.throws(
		() => validateCheckpoint(invalidCheckpoint),
		/Forbidden transcript\/history accumulation field found: history/,
	);
});

test("validateCheckpoint rejects objects with missing required fields", () => {
	const incompleteCheckpoint = {
		subject: "Task",
		goal: "Goal",
	};

	assert.throws(
		() => validateCheckpoint(incompleteCheckpoint),
		/Missing required checkpoint field: decisions/,
	);
});
