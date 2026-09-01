import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { readCheckpoint, writeCheckpoint } from "../adapters/checkpoint.mjs";
import { parseNochestraInput, slugifyTopic } from "../domain/delivery-command.mjs";
import { resolveWriteScope } from "../domain/write-scope-policy.mjs";
import { extractOptionalWorkerResultFields } from "../domain/handoff-contract.mjs";
import { buildBoundedHandoff } from "./executor-dispatch.mjs";
import { spawnWorkerProcess } from "../adapters/process-runner.mjs";

const DEFAULT_WORKER_RUNTIME_PATH = process.env.NOCH_WORKER_RUNTIME_PATH || fileURLToPath(new URL("./worker-runtime.mjs", import.meta.url));
const DEFAULT_CHECKPOINT_PATH = process.env.NOCH_CHECKPOINT_PATH || path.join(".workflow", "nochestra-checkpoint.json");
const DELIVERY_CONTEXT_BUDGET = { maxTokens: 4000, maxTurns: 4 };

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
	return { source: task.source, id: task.id, mode: parsed.args[0] || "auto" };
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

function checkpointWithWorkerResult(checkpoint, result) {
	const decision = `${result.taskId || "Worker"} ${result.status}: ${result.summary}`;
	const decisions = checkpoint.decisions.includes(decision)
		? checkpoint.decisions
		: [...checkpoint.decisions, decision];

	const newBlockers = (result.blockers || [])
		.map((b) => (typeof b === "string" ? b : JSON.stringify(b)))
		.filter((b) => !checkpoint.openQuestions.includes(b));

	return {
		...checkpoint,
		decisions,
		openQuestions: [...checkpoint.openQuestions, ...newBlockers],
		currentRoute: checkpoint.currentRoute || "delivery",
		suggestedNextRoute: result.nextStep || checkpoint.suggestedNextRoute,
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

function activeWorkflowSnapshot(active) {
	return active ? {
		id: active.id,
		taskPath: active.taskPath,
		stateFile: active.stateFile,
		branch: active.branch,
	} : null;
}

export function buildDeliveryHandoff({ parsed, checkpoint, active }) {
	const task = resolveDeliveryTask(parsed, active);
	if (parsed.command === "research") {
		const base = buildBoundedHandoff({
			assignment: `Run research for "${task.topic || task.id}"`,
			checkpoint,
			artifactSnapshot: {
				...task,
				activeWorkflow: activeWorkflowSnapshot(active),
			},
			contextBudget: DELIVERY_CONTEXT_BUDGET,
			selectedSkills: ["research"],
			permissions: ["write-checkout"],
		});

		return {
			...base,
			destination: "research",
			artifact: {
				...task,
				stateFile: active?.workflow === "research" ? active.stateFile : null,
			},
		};
	}
	if (parsed.command === "note") {
		const base = buildBoundedHandoff({
			assignment: `Run note for "${task.topic || task.id}"`,
			checkpoint,
			artifactSnapshot: {
				...task,
				activeWorkflow: activeWorkflowSnapshot(active),
			},
			contextBudget: DELIVERY_CONTEXT_BUDGET,
			selectedSkills: ["distill"],
			permissions: ["write-checkout"],
		});

		return {
			...base,
			destination: "note",
			artifact: {
				...task,
				stateFile: active?.workflow === "notes" ? active.stateFile : null,
			},
		};
	}

	const base = buildBoundedHandoff({
		assignment: `Run ${parsed.command} for ${task.source}:${task.id}`,
		checkpoint,
		artifactSnapshot: {
			...task,
			activeWorkflow: activeWorkflowSnapshot(active),
		},
		contextBudget: DELIVERY_CONTEXT_BUDGET,
		selectedSkills: [parsed.command],
		permissions: ["write-checkout"],
	});

	return {
		...base,
		destination: parsed.command,
		artifact: {
			...task,
			stateFile: active?.stateFile ?? null,
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

export async function dispatchDeliveryCommand({ parsed, cwd = process.cwd(), workerRuntimePath = DEFAULT_WORKER_RUNTIME_PATH, checkpointPath = DEFAULT_CHECKPOINT_PATH, approveWriteDispatch = null, vaultRoot = null } = {}) {
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
	const handoff = buildDeliveryHandoff({ parsed, ...context });
	const env = vaultRoot ? { ...process.env, NOCH_VAULT_ROOT: vaultRoot } : process.env;
	const result = await spawnWorkerProcess({
		handoff,
		command: process.execPath,
		args: [workerRuntimePath],
		cwd,
		env,
		approveWriteDispatch: approveAndPersistCheckpoint,
	});
	const compact = compactDeliveryResult(parsed, result, task);
	if (result.status !== "cancelled") {
		writeDeliveryCheckpoint(cwd, checkpointPath, checkpointWithWorkerResult(context.checkpoint, result));
	}
	return compact;
}

export async function dispatchNochestraInput(options = {}) {
	const parsed = parseNochestraInput(options.input);
	if (parsed.kind === "delivery-error") {
		throw new Error(parsed.error);
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
	const commandLabel = result.command.startsWith("/") ? result.command : `/${result.command}`;
	const lines = [
		`Command: ${commandLabel}`,
		`Task: ${result.task.source}:${result.task.id}`,
		`Status: ${result.status}`,
		`Summary: ${result.summary}`,
		`Next step: ${result.nextStep}`,
	];
	for (const key of ["artifacts", "verification", "blockers", "warnings", "recovery"]) {
		if (result[key] !== undefined && result[key] !== null) {
			const label = key[0].toUpperCase() + key.slice(1);
			lines.push(`${label}: ${JSON.stringify(result[key])}`);
		}
	}
	return lines.join("\n");
}

export async function runNochestraParent(args = process.argv.slice(2), options = {}) {
	return dispatchNochestraInput({
		input: args,
		...options,
		approveWriteDispatch: options.approveWriteDispatch ?? ((request) => promptForWriteDispatch(request, options)),
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
