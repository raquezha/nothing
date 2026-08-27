import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNochestraInput, parseTrackedTaskRef } from "../domain/delivery-command.mjs";

test("parseNochestraInput recognizes /triage with explicit task target as an executable delivery command", () => {
	const result = parseNochestraInput("/triage github:143");

	assert.deepEqual(result, {
		kind: "delivery",
		route: "delivery",
		command: "triage",
		task: { source: "github", id: "143" },
		args: [],
		raw: "/triage github:143",
	});
});

// Non-triage scope prompts are policy-tested, but worker execution is not implemented yet.
test("parseNochestraInput leaves unsupported workflow commands as chat", () => {
	assert.deepEqual(parseNochestraInput("/frame github:143"), {
		kind: "chat",
		prompt: "/frame github:143",
	});
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
