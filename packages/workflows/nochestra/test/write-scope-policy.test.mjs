import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWriteScope } from "../domain/write-scope-policy.mjs";

test("resolveWriteScope builds scope for triage", () => {
	const scope = resolveWriteScope({ destination: "triage", assignment: "Run triage for github:174" });
	assert.deepEqual(scope, {
		canChange: [
			".workflow/tasks/github-174/WORK.md",
			".workflow/tasks/github-174/metadata.json",
			".workflow/active.json",
		],
		willNot: ["edit code", "update tracker"],
	});
});

test("resolveWriteScope preserves tracker id casing in explicit task object paths", () => {
	const scope = resolveWriteScope({ destination: "frame", task: { source: "jira", id: "PROJ-999" } });
	assert.deepEqual(scope, {
		canChange: [
			".workflow/tasks/jira-PROJ-999/WORK.md [BRIEF], [LOG]",
		],
		willNot: ["edit code", "update tracker"],
	});
});

test("resolveWriteScope builds scope for sync", () => {
	const scope = resolveWriteScope({ destination: "sync", assignment: "Run sync for local:setup" });
	assert.deepEqual(scope, {
		canChange: [
			"target issue/PR marker comment (<!-- pi-sync-marker -->)",
			".workflow/tasks/local-setup/WORK.md [LOG]",
		],
		willNot: ["edit code"],
	});
});

test("resolveWriteScope sanitizes task ids to avoid path traversal expansion", () => {
	const scope = resolveWriteScope({ destination: "triage", task: { source: "local", id: "../evil/../x" } });
	assert.equal(scope.canChange[0].startsWith(".workflow/tasks/local-"), true);
	assert.equal(scope.canChange[0].includes("/../"), false);
	assert.equal(scope.canChange[0].includes("\\..\\"), false);
	assert.equal(scope.canChange[0].includes("evil"), true);
});

test("resolveWriteScope returns null for unknown destinations", () => {
	assert.equal(resolveWriteScope({ destination: "unknown", assignment: "Run test for local:foo" }), null);
});
