import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireWriterLock, releaseWriterLock } from "./writer-lock.mjs";
import { validateCompactWorkerResult } from "../domain/handoff-contract.mjs";

const DEFAULT_LOCK_PATH = ".workflow/nochestra-writer.lock";

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

export function buildWorkerEnv(env = process.env, parentSessionId = null) {
	const resolvedParentSessionId = parentSessionId || env?.NOCHESTRA_SESSION_ID || env?.PI_SESSION_ID || null;
	return {
		...env,
		NOCHESTRA_WORKER: "1",
		NOCHESTRA_ROLE: "worker",
		...(resolvedParentSessionId ? { NOCHESTRA_PARENT_SESSION_ID: String(resolvedParentSessionId) } : {}),
	};
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

export async function spawnWorkerProcess({
	handoff,
	command,
	args = [],
	env = process.env,
	cwd = process.cwd(),
	timeout = 30000,
	ownerId = "nochestra-worker-runner",
	requiresWriteLock = true,
	lockPath = DEFAULT_LOCK_PATH,
	handoffMode = "file",
	fallbackModel = null,
	checkProviderAvailable = null,
	approveWriteDispatch = null,
	parentSessionId = null,
} = {}) {
	if (!handoff || typeof handoff !== "object") {
		throw new Error("handoff object is required");
	}

	if (!handoff.contextBudget || Object.keys(handoff.contextBudget).length === 0) {
		throw new Error("Handoff must specify an explicit context budget");
	}

	const targetCommand = command || env?.PI_BINARY || process.env.PI_BINARY || "pi";

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

			const workerProcess = spawn(targetCommand, spawnArgs, {
				cwd,
				env: buildWorkerEnv(env, parentSessionId),
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdoutData = "";
			let stderrData = "";
			let watchdogTimer = null;
			let killTimer = null;
			let timedOut = false;

			if (timeout && timeout > 0) {
				watchdogTimer = setTimeout(() => {
					timedOut = true;
					try {
						workerProcess.kill("SIGTERM");
					} catch (_) {}
					killTimer = setTimeout(() => {
						try {
							workerProcess.kill("SIGKILL");
						} catch (_) {}
					}, 2000);
				}, timeout);
			}

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
				workerProcess.on("error", (err) => {
					if (watchdogTimer) clearTimeout(watchdogTimer);
					if (killTimer) clearTimeout(killTimer);
					reject(err);
				});
				workerProcess.on("close", (code) => {
					if (watchdogTimer) clearTimeout(watchdogTimer);
					if (killTimer) clearTimeout(killTimer);
					resolve(code);
				});
			});

			if (tempFilePath && fs.existsSync(tempFilePath)) {
				try {
					fs.unlinkSync(tempFilePath);
				} catch (_) {}
				tempFilePath = null;
			}

			if (timedOut) {
				throw new Error(`Worker process timed out after ${timeout}ms`);
			}

			if (exitCode !== 0) {
				const errorMsg = (stderrData || stdoutData).trim();
				const conciseMsg = errorMsg.length > 200 ? errorMsg.substring(0, 200) + "..." : errorMsg;
				throw new Error(`Worker process exited with code ${exitCode}${conciseMsg ? `: ${conciseMsg}` : ""}`);
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
