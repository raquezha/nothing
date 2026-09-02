import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { buildNochestraDeliveryHandoff, dispatchNochestraInput, formatNochestraResult, formatWriteApprovalPrompt, checkAndCompactParentContext, dispatchDeliveryCommand, resolveWorkerRemediation, formatRemediationPrompt } from "../application/parent-runtime.mjs";
import { readCheckpoint } from "../adapters/checkpoint.mjs";
import { parseNochestraInput } from "../domain/delivery-command.mjs";

const PARENT_RUNTIME_PATH = path.join(process.cwd(), "packages/workflows/nochestra/application/parent-runtime.mjs");
const CHECKPOINT_FIXTURE_PATH = path.join(process.cwd(), "packages/workflows/nochestra/test/fixtures/checkpoint.json");

function makeRepo() {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-parent-runtime-"));
	spawnSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.name", "Nochestra Test"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.email", "nochestra@example.com"], { cwd: repoDir, stdio: "ignore" });
	fs.mkdirSync(path.join(repoDir, ".workflow"), { recursive: true });
	fs.copyFileSync(CHECKPOINT_FIXTURE_PATH, path.join(repoDir, ".workflow", "nochestra-checkpoint.json"));
	fs.writeFileSync(path.join(repoDir, ".gitignore"), "node_modules\n", "utf8");
	spawnSync("git", ["add", ".gitignore"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["commit", "-m", "init"], { cwd: repoDir, stdio: "ignore" });
	return repoDir;
}

test("buildNochestraDeliveryHandoff keeps delivery state bounded and transcript-free", () => {
	const checkpoint = readCheckpoint(CHECKPOINT_FIXTURE_PATH);
	const parsed = parseNochestraInput("/triage github:143 reopen");
	const handoff = buildNochestraDeliveryHandoff({
		parsed,
		checkpoint,
		active: {
			id: "github-140",
			taskPath: ".workflow/tasks/github-140",
			stateFile: ".workflow/tasks/github-140/WORK.md",
			branch: "feat/140",
		},
	});

	assert.equal(handoff.destination, "triage");
	assert.deepEqual(handoff.artifact, {
		source: "github",
		id: "143",
		mode: "reopen",
		stateFile: ".workflow/tasks/github-140/WORK.md",
	});
	assert.equal(handoff.assignment, "Run triage for github:143");
	assert.equal(handoff.artifactSnapshot.activeWorkflow.branch, "feat/140");
	assert.deepEqual(handoff.permissions, ["write-checkout"]);
	assert.equal(handoff.workspaceAccess, "write-checkout");
	assert.equal("transcript" in handoff, false);
	assert.equal("messages" in handoff, false);
});

test("buildNochestraDeliveryHandoff marks research as explicit read-only", () => {
	const checkpoint = readCheckpoint(CHECKPOINT_FIXTURE_PATH);
	const parsed = parseNochestraInput('research "emoji search 😀 and spaces"');
	const handoff = buildNochestraDeliveryHandoff({
		parsed,
		checkpoint,
		active: null,
	});

	assert.equal(handoff.destination, "research");
	assert.deepEqual(handoff.permissions, ["read-only"]);
	assert.equal(handoff.workspaceAccess, "read-only");
	assert.equal(handoff.assignment, 'Run research for "emoji search 😀 and spaces"');
});

