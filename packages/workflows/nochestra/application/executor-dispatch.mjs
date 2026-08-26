import { validateCheckpoint } from "../domain/checkpoint-contract.mjs";
import { assertNoTranscriptFields, validateCompactWorkerResult } from "../domain/handoff-contract.mjs";
import { acquireWriterLock, releaseWriterLock } from "../adapters/writer-lock.mjs";
import { spawnWorkerProcess } from "../adapters/process-runner.mjs";

const DEFAULT_LOCK_PATH = ".workflow/nochestra-writer.lock";

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function isWriteCapableHandoff(handoff) {
	return Array.isArray(handoff.permissions) && handoff.permissions.some((p) => p.includes("write"));
}

function handoffTaskId(handoff) {
	const source = handoff.artifactSnapshot?.source ?? handoff.artifact?.source;
	const id = handoff.artifactSnapshot?.id ?? handoff.artifact?.id ?? null;
	return source && id ? `${source}-${id}` : id;
}

function needsWriterLock(handoff, requiresWriteLock) {
	if (requiresWriteLock === false) {
		return false;
	}
	return requiresWriteLock === true || isWriteCapableHandoff(handoff);
}

async function approveWriteHandoff({ handoff, approveWriteDispatch, destination = handoff.destination ?? handoff.artifact?.destination ?? null, requiresWriteLock, writeCapable }) {
	if (!writeCapable || typeof approveWriteDispatch !== "function") {
		return true;
	}
	const approval = await approveWriteDispatch({
		assignment: handoff.assignment,
		destination,
		permissions: clone(handoff.permissions ?? []),
		requiresWriteLock,
	});
	return approval === true || approval?.approved === true || approval?.userAction === "approve";
}

export function buildBoundedHandoff({
	assignment,
	checkpoint,
	artifactSnapshot = {},
	contextBudget,
	selectedSkills = [],
	permissions = ["read-only"],
	expectedResultShape = {
		required: ["status", "taskId", "summary", "nextStep"],
	},
	model,
} = {}) {
	if (!assignment || typeof assignment !== "string") {
		throw new Error("assignment string is required");
	}

	if (!contextBudget || typeof contextBudget !== "object" || Object.keys(contextBudget).length === 0) {
		throw new Error("non-empty contextBudget object is required");
	}

	validateCheckpoint(checkpoint);

	if (model !== undefined) {
		if (!model || typeof model !== "object") {
			throw new Error("model must be an object");
		}
		if (typeof model.provider !== "string" || !model.provider.trim()) {
			throw new Error("model.provider string is required");
		}
		if (typeof model.name !== "string" || !model.name.trim()) {
			throw new Error("model.name string is required");
		}
		if (model.contextWindow !== undefined && (typeof model.contextWindow !== "number" || model.contextWindow <= 0)) {
			throw new Error("model.contextWindow must be a positive number");
		}
	}

	const handoff = {
		assignment,
		artifactSnapshot: clone(artifactSnapshot),
		acceptedDecisions: clone(checkpoint.decisions),
		constraints: clone(checkpoint.constraints),
		openQuestions: clone(checkpoint.openQuestions),
		selectedSkills: clone(selectedSkills),
		permissions: clone(permissions),
		contextBudget: clone(contextBudget),
		expectedResultShape: clone(expectedResultShape),
	};

	if (model !== undefined) {
		handoff.model = clone(model);
	}

	assertNoTranscriptFields(handoff, "handoff");

	return handoff;
}

export async function dispatchExecutor({
	handoff,
	executor,
	ownerId = "nochestra-parent",
	requiresWriteLock = true,
	lockPath = DEFAULT_LOCK_PATH,
	approveWriteDispatch = null,
} = {}) {
	if (!handoff || typeof handoff !== "object") {
		throw new Error("handoff object is required");
	}

	if (typeof executor !== "function") {
		throw new Error("Predefined executor function is required");
	}

	if (!handoff.contextBudget || Object.keys(handoff.contextBudget).length === 0) {
		throw new Error("Handoff must specify an explicit context budget");
	}

	const writeCapable = isWriteCapableHandoff(handoff);
	const lockNeeded = needsWriterLock(handoff, requiresWriteLock);
	if (!await approveWriteHandoff({ handoff, approveWriteDispatch, requiresWriteLock, writeCapable })) {
		return {
			status: "cancelled",
			taskId: handoffTaskId(handoff),
			summary: "Write-capable dispatch cancelled by user.",
			nextStep: "manual-takeover",
			writeLockAcquired: false,
		};
	}

	let lockAcquired = false;
	if (lockNeeded && !await acquireWriterLock(ownerId, lockPath)) {
		throw new Error("Writer lock is currently held by another executor");
	}
	lockAcquired = lockNeeded;

	try {
		const rawResult = await executor(handoff);
		validateCompactWorkerResult(rawResult);

		return {
			status: rawResult.status,
			taskId: rawResult.taskId,
			summary: rawResult.summary,
			nextStep: rawResult.nextStep,
			writeLockAcquired: lockAcquired,
		};
	} finally {
		if (lockAcquired) {
			await releaseWriterLock(ownerId, lockPath);
		}
	}
}

export { spawnWorkerProcess };
