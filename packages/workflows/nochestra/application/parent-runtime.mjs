import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { readCheckpoint, writeCheckpoint } from "../adapters/checkpoint.mjs";
import { parseNochestraInput, slugifyTopic } from "../domain/delivery-command.mjs";
import { resolveWriteScope } from "../domain/write-scope-policy.mjs";
import { resolveModelTier, resolveModelOverride } from "../domain/model-tier-policy.mjs";
import { extractOptionalWorkerResultFields } from "../domain/handoff-contract.mjs";
import { buildBoundedHandoff } from "./executor-dispatch.mjs";
import { spawnWorkerProcess } from "../adapters/process-runner.mjs";
import { shouldCompactParentEpoch, compactParentEpoch } from "./parent-epoch.mjs";

const DEFAULT_WORKER_RUNTIME_PATH = process.env.NOCH_WORKER_RUNTIME_PATH || fileURLToPath(new URL("./worker-runtime.mjs", import.meta.url));
const DEFAULT_CHECKPOINT_PATH = process.env.NOCH_CHECKPOINT_PATH || path.join(".workflow", "nochestra-checkpoint.json");
const DELIVERY_CONTEXT_BUDGET = { maxTokens: 4000, maxTurns: 4 };

function deliveryPermissions(command) {
	return command === "research" ? ["read-only"] : ["write-checkout"];
}

