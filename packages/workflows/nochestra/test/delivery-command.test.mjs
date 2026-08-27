import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNochestraInput, parseTrackedTaskRef } from "../domain/delivery-command.mjs";

test("parseNochestraInput recognizes delivery commands: triage, frame, grill-with-docs, plan, sync", () => {
	for (const cmd of ["triage", "frame", "grill-with-docs", "plan", "sync"]) {
		const result = parseNochestraInput(`/${cmd} github:143`);
		assert.deepEqual(result, {
			kind: "delivery",
			route: "delivery",
			command: cmd,
			task: { source: "github", id: "143" },
			args: [],
			raw: `/${cmd} github:143`,
		});
	}
});

test("parseNochestraInput preserves trailing delivery args for later worker dispatch", () => {
	const result = parseNochestraInput(["/triage", "jira:ABC-123", "reopen"]);

	assert.equal(result.kind, "delivery");
	assert.deepEqual(result.task, { source: "jira", id: "ABC-123" });
	assert.deepEqual(result.args, ["reopen"]);
});

test("parseNochestraInput leaves normal prompts untouched", () => {
	assert.deepEqual(parseNochestraInput("hello nochestra"), {
		kind: "chat",
		prompt: "hello nochestra",
	});
});

test("parseNochestraInput rejects /triage without explicit source namespace", () => {
	assert.deepEqual(parseNochestraInput("/triage 143"), {
		kind: "delivery-error",
		command: "triage",
		error: "Delivery commands require an explicit source:id target.",
	});
});

test("parseTrackedTaskRef accepts supported sources only", () => {
	assert.deepEqual(parseTrackedTaskRef("local:setup-v2"), { source: "local", id: "setup-v2" });
	assert.equal(parseTrackedTaskRef("143"), null);
	assert.equal(parseTrackedTaskRef("slack:143"), null);
});
