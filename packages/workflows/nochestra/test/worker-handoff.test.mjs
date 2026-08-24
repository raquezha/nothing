import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	buildWorkerPrompt,
	parseWorkerHandoffArgs,
	readWorkerHandoff,
	validateBoundedWorkerHandoff,
} from "../worker-handoff.mjs";

const HANDOFF = {
	assignment: "Implement the next slice",
	artifactSnapshot: { stateFile: ".workflow/tasks/github-145/WORK.md" },
	acceptedDecisions: ["Use --handoff"],
	constraints: ["No parent transcript"],
	openQuestions: [],
	selectedSkills: ["implement"],
	permissions: ["write-checkout"],
	contextBudget: { maxTokens: 4000 },
	expectedResultShape: { required: ["status", "taskId", "summary", "nextStep"] },
};

test("parseWorkerHandoffArgs reads canonical --handoff path", () => {
	assert.deepEqual(parseWorkerHandoffArgs(["--handoff", "/tmp/handoff.json"]), {
		handoffPath: "/tmp/handoff.json",
	});
});

test("readWorkerHandoff reads handoff JSON from file", async () => {
	const file = path.join(os.tmpdir(), `nochestra-worker-${Date.now()}.json`);
	fs.writeFileSync(file, JSON.stringify(HANDOFF), "utf8");
	try {
		assert.deepEqual(await readWorkerHandoff({ args: ["--handoff", file] }), HANDOFF);
	} finally {
		fs.rmSync(file, { force: true });
	}
});

test("readWorkerHandoff reads handoff JSON from stdin when no --handoff is passed", async () => {
	assert.deepEqual(await readWorkerHandoff({ stdin: JSON.stringify(HANDOFF) }), HANDOFF);
});

test("validateBoundedWorkerHandoff rejects transcript-shaped fields", () => {
	assert.throws(
		() => validateBoundedWorkerHandoff({ ...HANDOFF, parentTranscript: ["too much"] }),
		/Forbidden transcript field in worker handoff: parentTranscript/,
	);
});

test("buildWorkerPrompt includes bounded handoff fields and omits transcript fields", () => {
	const prompt = buildWorkerPrompt(HANDOFF);

	assert.match(prompt, /Assignment:\nImplement the next slice/);
	assert.match(prompt, /Accepted decisions:/);
	assert.match(prompt, /Use --handoff/);
	assert.match(prompt, /Expected result JSON:/);
	assert.equal(prompt.includes("parentTranscript"), false);
	assert.equal(prompt.includes("messages"), false);
});
