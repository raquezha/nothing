import fs from "node:fs";
import path from "node:path";
import lockfile from "proper-lockfile";
import { validateCheckpoint } from "./checkpoint.mjs";
import { validateCompactWorkerResult } from "./jira-triage-proof.mjs";

const DEFAULT_LOCK_PATH = ".workflow/nochestra-writer.lock";
const writerReleases = new Map();

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function lockOwnerPath(lockPath) {
	return `${lockPath}.owner.json`;
}

export async function acquireWriterLock(ownerId, lockPath = DEFAULT_LOCK_PATH, options = {}) {
	if (!ownerId) {
		throw new Error("ownerId is required to acquire writer lock");
	}
	if (writerReleases.has(lockPath)) {
		return false;
	}

	fs.mkdirSync(path.dirname(lockPath), { recursive: true });
	try {
		const release = await lockfile.lock(process.cwd(), {
			realpath: false,
			lockfilePath: lockPath,
			stale: options.stale ?? 30000,
			update: options.update ?? 15000,
			retries: options.retries ?? 0,
		});
		fs.writeFileSync(lockOwnerPath(lockPath), JSON.stringify({ owner: ownerId, acquiredAt: new Date().toISOString() }), "utf8");
		writerReleases.set(lockPath, { owner: ownerId, release });
		return true;
	} catch (e) {
		if (e?.code === "ELOCKED") {
			return false;
		}
		throw e;
	}
}

export async function releaseWriterLock(ownerId, lockPath = DEFAULT_LOCK_PATH) {
	if (!ownerId) {
		throw new Error("ownerId is required to release writer lock");
	}
	const held = writerReleases.get(lockPath);
	if (!held || held.owner !== ownerId) {
		return false;
	}
	await held.release();
	writerReleases.delete(lockPath);
	return true;
}

export function isWriterLocked(lockPath = DEFAULT_LOCK_PATH) {
	return fs.existsSync(lockPath);
}

export function resetWriterLock(lockPath = DEFAULT_LOCK_PATH) {
	writerReleases.delete(lockPath);
	fs.rmSync(lockPath, { recursive: true, force: true });
	fs.rmSync(lockOwnerPath(lockPath), { force: true });
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
} = {}) {
	if (!assignment || typeof assignment !== "string") {
		throw new Error("assignment string is required");
	}

	if (!contextBudget || typeof contextBudget !== "object" || Object.keys(contextBudget).length === 0) {
		throw new Error("non-empty contextBudget object is required");
	}

	validateCheckpoint(checkpoint);

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

	for (const forbidden of ["parentTranscript", "messages", "rawParentHistory", "transcript"]) {
		if (forbidden in handoff) {
			throw new Error(`Forbidden transcript field in handoff: ${forbidden}`);
		}
	}

	return handoff;
}

export async function dispatchExecutor({
	handoff,
	executor,
	ownerId = "nochestra-parent",
	requiresWriteLock = true,
	lockPath = DEFAULT_LOCK_PATH,
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

	let lockAcquired = false;
	if (requiresWriteLock || (Array.isArray(handoff.permissions) && handoff.permissions.some((p) => p.includes("write")))) {
		if (!await acquireWriterLock(ownerId, lockPath)) {
			throw new Error("Writer lock is currently held by another executor");
		}
		lockAcquired = true;
	}

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
