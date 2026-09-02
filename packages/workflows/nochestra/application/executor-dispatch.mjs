import { validateCheckpoint } from "../domain/checkpoint-contract.mjs";
import { assertNoTranscriptFields, extractOptionalWorkerResultFields, validateCompactWorkerResult, validateWorkerHandoff } from "../domain/handoff-contract.mjs";
import { COMPACT_WORKER_RESULT_KEYS, OPTIONAL_WORKER_RESULT_KEYS, isWriteCapableHandoff, needsWriterLock } from "../domain/handoff-policy.mjs";
import { buildWriteApprovalRequest } from "../domain/write-approval-request.mjs";
import { acquireWriterLock, releaseWriterLock } from "../adapters/writer-lock.mjs";
import { buildExecutionEvidence, emitExecutionEvidence, spawnWorkerProcess } from "../adapters/process-runner.mjs";

const DEFAULT_LOCK_PATH = ".workflow/nochestra-writer.lock";

function handoffTaskId(handoff) {
	const source = handoff.artifactSnapshot?.source ?? handoff.artifact?.source;
	const id = handoff.artifactSnapshot?.id ?? handoff.artifact?.id ?? null;
	return source && id ? `${source}-${id}` : id;
}

async function approveWriteHandoff({ handoff, approveWriteDispatch, destination = handoff.destination ?? handoff.artifact?.destination ?? null, requiresWriteLock, writeCapable }) {
	if (!writeCapable || typeof approveWriteDispatch !== "function") {
		return true;
	}
	const lockNeeded = needsWriterLock(handoff, requiresWriteLock);
	const approval = await approveWriteDispatch(buildWriteApprovalRequest({ handoff, destination, requiresWriteLock: lockNeeded }));
	return approval === true || approval?.approved === true || approval?.userAction === "approve";
}

export function buildBoundedHandoff({
	assignment,
	checkpoint,
	artifactSnapshot = {},
	contextBudget,
	selectedSkills = [],
	permissions = ["read-only"],
	workspaceAccess,
	expectedResultShape = {
		required: [...COMPACT_WORKER_RESULT_KEYS],
		optional: [...OPTIONAL_WORKER_RESULT_KEYS],
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

	if (!Array.isArray(permissions) || permissions.length === 0) {
		throw new Error("permissions must be a non-empty array");
	}
	if (permissions.some((permission) => typeof permission !== "string" || !permission.trim())) {
		throw new Error("permissions must contain only non-empty strings");
	}

	const resolvedWorkspaceAccess = workspaceAccess ?? (permissions.length === 1 && permissions[0] === "read-only" ? "read-only" : "write-checkout");

	const handoff = {
		assignment,
		artifactSnapshot: structuredClone(artifactSnapshot),
		acceptedDecisions: structuredClone(checkpoint.decisions),
		constraints: structuredClone(checkpoint.constraints),
		openQuestions: structuredClone(checkpoint.openQuestions),
		selectedSkills: structuredClone(selectedSkills),
		permissions: structuredClone(permissions),
		workspaceAccess: resolvedWorkspaceAccess,
		contextBudget: structuredClone(contextBudget),
		expectedResultShape: structuredClone(expectedResultShape),
	};

	if (model !== undefined) {
		handoff.model = structuredClone(model);
	}

	validateWorkerHandoff(handoff);
	assertNoTranscriptFields(handoff, "handoff");

	return handoff;
}

export async function dispatchExecutor({
	handoff,
	executor,
	ownerId = "nochestra-parent",
	requiresWriteLock = null,
	lockPath = DEFAULT_LOCK_PATH,
	approveWriteDispatch = null,
	workerId = null,
	onEvidence = null,
	events = null,
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

	const effectiveWorkerId = workerId || ownerId || "nochestra-parent";
	const handoffBytes = Buffer.byteLength(JSON.stringify(handoff), "utf8");

	const writeCapable = isWriteCapableHandoff(handoff);
	const lockNeeded = needsWriterLock(handoff, requiresWriteLock);
	if (!await approveWriteHandoff({ handoff, approveWriteDispatch, requiresWriteLock, writeCapable })) {
		const cancelledResult = {
			status: "cancelled",
			taskId: handoffTaskId(handoff),
			summary: "Write-capable dispatch cancelled by user.",
			nextStep: "manual-takeover",
			writeLockAcquired: false,
		};
		const evidence = buildExecutionEvidence({
			handoff,
			result: cancelledResult,
			workerId: effectiveWorkerId,
			fallbackApplied: false,
			handoffBytes,
		});
		emitExecutionEvidence({ evidence, onEvidence, events });
		cancelledResult.evidence = evidence;
		return cancelledResult;
	}

	let lockAcquired = false;
	if (lockNeeded && !await acquireWriterLock(ownerId, lockPath)) {
		throw new Error("Writer lock is currently held by another executor");
	}
	lockAcquired = lockNeeded;

	try {
		const rawResult = await executor(handoff);
		validateCompactWorkerResult(rawResult);

		const result = {
			status: rawResult.status,
			taskId: rawResult.taskId,
			summary: rawResult.summary,
			nextStep: rawResult.nextStep,
			writeLockAcquired: lockAcquired,
			...extractOptionalWorkerResultFields(rawResult),
		};

		const evidence = buildExecutionEvidence({
			handoff,
			result,
			workerId: effectiveWorkerId,
			fallbackApplied: Boolean(result.fallbackApplied),
			handoffBytes,
		});
		emitExecutionEvidence({ evidence, onEvidence, events });
		result.evidence = evidence;

		return result;
	} finally {
		if (lockAcquired) {
			await releaseWriterLock(ownerId, lockPath);
		}
	}
}

export { spawnWorkerProcess };