test("buildNochestraDeliveryHandoff selects model tier based on task complexity", () => {
	const checkpoint = readCheckpoint(CHECKPOINT_FIXTURE_PATH);

	// Lightweight task: triage prefers local fast model
	const triageParsed = parseNochestraInput("/triage github:194");
	const triageHandoff = buildNochestraDeliveryHandoff({
		parsed: triageParsed,
		checkpoint,
		active: null,
	});
	assert.equal(triageHandoff.model.provider, "ollama");
	assert.equal(triageHandoff.model.name, "ornith:9b");

	// Heavy task: plan prefers cloud premium model
	const planParsed = parseNochestraInput("/plan github:194");
	const planHandoff = buildNochestraDeliveryHandoff({
		parsed: planParsed,
		checkpoint,
		active: { id: "github-194", stateFile: ".workflow/tasks/github-194/WORK.md" },
	});
	assert.equal(planHandoff.model.provider, "antigravity");
	assert.equal(planHandoff.model.name, "gemini-3.6-flash");

	// Explicit override: /triage github:194 use gpt-5.4-mini
	const overrideParsed = parseNochestraInput("/triage github:194 use gpt-5.4-mini");
	const overrideHandoff = buildNochestraDeliveryHandoff({
		parsed: overrideParsed,
		checkpoint,
		active: null,
	});
	assert.equal(overrideHandoff.model.provider, "openai-codex");
	assert.equal(overrideHandoff.model.name, "gpt-5.4-mini");

	// Explicit full spec override preserves actual catalog context window
	const fullSpecParsed = parseNochestraInput("/triage github:194 use antigravity/gemini-3.6-flash");
	const fullSpecHandoff = buildNochestraDeliveryHandoff({
		parsed: fullSpecParsed,
		checkpoint,
		active: null,
	});
	assert.equal(fullSpecHandoff.model.provider, "antigravity");
	assert.equal(fullSpecHandoff.model.name, "gemini-3.6-flash");
	assert.equal(fullSpecHandoff.model.contextWindow, 1048576);

	// Provider alias resolution (openai -> openai-codex)
	const providerAliasParsed = parseNochestraInput("/triage github:194 use openai/gpt-5.4-mini");
	const providerAliasHandoff = buildNochestraDeliveryHandoff({
		parsed: providerAliasParsed,
		checkpoint,
		active: null,
	});
	assert.equal(providerAliasHandoff.model.provider, "openai-codex");
	assert.equal(providerAliasHandoff.model.name, "gpt-5.4-mini");

	// Real prompts often contain spaces instead of exact catalog punctuation
	const spacedModelParsed = parseNochestraInput("/plan github:194 use openai gpt 5.4 mini please");
	const spacedModelHandoff = buildNochestraDeliveryHandoff({ parsed: spacedModelParsed, checkpoint, active: null });
	assert.equal(spacedModelHandoff.model.provider, "openai-codex");
	assert.equal(spacedModelHandoff.model.name, "gpt-5.4-mini");

	// Shortcut and typo resolution (3.6-flash -> gemini-3.6-flash, ornith -> ornith:9b)
	const shortcutParsed1 = parseNochestraInput("/triage github:194 use 3.6-flash");
	const shortcutHandoff1 = buildNochestraDeliveryHandoff({ parsed: shortcutParsed1, checkpoint, active: null });
	assert.equal(shortcutHandoff1.model.name, "gemini-3.6-flash");

	const shortcutParsed2 = parseNochestraInput("/plan github:194 use ornith");
	const shortcutHandoff2 = buildNochestraDeliveryHandoff({ parsed: shortcutParsed2, checkpoint, active: null });
	assert.equal(shortcutHandoff2.model.name, "ornith:9b");

	// Vague or unrecognized model override stops before dispatch and asks for clarification
	const unknownParsed = parseNochestraInput("/plan github:194 use unknown-random-model-xyz");
	assert.throws(
		() => buildNochestraDeliveryHandoff({ parsed: unknownParsed, checkpoint, active: null }),
		/Which model did you mean by "unknown-random-model-xyz"\?/
	);
});

