import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { readCheckpoint, writeCheckpoint } from "../adapters/checkpoint.mjs";
import { parseNochestraInput } from "../domain/delivery-command.mjs";
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

function resolveDeliveryTask(parsed, active) {
	if (parsed.task?.source && parsed.task?.id) {
		return {
			source: parsed.task.source,
			id: parsed.task.id,
			mode: parsed.args[0] || "auto",
		};
	}
	if (active?.source && active?.sourceId) {
		return {
			source: active.source,
			id: active.sourceId,
			mode: parsed.args[0] || "auto",
		};
	}
	if (active?.id) {
		const parts = active.id.split("-");
		if (parts.length >= 2) {
			return {
				source: parts[0],
				id: parts.slice(1).join("-"),
				mode: parsed.args[0] || "auto",
			};
		}
	}
	throw new Error(`Command /${parsed.command} requires an active RPIV task in .workflow/active.json or an explicit source:id target.`);
}

function defaultCheckpointForTask(parsed, active = null) {
	const task = resolveDeliveryTask(parsed, active);
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
	if (fs.existsSync(resolved)) {
		return readCheckpoint(resolved);
	}
	if (!parsed) {
		throw new Error(`No Nochestra checkpoint found at ${checkpointPath}`);
	}
	return defaultCheckpointForTask(parsed, active);
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

	let openQuestions = checkpoint.openQuestions;
	if (Array.isArray(result.blockers) && result.blockers.length > 0) {
		for (const blocker of result.blockers) {
			const text = typeof blocker === "string" ? blocker : JSON.stringify(blocker);
			if (!openQuestions.includes(text)) {
				openQuestions = [...openQuestions, text];
			}
		}
	}

	return {
		...checkpoint,
		decisions,
		openQuestions,
		currentRoute: "delivery",
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

function deliveryTask(parsed) {
	return {
		source: parsed.task.source,
		id: parsed.task.id,
		mode: parsed.args[0] || "auto",
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

export async function dispatchDeliveryCommand({ parsed, cwd = process.cwd(), workerRuntimePath = DEFAULT_WORKER_RUNTIME_PATH, checkpointPath = DEFAULT_CHECKPOINT_PATH, approveWriteDispatch = null } = {}) {
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
	const result = await spawnWorkerProcess({
		handoff,
		command: process.execPath,
		args: [workerRuntimePath],
		cwd,
		env: process.env,
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
	const lines = [
		`Command: /${result.command}`,
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
