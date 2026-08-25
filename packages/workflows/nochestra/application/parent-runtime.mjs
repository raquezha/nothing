import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCheckpoint, validateCheckpoint } from "../checkpoint.mjs";
import { parseNochestraInput } from "../delivery-command.mjs";
import { buildBoundedHandoff, spawnWorkerProcess } from "../executor-dispatch.mjs";

const DEFAULT_WORKER_RUNTIME_PATH = process.env.NOCH_WORKER_RUNTIME_PATH || fileURLToPath(new URL("./worker-runtime.mjs", import.meta.url));
const DEFAULT_CHECKPOINT_PATH = process.env.NOCH_CHECKPOINT_PATH || path.join(".workflow", "nochestra-checkpoint.json");

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function maybeReadJson(filePath) {
	return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function defaultCheckpoint(parsed, active) {
	const taskRef = `${parsed.task.source}:${parsed.task.id}`;
	const subject = active?.id || taskRef;
	return {
		subject,
		goal: `Dispatch ${parsed.command} for ${taskRef}`,
		decisions: [`Human explicitly invoked ${parsed.raw}`],
		constraints: ["Do not replay parent transcript", "Keep worker result compact"],
		openQuestions: [],
		rejectedOptions: [],
		currentRoute: "delivery",
		suggestedNextRoute: "delivery",
	};
}

function loadCheckpointForDelivery({ cwd, parsed, checkpointPath = DEFAULT_CHECKPOINT_PATH, active }) {
	const resolved = path.resolve(cwd, checkpointPath);
	if (!fs.existsSync(resolved)) {
		return defaultCheckpoint(parsed, active);
	}
	const checkpoint = readCheckpoint(resolved);
	validateCheckpoint(checkpoint);
	return checkpoint;
}

function buildArtifactSnapshot(parsed, active) {
	return {
		source: parsed.task.source,
		id: parsed.task.id,
		mode: parsed.args[0] || "auto",
		activeWorkflow: active ? {
			id: active.id,
			taskPath: active.taskPath,
			stateFile: active.stateFile,
			branch: active.branch,
		} : null,
	};
}

export function buildNochestraDeliveryHandoff({ parsed, checkpoint, active }) {
	const handoff = buildBoundedHandoff({
		assignment: `Run ${parsed.command} for ${parsed.task.source}:${parsed.task.id}`,
		checkpoint,
		artifactSnapshot: buildArtifactSnapshot(parsed, active),
		contextBudget: { maxTokens: 4000, maxTurns: 4 },
		selectedSkills: [parsed.command],
		permissions: ["write-checkout"],
	});

	handoff.destination = parsed.command;
	handoff.artifact = {
		source: parsed.task.source,
		id: parsed.task.id,
		mode: parsed.args[0] || "auto",
		stateFile: active?.stateFile ?? null,
	};
	return handoff;
}

export async function dispatchNochestraInput({ input, cwd = process.cwd(), workerRuntimePath = DEFAULT_WORKER_RUNTIME_PATH, checkpointPath = DEFAULT_CHECKPOINT_PATH } = {}) {
	const parsed = parseNochestraInput(input);
	if (parsed.kind === "delivery-error") {
		throw new Error(parsed.error);
	}
	if (parsed.kind !== "delivery") {
		return { kind: "chat", prompt: parsed.prompt };
	}

	const active = maybeReadJson(path.join(cwd, ".workflow", "active.json"));
	const checkpoint = loadCheckpointForDelivery({ cwd, parsed, checkpointPath, active });
	const handoff = buildNochestraDeliveryHandoff({ parsed, checkpoint, active });
	const result = await spawnWorkerProcess({
		handoff,
		command: process.execPath,
		args: [workerRuntimePath],
		cwd,
		env: process.env,
	});

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
	return dispatchNochestraInput({ input: args, ...options });
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