test("dispatchDeliveryCommand falls back to cloud model when local model override is requested but unavailable", async () => {
	const repoDir = makeRepo();
	const scriptPath = path.join(os.tmpdir(), `test-override-fallback-${Date.now()}.cjs`);

	fs.writeFileSync(scriptPath, `
		const args = process.argv.slice(2);
		const providerIdx = args.indexOf('--provider');
		const providerVal = providerIdx !== -1 ? args[providerIdx + 1] : null;
		if (providerVal === 'ollama') process.exit(1);
		console.log(JSON.stringify({
			status: 'ok',
			taskId: 'github-194',
			summary: 'Fallback execution success',
			nextStep: '/implement'
		}));
	`, "utf8");

	try {
		const parsed = parseNochestraInput("/plan github:194 use ornith:9b");
		const result = await dispatchDeliveryCommand({
			parsed,
			cwd: repoDir,
			workerRuntimePath: scriptPath,
			checkProviderAvailable: (provider) => provider !== "ollama",
		});

		assert.equal(result.status, "ok");
		assert.equal(result.fallbackApplied, true);

		// Custom local provider env override fallback
		const customLocalParsed = parseNochestraInput("/plan github:194 use custom-local/model-a");
		const customResult = await dispatchDeliveryCommand({
			parsed: customLocalParsed,
			cwd: repoDir,
			workerRuntimePath: scriptPath,
			env: { ...process.env, NOCH_LOCAL_PROVIDER: "custom-local" },
			checkProviderAvailable: (provider) => provider !== "custom-local",
		});

		assert.equal(customResult.status, "ok");
		assert.equal(customResult.fallbackApplied, true);
	} finally {
		if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("formatWriteApprovalPrompt renders friendly write dispatch prompt", () => {
	assert.equal(formatWriteApprovalPrompt({
		assignment: "Run triage for github:159",
		destination: "triage",
		permissions: ["write-checkout"],
		writeScope: {
			canChange: [
				".workflow/tasks/github-159/WORK.md",
				".workflow/tasks/github-159/metadata.json",
				".workflow/active.json",
			],
			willNot: ["edit code", "update tracker"],
		},
		requiresWriteLock: true,
	}), [
		"Approve write-capable Nochestra dispatch?",
		"Task: Run triage for github:159",
		"Can change:",
		"- .workflow/tasks/github-159/WORK.md",
		"- .workflow/tasks/github-159/metadata.json",
		"- .workflow/active.json",
		"Will not:",
		"- edit code",
		"- update tracker",
		"Other write workers will be paused while this runs",
	].join("\n"));

	assert.equal(formatWriteApprovalPrompt({
		assignment: "Run frame for github:123",
		destination: "frame",
		permissions: ["write-checkout"],
	}), [
		"Approve write-capable Nochestra dispatch?",
		"Task: Run frame for github:123",
		"Can change:",
		"- .workflow/tasks/github-123/WORK.md [BRIEF], [LOG]",
		"Will not:",
		"- edit code",
		"- update tracker",
	].join("\n"));

	assert.equal(formatWriteApprovalPrompt({
		assignment: "Run grill-with-docs for github:123",
		destination: "grill-with-docs",
		permissions: ["write-checkout"],
	}), [
		"Approve write-capable Nochestra dispatch?",
		"Task: Run grill-with-docs for github:123",
		"Can change:",
		"- .workflow/tasks/github-123/WORK.md [GRILL], [LOG]",
		"Will not:",
		"- edit code",
		"- update tracker",
	].join("\n"));

	assert.equal(formatWriteApprovalPrompt({
		assignment: "Run plan for github:123",
		destination: "plan",
		permissions: ["write-checkout"],
	}), [
		"Approve write-capable Nochestra dispatch?",
		"Task: Run plan for github:123",
		"Can change:",
		"- .workflow/tasks/github-123/WORK.md [PLAN], [LOG]",
		"Will not:",
		"- edit code",
		"- update tracker",
	].join("\n"));

	assert.equal(formatWriteApprovalPrompt({
		assignment: "Run sync for github:123",
		destination: "sync",
		permissions: ["write-checkout"],
	}), [
		"Approve write-capable Nochestra dispatch?",
		"Task: Run sync for github:123",
		"Can change:",
		"- target issue/PR marker comment (<!-- pi-sync-marker -->)",
		"- .workflow/tasks/github-123/WORK.md [LOG]",
		"Will not:",
		"- edit code",
	].join("\n"));

	assert.equal(formatWriteApprovalPrompt({
		assignment: "Run mystery for local:foo",
		destination: "unknown",
		permissions: ["write-checkout"],
	}), [
		"Approve write-capable Nochestra dispatch?",
		"Task: Run mystery for local:foo",
		"Will run: unknown",
		"Can change: write-checkout",
	].join("\n"));
});

test("dispatchNochestraInput spawns a worker subprocess and returns compact next action", async () => {
	const repoDir = makeRepo();
	try {
		const result = await dispatchNochestraInput({
			input: "/triage local:parent-runtime-proof",
			cwd: repoDir,
		});

		assert.equal(result.kind, "delivery");
		assert.equal(result.command, "triage");
		assert.deepEqual(result.task, { source: "local", id: "parent-runtime-proof" });
		assert.equal(result.status, "created");
		assert.equal(result.taskId, "local-parent-runtime-proof");
		assert.equal(result.summary, "Triage created for local:parent-runtime-proof");
		assert.equal(result.nextStep, "/frame");
		assert.deepEqual(result.artifacts, [{ path: ".workflow/tasks/local-parent-runtime-proof/WORK.md", kind: "workflow-state" }]);
		assert.ok(result.evidence);
		assert.equal(result.evidence.workItemId, "local-parent-runtime-proof");
		assert.match(formatNochestraResult(result), /Next step: \/frame/);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput cancels write dispatch when approval callback rejects", async () => {
	const repoDir = makeRepo();
	let approvalRequest = null;
	try {
		const result = await dispatchNochestraInput({
			input: "/triage local:parent-runtime-cancel",
			cwd: repoDir,
			approveWriteDispatch: (request) => {
				approvalRequest = request;
				return { userAction: "cancel" };
			},
		});

		assert.deepEqual(approvalRequest, {
			assignment: "Run triage for local:parent-runtime-cancel",
			destination: "triage",
			permissions: ["write-checkout"],
			writeScope: {
				canChange: [
					".workflow/tasks/local-parent-runtime-cancel/WORK.md",
					".workflow/tasks/local-parent-runtime-cancel/metadata.json",
					".workflow/active.json",
				],
				willNot: ["edit code", "update tracker"],
			},
			requiresWriteLock: true,
		});

		assert.equal(result.kind, "delivery");
		assert.equal(result.command, "triage");
		assert.deepEqual(result.task, { source: "local", id: "parent-runtime-cancel" });
		assert.equal(result.status, "cancelled");
		assert.equal(result.taskId, "local-parent-runtime-cancel");
		assert.equal(result.summary, "Write-capable dispatch cancelled by user.");
		assert.equal(result.nextStep, "manual-takeover");
		assert.deepEqual(result.recovery, { action: "request user approval before write execution" });
		assert.ok(result.evidence);
		assert.equal(result.evidence.resultStatus, "cancelled");
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput does not create checkpoint when missing dispatch is cancelled", async () => {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-cancel-no-checkpoint-"));
	spawnSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
	try {
		const result = await dispatchNochestraInput({
			input: "/triage local:no-checkpoint-cancel",
			cwd: repoDir,
			approveWriteDispatch: () => ({ userAction: "cancel" }),
		});

		assert.equal(result.status, "cancelled");
		assert.equal(result.taskId, "local-no-checkpoint-cancel");
		assert.equal(fs.existsSync(path.join(repoDir, ".workflow", "nochestra-checkpoint.json")), false);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput creates and updates a checkpoint when missing", async () => {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-no-checkpoint-"));
	spawnSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.name", "Nochestra Test"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["config", "user.email", "nochestra@example.com"], { cwd: repoDir, stdio: "ignore" });
	fs.writeFileSync(path.join(repoDir, ".gitignore"), "node_modules\n", "utf8");
	spawnSync("git", ["add", ".gitignore"], { cwd: repoDir, stdio: "ignore" });
	spawnSync("git", ["commit", "-m", "init"], { cwd: repoDir, stdio: "ignore" });
	try {
		const result = await dispatchNochestraInput({ input: "/triage local:no-checkpoint", cwd: repoDir });
		const checkpoint = readCheckpoint(path.join(repoDir, ".workflow", "nochestra-checkpoint.json"));

		assert.equal(result.status, "created");
		assert.equal(checkpoint.subject, "local:no-checkpoint");
		assert.equal(checkpoint.goal, "Run triage for local:no-checkpoint");
		assert.equal(checkpoint.suggestedNextRoute, "/frame");
		assert.match(checkpoint.decisions[0], /Triage created for local:no-checkpoint/);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("formatNochestraResult renders optional fields when present", () => {
	const result = {
		kind: "delivery",
		command: "triage",
		task: { source: "github", id: "173" },
		status: "ok",
		taskId: "github-173",
		summary: "Plan created",
		nextStep: "/implement",
		artifacts: [{ path: ".workflow/tasks/github-173/WORK.md", kind: "workflow-state" }],
		verification: [{ command: "node --test", status: "passed" }],
		blockers: ["Waiting for design review"],
		warnings: ["Stale main branch"],
		recovery: { action: "re-run with reset" },
	};

	const formatted = formatNochestraResult(result);
	assert.match(formatted, /Command: \/triage/);
	assert.match(formatted, /Task: github:173/);
	assert.match(formatted, /Status: ok/);
	assert.match(formatted, /Summary: Plan created/);
	assert.match(formatted, /Next step: \/implement/);
	assert.match(formatted, /Artifacts: \[\{"path":".workflow\/tasks\/github-173\/WORK.md","kind":"workflow-state"\}\]/);
	assert.match(formatted, /Verification: \[\{"command":"node --test","status":"passed"\}\]/);
	assert.match(formatted, /Blockers: \["Waiting for design review"\]/);
	assert.match(formatted, /Warnings: \["Stale main branch"\]/);
	assert.match(formatted, /Recovery: \{"action":"re-run with reset"\}/);
});

test("checkAndCompactParentContext performs automatic context epoch compaction when token budget is reached", () => {
	const repoDir = makeRepo();
	try {
		const transcript = [
			{ role: "user", content: "Initial query" },
			{ role: "assistant", content: "Initial response" },
			{ role: "user", content: "Second query" },
			{ role: "assistant", content: "Quarantined response 1" },
			{ role: "user", content: "Quarantined query 2" },
		];

		// Below threshold -> no compaction
		const noCompaction = checkAndCompactParentContext({
			cwd: repoDir,
			activeTokens: 2000,
			maxTokens: 4000,
			transcript,
		});
		assert.equal(noCompaction.compacted, false);

		// Over threshold -> automatic compaction
		const compaction = checkAndCompactParentContext({
			cwd: repoDir,
			activeTokens: 4500,
			maxTokens: 4000,
			transcript,
			quarantineWindowSize: 2,
		});

		assert.equal(compaction.compacted, true);
		assert.equal(compaction.epoch.epochId, "epoch-2");
		assert.equal(compaction.epoch.hotContext.recentTurns.length, 2);
		assert.deepEqual(compaction.epoch.hotContext.recentTurns, transcript.slice(3));
		assert.equal(compaction.epoch.coldArchive.archivedTurns.length, 3);
		assert.deepEqual(compaction.epoch.coldArchive.archivedTurns, transcript.slice(0, 3));

		// Checkpoint saved to disk and validated without transcript accumulation
		const checkpointOnDisk = readCheckpoint(path.join(repoDir, ".workflow", "nochestra-checkpoint.json"));
		assert.equal(checkpointOnDisk.subject, "Jira ABC-123");
		assert.equal("transcript" in checkpointOnDisk, false);
		assert.equal("messages" in checkpointOnDisk, false);
		assert.equal("history" in checkpointOnDisk, false);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});


test("dispatchNochestraInput handles full sequence: triage -> frame -> grill-with-docs -> plan -> implement -> verify -> sync", async () => {
	const repoDir = makeRepo();
	try {
		// 1. Triage
		const triageRes = await dispatchNochestraInput({ input: "/triage local:flow", cwd: repoDir });
		assert.equal(triageRes.status, "created");
		assert.equal(triageRes.nextStep, "/frame");

		// 2. Frame
		const frameRes = await dispatchNochestraInput({ input: "/frame", cwd: repoDir });
		assert.equal(frameRes.status, "ok");
		assert.equal(frameRes.nextStep, "/grill-with-docs");

		// 3. Grill
		const grillRes = await dispatchNochestraInput({ input: "/grill-with-docs", cwd: repoDir });
		assert.equal(grillRes.status, "ok");
		assert.equal(grillRes.nextStep, "/plan");

		// 4. Plan
		const planRes = await dispatchNochestraInput({ input: "/plan", cwd: repoDir });
		assert.equal(planRes.status, "ok");
		assert.equal(planRes.nextStep, "/implement");

		// 5. Implement
		const implRes = await dispatchNochestraInput({ input: "/implement", cwd: repoDir });
		assert.equal(implRes.status, "ok");
		assert.equal(implRes.nextStep, "/verify");

		// 6. Verify
		const verifyRes = await dispatchNochestraInput({ input: "/verify", cwd: repoDir });
		assert.equal(verifyRes.status, "ok");
		assert.equal(verifyRes.nextStep, "/sync");

		// 7. Sync
		const syncRes = await dispatchNochestraInput({ input: "/sync", cwd: repoDir });
		assert.equal(syncRes.status, "ok");
		assert.equal(syncRes.nextStep, "/post-merge-prune");
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput dispatches explicit note request and returns note artifact path", async () => {
	const repoDir = makeRepo();
	const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-parent-vault-"));
	const topic = "summarize Nochestra front door UX";
	const id = "summarize-nochestra-front-door-ux";

	try {
		const result = await dispatchNochestraInput({
			input: `note "${topic}"`,
			cwd: repoDir,
			vaultRoot: vaultDir,
		});

		assert.equal(result.kind, "delivery");
		assert.equal(result.command, "note");
		assert.equal(result.status, "created");
		assert.equal(result.taskId, `note-${id}`);
		assert.equal(result.nextStep, "review note");
		assert.equal(result.artifacts[0].kind, "obsidian-note");

		const formatted = formatNochestraResult(result);
		assert.match(formatted, /Command: \/note/);
		assert.match(formatted, /Task: note:summarize-nochestra-front-door-ux/);
		assert.match(formatted, /Status: created/);
		assert.match(formatted, /Next step: review note/);

		// Artifact isolation check: no RPIV task workspace created
		assert.equal(fs.existsSync(path.join(repoDir, ".workflow/tasks")), false);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
		fs.rmSync(vaultDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput dispatches explicit research request and returns research artifact path", async () => {
	const repoDir = makeRepo();
	const topic = "best way to test Nochestra routing";
	const id = "best-way-to-test-nochestra-routing";

	try {
		const result = await dispatchNochestraInput({
			input: `research "${topic}"`,
			cwd: repoDir,
		});

		assert.equal(result.kind, "delivery");
		assert.equal(result.command, "research");
		assert.deepEqual(result.task, { source: "research", id });
		assert.equal(result.status, "created");
		assert.equal(result.taskId, `research-${id}`);
		assert.equal(result.summary, `Research created for "${topic}"`);
		assert.equal(result.nextStep, "review research artifact");
		assert.deepEqual(result.artifacts, [{ path: `.workflow/research/${id}/RESEARCH.md`, kind: "research-artifact" }]);
		assert.ok(result.evidence);
		assert.equal(result.evidence.destination, "research");

		const formatted = formatNochestraResult(result);
		assert.match(formatted, /Command: \/research/);
		assert.match(formatted, /Task: research:best-way-to-test-nochestra-routing/);
		assert.match(formatted, /Status: created/);
		assert.match(formatted, /Next step: review research artifact/);
		assert.match(formatted, /RESEARCH\.md/);

		// Artifact isolation check: no RPIV task workspace created
		assert.equal(fs.existsSync(path.join(repoDir, `.workflow/research/${id}/RESEARCH.md`)), true);
		assert.equal(fs.existsSync(path.join(repoDir, ".workflow/tasks")), false);

		// Checkpoint verification: currentRoute preserved as discovery
		const checkpoint = readCheckpoint(path.join(repoDir, ".workflow/nochestra-checkpoint.json"));
		assert.equal(checkpoint.currentRoute, "discovery");
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("formatNochestraResult handles missing task property safely", () => {
	const formatted = formatNochestraResult({
		kind: "delivery",
		command: "note",
		status: "created",
		taskId: "note-123",
		summary: "Note created",
		nextStep: "review note",
	});
	assert.match(formatted, /Command: \/note/);
	assert.match(formatted, /Task: note-123/);
});

test("formatNochestraResult snapshots cover ok, blocked, failed, and cancelled states", () => {
	const okResult = formatNochestraResult({
		kind: "delivery",
		command: "triage",
		task: { source: "github", id: "173" },
		status: "ok",
		taskId: "github-173",
		summary: "Triage completed successfully",
		nextStep: "/frame",
		artifacts: [{ path: ".workflow/tasks/github-173/WORK.md", kind: "workflow-state" }],
	});
	assert.equal(okResult, [
		"Command: /triage",
		"Task: github:173",
		"Status: ok",
		"Summary: Triage completed successfully",
		"Next step: /frame",
		'Artifacts: [{"path":".workflow/tasks/github-173/WORK.md","kind":"workflow-state"}]',
	].join("\n"));

	const blockedResult = formatNochestraResult({
		kind: "delivery",
		command: "plan",
		task: { source: "github", id: "173" },
		status: "blocked",
		taskId: "github-173",
		summary: "Planning blocked by missing evidence",
		nextStep: "/grill-with-docs",
		blockers: ["Missing UI direct link"],
	});
	assert.equal(blockedResult, [
		"Command: /plan",
		"Task: github:173",
		"Status: blocked",
		"Summary: Planning blocked by missing evidence",
		"Next step: /grill-with-docs",
		'Blockers: ["Missing UI direct link"]',
	].join("\n"));

	const failedResult = formatNochestraResult({
		kind: "delivery",
		command: "implement",
		task: { source: "github", id: "173" },
		status: "failed",
		taskId: "github-173",
		summary: "Build execution failed",
		nextStep: "manual-fix",
		warnings: ["Compiler warning emitted"],
		recovery: { action: "re-run script" },
	});
	assert.equal(failedResult, [
		"Command: /implement",
		"Task: github:173",
		"Status: failed",
		"Summary: Build execution failed",
		"Next step: manual-fix",
		'Warnings: ["Compiler warning emitted"]',
		'Recovery: {"action":"re-run script"}',
	].join("\n"));

	const cancelledResult = formatNochestraResult({
		kind: "delivery",
		command: "triage",
		task: { source: "github", id: "173" },
		status: "cancelled",
		taskId: "github-173",
		summary: "Write dispatch cancelled by user",
		nextStep: "manual-takeover",
	});
	assert.equal(cancelledResult, [
		"Command: /triage",
		"Task: github:173",
		"Status: cancelled",
		"Summary: Write dispatch cancelled by user",
		"Next step: manual-takeover",
	].join("\n"));
});

test("dispatchNochestraInput handles checkpoint subcommands status, show, reset, prune, compact", async () => {
	const repoDir = makeRepo();

	try {
		// status
		const statusRes = await dispatchNochestraInput({ input: "checkpoint status", cwd: repoDir });
		assert.equal(statusRes.kind, "checkpoint");
		assert.equal(statusRes.subcommand, "status");
		assert.match(formatNochestraResult(statusRes), /Checkpoint: Jira ABC-123/);

		// show
		const showRes = await dispatchNochestraInput({ input: "checkpoint show", cwd: repoDir });
		assert.equal(showRes.kind, "checkpoint");
		assert.equal(showRes.subcommand, "show");
		assert.match(formatNochestraResult(showRes), /# Checkpoint: Jira ABC-123/);

		// prune with resolved/stale/duplicate open questions
		const checkpointPath = path.join(repoDir, ".workflow", "nochestra-checkpoint.json");
		const currentCheckpoint = readCheckpoint(checkpointPath);
		currentCheckpoint.openQuestions = [
			"What is the final storage path?",
			"resolved: answered in ADR 1",
			"stale: legacy question",
			"",
			"What is the final storage path?",
		];
		fs.writeFileSync(checkpointPath, JSON.stringify(currentCheckpoint, null, 2), "utf8");

		const pruneRes = await dispatchNochestraInput({ input: "checkpoint prune", cwd: repoDir });
		assert.equal(pruneRes.kind, "checkpoint");
		assert.equal(pruneRes.subcommand, "prune");
		assert.match(pruneRes.summary, /Pruned 4 open question\(s\)/);

		const updatedCheckpoint = readCheckpoint(checkpointPath);
		assert.deepEqual(updatedCheckpoint.openQuestions, ["What is the final storage path?"]);

		// compact
		const compactRes = await dispatchNochestraInput({ input: "checkpoint compact", cwd: repoDir });
		assert.equal(compactRes.kind, "checkpoint");
		assert.equal(compactRes.subcommand, "compact");
		assert.match(compactRes.summary, /Compacted parent epoch/);

		// reset
		const resetRes = await dispatchNochestraInput({ input: "checkpoint reset", cwd: repoDir });
		assert.equal(resetRes.kind, "checkpoint");
		assert.equal(resetRes.subcommand, "reset");
		assert.match(resetRes.summary, /Reset Nochestra checkpoint/);

		// missing subcommand or unknown subcommand throws clear usage error
		await assert.rejects(
			() => dispatchNochestraInput({ input: "checkpoint", cwd: repoDir }),
			/Unknown checkpoint subcommand: "". Usage: pi --nochestra checkpoint/
		);
		await assert.rejects(
			() => dispatchNochestraInput({ input: "checkpoint invalid", cwd: repoDir }),
			/Unknown checkpoint subcommand: "invalid". Usage: pi --nochestra checkpoint/
		);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("dispatchNochestraInput handles missing checkpoint for read-only subcommands", async () => {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nochestra-no-checkpoint-"));
	try {
		await assert.rejects(
			() => dispatchNochestraInput({ input: "checkpoint status", cwd: repoDir }),
			/No Nochestra checkpoint found/
		);
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});

test("resolveWorkerRemediation maps worker failure patterns and explicit recovery suggestions to remediation targets", () => {
	// Explicit recovery payload
	const explicit = resolveWorkerRemediation({
		status: "failed",
		summary: "Step failed",
		recovery: { recommendedWorker: "refine", rationale: "Refine specifications" },
	});
	assert.equal(explicit.recommendedWorker, "refine");

	// Pattern match test failure -> verify
	const testFail = resolveWorkerRemediation({
		status: "failed",
		summary: "Unit tests failed in test/parent-runtime.test.mjs",
		blockers: ["2 tests failing"],
	});
	assert.equal(testFail.recommendedWorker, "verify");

	// Pattern match missing evidence -> refine
	const evidenceFail = resolveWorkerRemediation({
		status: "blocked",
		summary: "Missing design spec and formula evidence",
		blockers: ["No formula truth table"],
	});
	assert.equal(evidenceFail.recommendedWorker, "refine");

	// Non-failure returns null
	assert.equal(resolveWorkerRemediation({ status: "ok", summary: "Success" }), null);
});

test("dispatchDeliveryCommand handles automated remediation proposal and interactive prompt gate", async () => {
	const repoDir = makeRepo();
	const workerRuntimePath = path.join(os.tmpdir(), `test-remediation-worker-${Date.now()}.cjs`);

	// Create mock worker runtime script that fails on first call but succeeds on remediation call
	fs.writeFileSync(
		workerRuntimePath,
		`
const fs = require('fs');
let handoff;
if (process.argv.includes('--handoff')) {
	const handoffPath = process.argv[process.argv.indexOf('--handoff') + 1];
	handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
}

if (handoff.assignment && handoff.assignment.includes('verify')) {
	process.stdout.write(JSON.stringify({
		status: 'ok',
		taskId: handoff.artifactSnapshot ? handoff.artifactSnapshot.id : '194',
		summary: 'Remediation verify worker succeeded',
		nextStep: '/implement',
	}) + '\\n');
} else {
	process.stdout.write(JSON.stringify({
		status: 'failed',
		taskId: '194',
		summary: 'Execution failed due to test failure',
		blockers: ['test/runtime.test.mjs assertion failed'],
		nextStep: '/plan',
	}) + '\\n');
}
`,
		"utf8"
	);

	try {
		let promptCalled = false;
		let receivedProposal = null;

		const result = await dispatchDeliveryCommand({
			parsed: parseNochestraInput("/implement github:194"),
			cwd: repoDir,
			workerRuntimePath,
			promptRemediation: async ({ proposal, result: origResult }) => {
				promptCalled = true;
				receivedProposal = proposal;
				return "retry";
			},
		});

		assert.equal(promptCalled, true);
		assert.equal(receivedProposal.recommendedWorker, "verify");
		assert.equal(result.status, "ok");
		assert.equal(result.summary, "Remediation verify worker succeeded");

		const checkpoint = readCheckpoint(path.join(repoDir, ".workflow", "nochestra-checkpoint.json"));
		assert.ok(checkpoint.decisions.some((d) => d.includes("Accepted remediation retry")));
	} finally {
		fs.rmSync(workerRuntimePath, { force: true });
		fs.rmSync(repoDir, { recursive: true, force: true });
	}
});


