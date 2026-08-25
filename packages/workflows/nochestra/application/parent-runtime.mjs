import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { readCheckpoint } from "../checkpoint.mjs";
import { parseNochestraInput } from "../delivery-command.mjs";
import { buildBoundedHandoff, spawnWorkerProcess } from "../executor-dispatch.mjs";

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

function readDeliveryCheckpoint(cwd, checkpointPath = DEFAULT_CHECKPOINT_PATH) {
	const resolved = path.resolve(cwd, checkpointPath);
	if (!fs.existsSync(resolved)) {
		throw new Error(`No Nochestra checkpoint found at ${checkpointPath}`);
	}
	return readCheckpoint(resolved);
}

export function loadDeliveryContext({ cwd = process.cwd(), checkpointPath = DEFAULT_CHECKPOINT_PATH } = {}) {
	return {
		active: readActiveWorkflow(cwd),
		checkpoint: readDeliveryCheckpoint(cwd, checkpointPath),
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
	const task = deliveryTask(parsed);
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

function compactDeliveryResult(parsed, result) {
	return {
		kind: "delivery",
		command: parsed.command,
		task: parsed.task,
		status: result.status,
		taskId: result.taskId,
		summary: result.summary,
		nextStep: result.nextStep,
	};
}

export function formatWriteApprovalPrompt({ assignment, destination, permissions = [], requiresWriteLock = false } = {}) {
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
	const context = loadDeliveryContext({ cwd, checkpointPath });
	const handoff = buildDeliveryHandoff({ parsed, ...context });
	const result = await spawnWorkerProcess({
		handoff,
		command: process.execPath,
		args: [workerRuntimePath],
		cwd,
		env: process.env,
		approveWriteDispatch,
	});
	return compactDeliveryResult(parsed, result);
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
	return [
		`Command: /${result.command}`,
		`Task: ${result.task.source}:${result.task.id}`,
		`Status: ${result.status}`,
		`Summary: ${result.summary}`,
		`Next step: ${result.nextStep}`,
	].join("\n");
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
