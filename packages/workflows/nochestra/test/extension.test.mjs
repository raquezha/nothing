import assert from "node:assert/strict";
import { test } from "node:test";
import nochestraExtension from "../extensions/nochestra/index.ts";

function createMockPi() {
	const handlers = new Map();
	return {
		on(event, handler) {
			if (!handlers.has(event)) {
				handlers.set(event, []);
			}
			handlers.get(event).push(handler);
		},
		async emitInput(event, ctx = {}) {
			const list = handlers.get("input") || [];
			let lastResult;
			for (const fn of list) {
				lastResult = await fn(event, ctx);
			}
			return lastResult;
		},
	};
}

test("nochestra extension transforms un-slashed executable triage prompt to slash command", async () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	const res = await pi.emitInput({
		source: "interactive",
		text: "triage github:201",
	});

	assert.equal(res.action, "transform");
	assert.match(res.text, /✔ NOCHESTRA/);
});

test("nochestra extension transforms explicit research prompt to pi --research command", async () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	const res = await pi.emitInput({
		source: "interactive",
		text: "research model routing options",
	});

	assert.deepEqual(res, {
		action: "transform",
		text: "pi --research",
	});
});

test("nochestra extension protects multi-line pasted transcript starting with slash command", async () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	const transcript = "/triage github:201\nWorker output:\nCompleted slice 1";
	const res = await pi.emitInput({
		source: "interactive",
		text: transcript,
	});

	assert.deepEqual(res, {
		action: "transform",
		text: ` ${transcript}`,
	});
});

test("nochestra extension passes multi-line transcript without leading slash through as chat", async () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	const transcript = "User transcript:\n/triage github:201 was executed.\nWhat is next?";
	const res = await pi.emitInput({
		source: "interactive",
		text: transcript,
	});

	assert.deepEqual(res, {
		action: "continue",
	});
});

test("nochestra extension passes non-interactive inputs through untouched", async () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	for (const source of ["rpc", "extension"]) {
		const res = await pi.emitInput({
			source,
			text: "triage github:201",
		});

		assert.deepEqual(res, {
			action: "continue",
		});
	}
});

test("nochestra extension passes single-line slash command through unchanged", async () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	const res = await pi.emitInput({
		source: "interactive",
		text: "/frame",
	});

	assert.deepEqual(res, {
		action: "continue",
	});
});
