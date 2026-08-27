import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNochestraInput, parseTrackedTaskRef, recommendNochestraRoute } from "../domain/delivery-command.mjs";

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

test("recommendNochestraRoute suggests Delivery for exact triage ref grammar", () => {
	assert.deepEqual(recommendNochestraRoute("triage github:123"), {
		kind: "route-recommendation",
		route: "delivery",
		command: "/triage github:123",
		confidence: "high",
		reason: "rule:delivery-triage-ref",
	});
});

test("recommendNochestraRoute recommends unsupported Delivery actions without inventing executable commands", () => {
	assert.deepEqual(recommendNochestraRoute("implement github:123"), {
		kind: "route-recommendation",
		route: "delivery",
		command: null,
		confidence: "high",
		reason: "rule:delivery-unsupported-action-ref",
	});
});

test("recommendNochestraRoute suggests Discovery for explicit research grammar", () => {
	assert.deepEqual(recommendNochestraRoute("research model routing options"), {
		kind: "route-recommendation",
		route: "discovery",
		command: "pi --research",
		confidence: "high",
		reason: "rule:discovery-explicit-research",
	});
});

test("recommendNochestraRoute suggests Notes for explicit write-to-destination grammar", () => {
	assert.deepEqual(recommendNochestraRoute("write this to notes"), {
		kind: "route-recommendation",
		route: "notes",
		command: "pi --notes",
		confidence: "high",
		reason: "rule:notes-write-destination",
	});
});

test("recommendNochestraRoute keeps plain discussion and bare questions in Chat", () => {
	for (const input of ["hello", "how are you?", "should we use SQLite?"]) {
		assert.deepEqual(recommendNochestraRoute(input), {
			kind: "route-recommendation",
			route: "chat",
			command: null,
			confidence: "high",
			reason: "rule:chat-fallback",
		});
	}
});

test("recommendNochestraRoute keeps incomplete durable prompts in Chat", () => {
	for (const input of ["save this", "remember this", "capture this"]) {
		assert.deepEqual(recommendNochestraRoute(input), {
			kind: "route-recommendation",
			route: "chat",
			command: null,
			confidence: "high",
			reason: "rule:chat-fallback",
		});
	}
});

test("recommendNochestraRoute keeps discussion-about-delivery in Chat", () => {
	assert.deepEqual(recommendNochestraRoute("should I triage github:123?"), {
		kind: "route-recommendation",
		route: "chat",
		command: null,
		confidence: "high",
		reason: "rule:chat-fallback",
	});
});

test("recommendNochestraRoute returns needs-confirmation for conflicting explicit route grammars", () => {
	assert.deepEqual(recommendNochestraRoute("research this and write it to notes"), {
		kind: "route-recommendation",
		route: "needs-confirmation",
		command: null,
		confidence: "high",
		reason: "rules:notes-write-destination,discovery-explicit-research",
	});
});