function deliveryWorkspaceAccess(command) {
	return command === "research" ? "read-only" : "write-checkout";
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readActiveWorkflow(cwd) {
	const activePath = path.join(cwd, ".workflow", "active.json");
	return fs.existsSync(activePath) ? readJson(activePath) : null;
}

const TASK_RESOLVERS = [
	(parsed) => (parsed.task?.source && parsed.task?.id ? { source: parsed.task.source, id: parsed.task.id } : null),
	(_, active) => (active?.source && active?.sourceId ? { source: active.source, id: active.sourceId } : null),
	(_, active) => (active?.id?.includes("-") ? { source: active.id.split("-")[0], id: active.id.split("-").slice(1).join("-") } : null),
];

function resolveDeliveryTask(parsed, active) {
	if (parsed.command === "research") {
		const topic = parsed.topic || (parsed.args ? parsed.args.join(" ") : "");
		const id = parsed.task?.id || slugifyTopic(topic);
		return { source: "research", id, topic, mode: "auto" };
	}
	if (parsed.command === "note") {
		const topic = parsed.topic || (parsed.args ? parsed.args.join(" ") : "");
		const id = parsed.task?.id || slugifyTopic(topic);
		return { source: "note", id, topic, mode: "auto" };
	}
	const task = TASK_RESOLVERS.map((resolve) => resolve(parsed, active)).find(Boolean);
	if (!task) {
		throw new Error(`Command /${parsed.command} requires an active RPIV task in .workflow/active.json or an explicit source:id target.`);
	}
	return { source: task.source, id: task.id, mode: parsed.args?.[0] || "auto" };
}

function defaultCheckpointForTask(parsed, active = null) {
	const task = resolveDeliveryTask(parsed, active);
	if (parsed.command === "research") {
		return {
			subject: `research:${task.id}`,
			goal: `Research ${task.topic || task.id}`,
			decisions: [],
			constraints: [
				"Preserve existing workflow rules",
				"Isolated research artifact under .workflow/research/",
			],
			openQuestions: [],
			rejectedOptions: [],
			currentRoute: "discovery",
			suggestedNextRoute: "review research artifact",
		};
	}
	if (parsed.command === "note") {
		return {
			subject: `note:${task.id}`,
			goal: `Write note for ${task.topic || task.id}`,
			decisions: [],
			constraints: [
				"Preserve existing workflow rules",
				"Only approved vault paths are writable",
			],
			openQuestions: [],
			rejectedOptions: [],
			currentRoute: "notes",
			suggestedNextRoute: "review note",
		};
	}
	return {
		subject: `${task.source}:${task.id}`,
		goal: `Run ${parsed.command} for ${task.source}:${task.id}`,
		decisions: [],
		constraints: [
			"Preserve existing workflow rules",
			"Do not copy raw tracker output into workflow state",
		],
		openQuestions: [],
		rejectedOptions: [],
		currentRoute: "delivery",
		suggestedNextRoute: parsed.command,
	};
}

function readDeliveryCheckpoint(cwd, checkpointPath = DEFAULT_CHECKPOINT_PATH, parsed = null, active = null) {
	const resolved = path.resolve(cwd, checkpointPath);
	const checkpoint = fs.existsSync(resolved)
		? readCheckpoint(resolved)
		: parsed
		? defaultCheckpointForTask(parsed, active)
		: null;

	if (!checkpoint) {
		throw new Error(`No Nochestra checkpoint found at ${checkpointPath}`);
	}
	return checkpoint;
}

function writeDeliveryCheckpoint(cwd, checkpointPath, checkpoint) {
	const resolved = path.resolve(cwd, checkpointPath);
	fs.mkdirSync(path.dirname(resolved), { recursive: true });
	writeCheckpoint(resolved, checkpoint);
}

function checkpointWithWorkerResult(checkpoint, result, parsed = null) {
	const decision = `${result.taskId || "Worker"} ${result.status}: ${result.summary}`;
	const decisions = checkpoint.decisions.includes(decision)
		? checkpoint.decisions
		: [...checkpoint.decisions, decision];

	const newBlockers = (result.blockers || [])
		.map((b) => (typeof b === "string" ? b : JSON.stringify(b)))
		.filter((b) => !checkpoint.openQuestions.includes(b));

	const recoveryQuestion = result.recovery
		? `Recovery proposed for ${result.taskId || "Worker"}: ${typeof result.recovery === "string" ? result.recovery : JSON.stringify(result.recovery)}`
		: null;
	const openQuestions = (recoveryQuestion && !checkpoint.openQuestions.includes(recoveryQuestion))
		? [...checkpoint.openQuestions, ...newBlockers, recoveryQuestion]
		: [...checkpoint.openQuestions, ...newBlockers];

	const quarantineEfficiency = result?.evidence?.quarantineEfficiencyRatio != null
		? {
			lastSavingsBytes: result.evidence.quarantineSavingsBytes ?? 0,
			lastHandoffBytes: result.evidence.handoffBytes ?? 0,
			lastParentPromptBytes: result.evidence.parentPromptBytes ?? 0,
			lastRatio: result.evidence.quarantineEfficiencyRatio ?? 0,
		}
		: checkpoint.quarantineEfficiency ?? null;

	return {
		...checkpoint,
		decisions,
		openQuestions,
		currentRoute: parsed?.route || checkpoint.currentRoute || "delivery",
		suggestedNextRoute: result.nextStep || checkpoint.suggestedNextRoute,
		...(quarantineEfficiency ? { quarantineEfficiency } : {}),
		...(result.recovery !== undefined ? { recovery: result.recovery } : {}),
	};
}

export function loadDeliveryContext({ cwd = process.cwd(), checkpointPath = DEFAULT_CHECKPOINT_PATH, parsed = null } = {}) {
	const active = readActiveWorkflow(cwd);
	return {
		active,
		checkpoint: readDeliveryCheckpoint(cwd, checkpointPath, parsed, active),
	};
}

export function checkAndCompactParentContext(opts = {}) {
	const cwd = opts.cwd || process.cwd();
	const checkpointPath = opts.checkpointPath || DEFAULT_CHECKPOINT_PATH;
	const parsed = opts.parsed || null;

	const context = loadDeliveryContext({ cwd, checkpointPath, parsed });
	const shouldCompact = shouldCompactParentEpoch(opts);

	if (!shouldCompact) {
		return { compacted: false, context };
	}

	writeDeliveryCheckpoint(cwd, checkpointPath, context.checkpoint);

	const transition = compactParentEpoch({
		currentEpochId: opts.currentEpochId || "epoch-1",
		checkpoint: context.checkpoint,
		instructions: opts.instructions || "",
		transcript: opts.transcript || [],
		quarantineWindowSize: opts.quarantineWindowSize ?? 2,
		currentApprovals: opts.currentApprovals || [],
		taskMaterial: opts.taskMaterial || {},
		contextSnapshot: opts.activeTokens ? { activeTokens: opts.activeTokens } : null,
	});

	return {
		compacted: true,
		epoch: transition,
		checkpointPath,
		context: {
			...context,
			checkpoint: transition.hotContext.checkpoint,
		},
	};
}

function activeWorkflowSnapshot(active) {
	return active ? {
		id: active.id,
		taskPath: active.taskPath,
		stateFile: active.stateFile,
		branch: active.branch,
	} : null;
}

export function buildDeliveryHandoff({ parsed, checkpoint, active, env }) {
	const task = resolveDeliveryTask(parsed, active);
	let destination = parsed.command;
	let selectedSkill = parsed.command;
	if (parsed.command === "research") {
		destination = "research";
		selectedSkill = "research";
	} else if (parsed.command === "note") {
		destination = "note";
		selectedSkill = "distill";
	}

	const { model: stageModel } = resolveModelTier(destination, { env });
	const overrideModel = resolveModelOverride(parsed.requestedModel);
	if (parsed.requestedModel && !overrideModel) {
		throw new Error(`Which model did you mean by "${parsed.requestedModel}"? Use an exact catalog model or known shortcut (for example: ornith, 3.6-flash, sonnet, opus, gpt-5.4-mini).`);
	}
	const model = overrideModel || stageModel;

	const base = buildBoundedHandoff({
		assignment: parsed.command === "research"
			? `Run research for "${task.topic || task.id}"`
			: parsed.command === "note"
			? `Run note for "${task.topic || task.id}"`
			: `Run ${parsed.command} for ${task.source}:${task.id}`,
		checkpoint,
		artifactSnapshot: {
			...task,
			activeWorkflow: activeWorkflowSnapshot(active),
		},
		contextBudget: DELIVERY_CONTEXT_BUDGET,
		selectedSkills: [selectedSkill],
		permissions: deliveryPermissions(parsed.command),
		workspaceAccess: deliveryWorkspaceAccess(parsed.command),
		model,
	});

	return {
		...base,
		destination,
		artifact: {
			...task,
			stateFile: parsed.command === "research"
				? (active?.workflow === "research" ? active.stateFile : null)
				: parsed.command === "note"
				? (active?.workflow === "notes" ? active.stateFile : null)
				: (active?.stateFile ?? null),
		},
	};
}

export const buildNochestraDeliveryHandoff = buildDeliveryHandoff;

function compactDeliveryResult(parsed, result, contextTask = null) {
	return {
		kind: "delivery",
		command: parsed.command,
		task: parsed.task || contextTask,
		status: result.status,
		taskId: result.taskId,
		summary: result.summary,
		nextStep: result.nextStep,
		...extractOptionalWorkerResultFields(result),
	};
}

export function resolveWorkerRemediation(result) {
	if (!result || (result.status !== "failed" && result.status !== "blocked")) {
		return null;
	}

	const explicitWorker = typeof result.recovery === "object" && result.recovery !== null
		? (result.recovery.recommendedWorker || result.recovery.action || result.recovery.destination)
		: (typeof result.recovery === "string" ? result.recovery : null);

	if (explicitWorker) {
		const clean = String(explicitWorker).toLowerCase().replace(/^\//, "");
		return {
			recommendedWorker: clean,
			remediationCommand: `/${clean}`,
			rationale: result.recovery?.rationale || `Explicit recovery requested: ${clean}`,
		};
	}

	const text = [
		result.summary || "",
		...(Array.isArray(result.blockers) ? result.blockers : []),
		typeof result.recovery === "string" ? result.recovery : "",
	].join(" ").toLowerCase();

	let recommendedWorker = "verify";
	let rationale = "Default remediation worker on failure";

	if (/test|assert|verification|verify|check|fail/i.test(text)) {
		recommendedWorker = "verify";
		rationale = "Test failure or verification gap detected";
	} else if (/evidence|spec|design|formula/i.test(text)) {
		recommendedWorker = "refine";
		rationale = "Missing evidence or specification gap detected";
	} else if (/brief|intake|framing|goal/i.test(text)) {
		recommendedWorker = "frame";
		rationale = "Framing or intake issue detected";
	}

	return {
		recommendedWorker,
		remediationCommand: `/${recommendedWorker}`,
		rationale,
	};
}

export function formatRemediationPrompt({ result, proposal, task }) {
	const taskLabel = task ? `${task.source}:${task.id}` : (result.taskId || "unknown");
	const blockersText = (result.blockers || []).map((b) => `- ${b}`).join("\n");
	return [
		`Worker ${result.status.toUpperCase()} for task ${taskLabel}: ${result.summary}`,
		...(blockersText ? ["Blockers:", blockersText] : []),
		`Proposed remediation: Retry with worker '/${proposal.recommendedWorker}' (${proposal.rationale})`,
		"Options: [R]etry with remediation worker, [S]kip to manual, [C]ancel",
	].join("\n");
}

export async function promptForRemediation(proposalContext, { input = process.stdin, output = process.stderr } = {}) {
	const rl = readline.createInterface({ input, output });
	try {
		const answer = await rl.question(`${formatRemediationPrompt(proposalContext)}\nChoice [R/s/c]: `);
		const trimmed = answer.trim().toLowerCase();
		if (trimmed === "s" || trimmed === "skip") return "skip";
		if (trimmed === "c" || trimmed === "cancel") return "cancel";
		return "retry";
	} finally {
		rl.close();
	}
}

export function formatWriteApprovalPrompt({ assignment, destination, permissions = [], writeScope = null, requiresWriteLock = false, task = null } = {}) {
	const scope = writeScope ?? resolveWriteScope({ destination, assignment, task });

	if (scope) {
		const canLines = scope.canChange.map((item) => `- ${item}`).join("\n");
		const willNotLines = scope.willNot.map((item) => `- ${item}`).join("\n");
		return [
			"Approve write-capable Nochestra dispatch?",
			`Task: ${assignment || "Unknown task"}`,
			"Can change:",
			canLines,
			"Will not:",
			willNotLines,
			...(requiresWriteLock ? ["Other write workers will be paused while this runs"] : []),
		].join("\n");
	}

	const canChange = Array.isArray(permissions) ? permissions.join(", ") : String(permissions || "");
	return [
		"Approve write-capable Nochestra dispatch?",
		`Task: ${assignment || "Unknown task"}`,
		`Will run: ${destination || "worker"}`,
		`Can change: ${canChange || "unspecified write target"}`,
		...(requiresWriteLock ? ["Other write workers will be paused while this runs"] : []),
	].join("\n");
}

export async function promptForWriteDispatch(request, { input = process.stdin, output = process.stderr } = {}) {
	const rl = readline.createInterface({ input, output });
	try {
		const answer = await rl.question(`${formatWriteApprovalPrompt(request)}\nApprove? [y/N] `);
		return /^y(es)?$/i.test(answer.trim());
	} finally {
		rl.close();
	}
}

export async function dispatchDeliveryCommand({ parsed, cwd = process.cwd(), workerRuntimePath = DEFAULT_WORKER_RUNTIME_PATH, checkpointPath = DEFAULT_CHECKPOINT_PATH, approveWriteDispatch = null, promptRemediation = null, vaultRoot = null, checkProviderAvailable = null, isRemediationRetry = false, parentPromptBytes = null, showStartLog = true } = {}) {
	const context = loadDeliveryContext({ cwd, checkpointPath, parsed });
	const task = resolveDeliveryTask(parsed, context.active);
	let checkpointPersisted = false;
	const approveAndPersistCheckpoint = async (request) => {
		const approved = typeof approveWriteDispatch === "function" ? await approveWriteDispatch(request) : true;
		const ok = approved === true || approved?.approved === true || approved?.userAction === "approve";
		if (ok && !checkpointPersisted) {
			writeDeliveryCheckpoint(cwd, checkpointPath, context.checkpoint);
			checkpointPersisted = true;
		}
		return approved;
	};

	const env = vaultRoot ? { ...process.env, NOCH_VAULT_ROOT: vaultRoot } : process.env;
	const handoff = buildDeliveryHandoff({ parsed, ...context, env });
	const { fallbackModel: stageFallback } = resolveModelTier(handoff.destination, { env });
	const { fallbackModel: defaultCloudFallback } = resolveModelTier("triage", { env });
	const configuredLocalProvider = env.NOCH_LOCAL_PROVIDER || "ollama";
	const isLocalTarget = handoff.model?.provider === configuredLocalProvider || handoff.model?.provider === "ollama" || handoff.model?.provider === "local";
	const fallbackModel = (isLocalTarget || !stageFallback) ? defaultCloudFallback : stageFallback;

	const effectiveParentPromptBytes = parentPromptBytes ?? (
		(context.checkpoint ? Buffer.byteLength(JSON.stringify(context.checkpoint), "utf8") : 0) +
		(context.active ? Buffer.byteLength(JSON.stringify(context.active), "utf8") : 0)
	);

	const result = await spawnWorkerProcess({
		handoff,
		command: process.execPath,
		args: [workerRuntimePath],
		cwd,
		env,
		fallbackModel,
		checkProviderAvailable,
		approveWriteDispatch: approveAndPersistCheckpoint,
		parentPromptBytes: effectiveParentPromptBytes,
		showStartLog,
	});

	if ((result.status === "failed" || result.status === "blocked") && !isRemediationRetry) {
		const proposal = resolveWorkerRemediation(result);
		if (proposal) {
			result.recovery = {
				...proposal,
				...(typeof result.recovery === "object" ? result.recovery : {}),
			};

			const promptFn = promptRemediation ?? (process.stdin.isTTY ? promptForRemediation : null);
			if (promptFn) {
				const choiceRaw = await promptFn({ result, proposal, parsed, task });
				const choice = typeof choiceRaw === "string" ? choiceRaw.toLowerCase() : choiceRaw?.choice || "skip";

				if (choice === "retry" || choice === "r") {
					const remediationParsed = parseNochestraInput(`/${proposal.recommendedWorker} ${task.source}:${task.id}`);
					const remediationContext = loadDeliveryContext({ cwd, checkpointPath, parsed: remediationParsed });
					remediationContext.checkpoint.constraints = [
						...remediationContext.checkpoint.constraints,
						`Failure remediation context: previous worker ${result.taskId || parsed.command} returned status '${result.status}'. Summary: ${result.summary}. Blockers: ${(result.blockers || []).join("; ")}`,
					];
					remediationContext.checkpoint.decisions = [
						...remediationContext.checkpoint.decisions,
						`Accepted remediation retry with worker /${proposal.recommendedWorker} following status '${result.status}'`,
					];
					writeDeliveryCheckpoint(cwd, checkpointPath, remediationContext.checkpoint);

					return dispatchDeliveryCommand({
						parsed: remediationParsed.kind === "delivery" ? remediationParsed : parsed,
						cwd,
						workerRuntimePath,
						checkpointPath,
						approveWriteDispatch,
						promptRemediation: null,
						vaultRoot,
						checkProviderAvailable,
						isRemediationRetry: true,
						showStartLog,
					});
				} else if (choice === "cancel" || choice === "c") {
					const cancelledResult = {
						kind: "delivery",
						command: parsed.command,
						task,
						status: "cancelled",
						taskId: result.taskId || task.id,
						summary: `Worker dispatch cancelled by user at remediation gate for /${parsed.command}`,
						nextStep: parsed.command,
						recovery: { ...result.recovery, actionTaken: "cancelled" },
					};
					return cancelledResult;
				} else {
					result.recovery = { ...result.recovery, actionTaken: "skipped" };
				}
			}
		}
	}

	const compact = compactDeliveryResult(parsed, result, task);
	if (result.status !== "cancelled") {
		writeDeliveryCheckpoint(cwd, checkpointPath, checkpointWithWorkerResult(context.checkpoint, result, parsed));
	}
	return compact;
}

export function handleCheckpointCommand({ parsed, cwd = process.cwd(), checkpointPath = DEFAULT_CHECKPOINT_PATH, options = {} } = {}) {
	const subcommand = parsed.subcommand ? parsed.subcommand.toLowerCase() : null;
	const resolvedPath = path.resolve(cwd, checkpointPath);

	const validSubcommands = new Set(["status", "show", "compact", "reset", "prune"]);
	if (!subcommand || !validSubcommands.has(subcommand)) {
		throw new Error(`Unknown checkpoint subcommand: "${parsed.subcommand || ""}". Usage: pi --nochestra checkpoint [status|show|compact|reset|prune]`);
	}

	if (subcommand === "reset") {
		const active = readActiveWorkflow(cwd);
		const newCheckpoint = active
			? defaultCheckpointForTask({ command: "triage" }, active)
			: {
					subject: "nochestra:session",
					goal: "Interactive session",
					decisions: [],
					constraints: ["Preserve existing workflow rules"],
					openQuestions: [],
					rejectedOptions: [],
					currentRoute: "chat",
					suggestedNextRoute: "triage",
			  };
		writeDeliveryCheckpoint(cwd, checkpointPath, newCheckpoint);
		return {
			kind: "checkpoint",
			subcommand: "reset",
			checkpointPath: resolvedPath,
			checkpoint: newCheckpoint,
			summary: `Reset Nochestra checkpoint at ${checkpointPath} (${newCheckpoint.subject})`,
		};
	}

	const active = readActiveWorkflow(cwd);
	const checkpoint = readDeliveryCheckpoint(cwd, checkpointPath, null, active);

	if (subcommand === "status") {
		const qEff = checkpoint.quarantineEfficiency;
		const efficiencyText = qEff
			? `Quarantine efficiency: ${(qEff.lastRatio * 100).toFixed(1)}% (saved ${qEff.lastSavingsBytes}B)`
			: "Quarantine efficiency: N/A";
		return {
			kind: "checkpoint",
			subcommand: "status",
			checkpointPath: resolvedPath,
			checkpoint,
			summary: `Checkpoint: ${checkpoint.subject} | Route: ${checkpoint.currentRoute} -> ${checkpoint.suggestedNextRoute} | Decisions: ${checkpoint.decisions.length}, Constraints: ${checkpoint.constraints.length}, Open questions: ${checkpoint.openQuestions.length}, Rejected options: ${checkpoint.rejectedOptions.length} | ${efficiencyText}`,
		};
	}

	if (subcommand === "show") {
		const formatList = (items) => (items && items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "_None_");
		const text = [
			`# Checkpoint: ${checkpoint.subject}`,
			"",
			`**Goal**: ${checkpoint.goal}`,
			`**Route**: ${checkpoint.currentRoute} -> ${checkpoint.suggestedNextRoute}`,
			"",
			"## Decisions",
			formatList(checkpoint.decisions),
			"",
			"## Constraints",
			formatList(checkpoint.constraints),
			"",
			"## Open Questions",
			formatList(checkpoint.openQuestions),
			"",
			"## Rejected Options",
			formatList(checkpoint.rejectedOptions),
		].join("\n");

		return {
			kind: "checkpoint",
			subcommand: "show",
			checkpointPath: resolvedPath,
			checkpoint,
			text,
			summary: text,
		};
	}

	if (subcommand === "prune") {
		const seen = new Set();
		const newOpenQuestions = [];
		for (const q of checkpoint.openQuestions || []) {
			const trimmed = String(q || "").trim();
			if (!trimmed) continue;
			const lower = trimmed.toLowerCase();
			if (lower.startsWith("resolved:") || lower.startsWith("stale:")) continue;
			if (!seen.has(trimmed)) {
				seen.add(trimmed);
				newOpenQuestions.push(trimmed);
			}
		}

		const beforeCount = checkpoint.openQuestions.length;
		const prunedCount = beforeCount - newOpenQuestions.length;
		const updatedCheckpoint = {
			...checkpoint,
			openQuestions: newOpenQuestions,
		};

		if (prunedCount > 0) {
			writeDeliveryCheckpoint(cwd, checkpointPath, updatedCheckpoint);
		}

		return {
			kind: "checkpoint",
			subcommand: "prune",
			checkpointPath: resolvedPath,
			checkpoint: updatedCheckpoint,
			summary: prunedCount > 0
				? `Pruned ${prunedCount} open question(s) from checkpoint at ${checkpointPath}`
				: `No open questions pruned from checkpoint at ${checkpointPath}`,
		};
	}

	if (subcommand === "compact") {
		const transition = compactParentEpoch({
			currentEpochId: options.currentEpochId || "epoch-1",
			checkpoint,
			instructions: options.instructions || "",
			transcript: options.transcript || [],
			quarantineWindowSize: options.quarantineWindowSize ?? 2,
			currentApprovals: options.currentApprovals || [],
			taskMaterial: options.taskMaterial || {},
			contextSnapshot: options.activeTokens ? { activeTokens: options.activeTokens } : null,
		});

		writeDeliveryCheckpoint(cwd, checkpointPath, transition.hotContext.checkpoint);

		return {
			kind: "checkpoint",
			subcommand: "compact",
			checkpointPath: resolvedPath,
			checkpoint: transition.hotContext.checkpoint,
			epoch: transition,
			summary: `Compacted parent epoch (${transition.previousEpochId} -> ${transition.epochId}) for checkpoint at ${checkpointPath}`,
		};
	}
}

export async function dispatchNochestraInput(options = {}) {
	const parsed = parseNochestraInput(options.input);
	if (parsed.kind === "delivery-error") {
		throw new Error(parsed.error);
	}
	if (parsed.kind === "checkpoint") {
		return handleCheckpointCommand({ ...options, parsed });
	}
	if (parsed.kind === "delivery") {
		return dispatchDeliveryCommand({ ...options, parsed });
	}
	return { kind: "chat", prompt: parsed.prompt };
}

export function formatNochestraResult(result) {
	if (result.kind === "chat") {
		return result.prompt;
	}
	if (result.kind === "checkpoint") {
		return result.subcommand === "show" ? result.text : result.summary;
	}
	const commandLabel = result.command ? (result.command.startsWith("/") ? result.command : `/${result.command}`) : "/command";
	const taskLabel = result.task ? `${result.task.source}:${result.task.id}` : (result.taskId || "unknown");
	const ev = result.evidence;
	const modelLabel = ev?.provider && ev?.model ? `${ev.provider}/${ev.model}` : "worker";
	const firstArtifact = Array.isArray(result.artifacts) && result.artifacts.length > 0 ? result.artifacts[0].path : null;
	const artifactLabel = firstArtifact ? path.basename(firstArtifact) : "WORK.md";
	const nextStepLabel = result.nextStep ? ` → Next: ${result.nextStep}` : "";
	const status = result.status || "done";
	const statusIcon = (status === "created" || status === "ok" || status === "resumed") ? "✔" : "✖";

	const powerline = `${statusIcon} NOCHESTRA ▶ ${taskLabel} ▶ ${commandLabel} ▶ 🤖 ${modelLabel} ▶ [${artifactLabel}] ▶ ${status}${nextStepLabel}`;

	const extraLines = [];
	for (const key of ["verification", "blockers", "warnings", "recovery"]) {
		if (result[key] !== undefined && result[key] !== null) {
			const label = key[0].toUpperCase() + key.slice(1);
			extraLines.push(`${label}: ${JSON.stringify(result[key])}`);
		}
	}

	return extraLines.length > 0 ? `${powerline}\n${extraLines.join("\n")}` : powerline;
}

export async function runNochestraParent(args = process.argv.slice(2), options = {}) {
	return dispatchNochestraInput({
		input: args,
		...options,
		approveWriteDispatch: options.approveWriteDispatch ?? ((request) => promptForWriteDispatch(request, options)),
		promptRemediation: options.promptRemediation ?? ((context) => promptForRemediation(context, options)),
	});
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entryPath) {
	runNochestraParent()
		.then((result) => {
			process.stdout.write(`${formatNochestraResult(result)}\n`);
		})
		.catch((error) => {
			process.stderr.write(`${error.message}\n`);
			process.exitCode = 1;
		});
}
