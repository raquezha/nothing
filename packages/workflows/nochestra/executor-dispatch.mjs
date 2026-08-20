import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

export async function spawnWorkerProcess({
	handoff,
	command = process.execPath,
	args = [],
	env = process.env,
	timeout = 30000,
	ownerId = "nochestra-worker-runner",
	requiresWriteLock = true,
	lockPath = DEFAULT_LOCK_PATH,
	handoffMode = "file",
	fallbackModel = null,
	checkProviderAvailable = null,
} = {}) {
	if (!handoff || typeof handoff !== "object") {
		throw new Error("handoff object is required");
	}

	if (!handoff.contextBudget || Object.keys(handoff.contextBudget).length === 0) {
		throw new Error("Handoff must specify an explicit context budget");
	}

	let activeModel = handoff.model ? { ...handoff.model } : null;
	let fallbackApplied = false;

	if (activeModel) {
		const maxTokens = handoff.contextBudget.maxTokens;
		if (maxTokens && activeModel.contextWindow && maxTokens > activeModel.contextWindow) {
			if (fallbackModel) {
				activeModel = fallbackModel.provider ? { ...fallbackModel } : null;
				fallbackApplied = true;
			} else {
				throw new Error(`Context budget (maxTokens) exceeds model context window (${maxTokens} > ${activeModel.contextWindow})`);
			}
		}
	}

	if (activeModel && typeof checkProviderAvailable === "function") {
		const available = checkProviderAvailable(activeModel.provider, activeModel);
		if (!available) {
			if (fallbackModel) {
				activeModel = fallbackModel.provider ? { ...fallbackModel } : null;
				fallbackApplied = true;
			} else {
				throw new Error(`Local model daemon or provider unavailable: ${activeModel.provider}`);
			}
		}
	}

	let lockAcquired = false;
	if (requiresWriteLock || (Array.isArray(handoff.permissions) && handoff.permissions.some((p) => p.includes("write")))) {
		if (!await acquireWriterLock(ownerId, lockPath)) {
			throw new Error("Writer lock is currently held by another executor");
		}
		lockAcquired = true;
	}

	let tempFilePath = null;
	try {
		const spawnWorkerAttempt = async (targetModel) => {
			const spawnArgs = [...args];
			if (!spawnArgs.includes("--no-context-files")) {
				spawnArgs.push("--no-context-files");
			}

			if (targetModel?.provider) {
				spawnArgs.push("--provider", targetModel.provider);
			}
			if (targetModel?.name) {
				spawnArgs.push("--model", targetModel.name);
			}

			if (handoffMode === "file") {
				tempFilePath = path.join(os.tmpdir(), `nochestra-handoff-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.json`);
				fs.writeFileSync(tempFilePath, JSON.stringify(handoff), "utf8");
				spawnArgs.push("--handoff", tempFilePath);
			}

			const workerProcess = spawn(command, spawnArgs, {
				env: { ...env, NOCHESTRA_WORKER: "1" },
				stdio: ["pipe", "pipe", "pipe"],
				timeout,
			});

			let stdoutData = "";
			let stderrData = "";

			workerProcess.stdout.on("data", (chunk) => {
				stdoutData += chunk.toString("utf8");
			});

			workerProcess.stderr.on("data", (chunk) => {
				stderrData += chunk.toString("utf8");
			});

			if (handoffMode === "stdin") {
				workerProcess.stdin.write(JSON.stringify(handoff));
				workerProcess.stdin.end();
			}

			const exitCode = await new Promise((resolve, reject) => {
				workerProcess.on("error", reject);
				workerProcess.on("close", (code) => resolve(code));
			});

			if (tempFilePath && fs.existsSync(tempFilePath)) {
				try {
					fs.unlinkSync(tempFilePath);
				} catch (_) {}
				tempFilePath = null;
			}

			if (exitCode !== 0) {
				throw new Error(`Worker process exited with code ${exitCode}: ${stderrData || stdoutData}`);
			}

			let rawResult;
			try {
				rawResult = JSON.parse(stdoutData.trim());
			} catch (e) {
				throw new Error(`Failed to parse worker stdout JSON: ${stdoutData}`);
			}

			validateCompactWorkerResult(rawResult);

			return {
				status: rawResult.status,
				taskId: rawResult.taskId,
				summary: rawResult.summary,
				nextStep: rawResult.nextStep,
				writeLockAcquired: lockAcquired,
				...(fallbackApplied ? { fallbackApplied: true } : {}),
			};
		};

		try {
			return await spawnWorkerAttempt(activeModel);
		} catch (err) {
			if (activeModel && fallbackModel && !fallbackApplied) {
				fallbackApplied = true;
				const fbModel = fallbackModel.provider ? { ...fallbackModel } : null;
				return await spawnWorkerAttempt(fbModel);
			}
			throw err;
		}
	} finally {
		if (tempFilePath && fs.existsSync(tempFilePath)) {
			try {
				fs.unlinkSync(tempFilePath);
			} catch (_) {}
		}
		if (lockAcquired) {
			await releaseWriterLock(ownerId, lockPath);
		}
	}
}
