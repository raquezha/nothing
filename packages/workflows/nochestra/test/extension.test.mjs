import assert from "node:assert/strict";
import { test } from "node:test";
import nochestraExtension from "../extensions/nochestra/index.ts";

function createMockPi() {
	const handlers = new Map();
	const commands = new Map();

	return {
		on(event, handler) {
			if (!handlers.has(event)) {
				handlers.set(event, []);
			}
			handlers.get(event).push(handler);
		},
		registerCommand(name, config) {
			commands.set(name, config);
		},
		getCommand(name) {
			return commands.get(name);
		},
		async emitCommand(name, args, ctx = {}) {
			const cmd = commands.get(name);
			if (!cmd) throw new Error(`Command ${name} not registered`);
			return await cmd.handler(args, ctx);
		},
	};
}

test("nochestra extension registers native commands for all stage routes", () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	const expected = ["triage", "frame", "grill-with-docs", "plan", "implement", "verify", "sync", "checkpoint"];
	for (const cmd of expected) {
		assert.ok(pi.getCommand(cmd), `Expected /${cmd} command to be registered`);
	}
});

test("nochestra extension executes registered /triage command natively", async () => {
	const pi = createMockPi();
	nochestraExtension(pi);

	await pi.emitCommand("triage", "github:201");
});
