import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireWriterLock, releaseWriterLock } from "./writer-lock.mjs";
import { extractOptionalWorkerResultFields, validateCompactWorkerResult } from "../domain/handoff-contract.mjs";
import { isWriteCapableHandoff, needsWriterLock } from "../domain/handoff-policy.mjs";
import { buildWriteApprovalRequest } from "../domain/write-approval-request.mjs";

const DEFAULT_LOCK_PATH = ".workflow/nochestra-writer.lock";

export function buildWorkerEnv(env = process.env, options = {}) {
	const parentSessionId = typeof options === "string" ? options : options?.parentSessionId;
	const resolvedParentSessionId = parentSessionId || env?.NOCHESTRA_PARENT_SESSION_ID || env?.NOCHESTRA_SESSION_ID || env?.PI_SESSION_ID || null;
	const workerId = (typeof options === "object" && options?.workerId) || env?.NOCHESTRA_WORKER_ID || null;
	const workItemId = (typeof options === "object" && options?.workItemId) || env?.NOCHESTRA_WORK_ITEM_ID || null;
	const runId = (typeof options === "object" && options?.runId) || env?.NOCHESTRA_RUN_ID || null;

	return {
		...env,
		NOCHESTRA_WORKER: "1",
		NOCHESTRA_ROLE: "worker",
		...(resolvedParentSessionId ? { NOCHESTRA_PARENT_SESSION_ID: String(resolvedParentSessionId) } : {}),
		...(workerId ? { NOCHESTRA_WORKER_ID: String(workerId) } : {}),
		...(workItemId ? { NOCHESTRA_WORK_ITEM_ID: String(workItemId) } : {}),
		...(runId ? { NOCHESTRA_RUN_ID: String(runId) } : {}),
	};
}

export function buildExecutionEvidence({
	handoff,
	result,
	workerId = "nochestra-worker-runner",
	fallbackApplied = false,
	handoffBytes = null,
	activeModel = null,
	parentPromptBytes = 0,
} = {}) {
	const handoffString = handoff ? JSON.stringify(handoff) : null;
	const computedBytes = handoffBytes ?? (handoffString ? Buffer.byteLength(handoffString, "utf8") : 0);
	const workItemId = result?.taskId || (handoff ? handoffTaskId(handoff) : null);
	const route = handoff?.artifactSnapshot?.route ?? handoff?.route ?? "delivery";
	const destination = handoff?.destination ?? handoff?.artifactSnapshot?.destination ?? handoff?.artifact?.destination ?? null;
	const resultStatus = result?.status ?? "failed";
	const nextStep = result?.nextStep ?? "unknown";
	const effectiveModel = activeModel ?? handoff?.model ?? null;

	const resolvedParentPrompt = typeof parentPromptBytes === "number" && Number.isFinite(parentPromptBytes) ? Math.max(0, parentPromptBytes) : 0;
	const quarantineSavingsBytes = resolvedParentPrompt > 0 ? Math.max(0, resolvedParentPrompt - computedBytes) : 0;
	const quarantineEfficiencyRatio = resolvedParentPrompt > 0 ? Number((quarantineSavingsBytes / resolvedParentPrompt).toFixed(4)) : 0;

	return {
		route,
		destination,
		workItemId,
		workerId,
		parentPromptBytes: resolvedParentPrompt,
		handoffBytes: computedBytes,
		quarantineSavingsBytes,
		quarantineEfficiencyRatio,
		resultStatus,
		nextStep,
		provider: effectiveModel?.provider ?? null,
		model: effectiveModel?.name ?? null,
		fallbackApplied: Boolean(fallbackApplied || result?.fallbackApplied),
	};
}

export function emitExecutionEvidence({ evidence, onEvidence = null, events = null } = {}) {
	if (!evidence || typeof evidence !== "object") return;
	try {
		if (typeof onEvidence === "function") {
			onEvidence(evidence);
		}
	} catch (_) {}
	try {
		if (events && typeof events.emit === "function") {
			events.emit("notrace.boundary", {
				type: "worker_handoff",
				timestamp: Date.now(),
				...evidence,
			});
			events.emit("notrace.boundary", {
				type: "context_quarantine_efficiency",
				timestamp: Date.now(),
				parentPromptBytes: evidence.parentPromptBytes,
				handoffBytes: evidence.handoffBytes,
				quarantineSavingsBytes: evidence.quarantineSavingsBytes,
				quarantineEfficiencyRatio: evidence.quarantineEfficiencyRatio,
				workerId: evidence.workerId,
				workItemId: evidence.workItemId,
			});
		}
	} catch (_) {}
}

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

export async function spawnWorkerProcess({
	handoff,
	command,
	args = [],
	env = process.env,
	cwd = process.cwd(),
	timeout = 30000,
	ownerId = "nochestra-worker-runner",
	requiresWriteLock = null,
	lockPath = DEFAULT_LOCK_PATH,
	handoffMode = "file",
	fallbackModel = null,
	checkProviderAvailable = null,
	approveWriteDispatch = null,
	parentSessionId = null,
	workerId = null,
	workItemId = null,
	runId = null,
	parentPromptBytes = 0,
	showStartLog = true,
	onEvidence = null,
	events = null,
} = {}) {
	if (!handoff || typeof handoff !== "object") {
		throw new Error("handoff object is required");
	}

	if (!handoff.contextBudget || Object.keys(handoff.contextBudget).length === 0) {
		throw new Error("Handoff must specify an explicit context budget");
	}

	const targetCommand = command || env?.PI_BINARY || process.env.PI_BINARY || "pi";
	const effectiveWorkerId = workerId || ownerId || "nochestra-worker-runner";
	const effectiveWorkItemId = workItemId || handoffTaskId(handoff);
	const handoffBytes = Buffer.byteLength(JSON.stringify(handoff), "utf8");

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
		const cancelledResult = {
			status: "cancelled",
			taskId: effectiveWorkItemId,
			summary: "Write-capable dispatch cancelled by user.",
			nextStep: "manual-takeover",
			writeLockAcquired: false,
			recovery: { action: "request user approval before write execution" },
		};
		const evidence = buildExecutionEvidence({
			handoff,
			result: cancelledResult,
			workerId: effectiveWorkerId,
			fallbackApplied,
			handoffBytes,
			activeModel,
			parentPromptBytes,
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

			const providerName = targetModel?.provider || activeModel?.provider || "ollama";
			const modelName = targetModel?.name || activeModel?.name || "ornith:9b";
			const handoffKb = (handoffBytes / 1024).toFixed(1);
			const destLabel = handoff.destination ? (handoff.destination.startsWith("/") ? handoff.destination : `/${handoff.destination}`) : "/worker";

			if (showStartLog) {
				console.log(`⚡ NOCHESTRA ▶ ${effectiveWorkItemId} ▶ ${destLabel} ▶ 🤖 ${providerName}/${modelName} ▶ [${handoffKb} kB] ▶ ⏳ Running...`);
			}

			const workerProcess = spawn(targetCommand, spawnArgs, {
				cwd,
				env: buildWorkerEnv(env, {
					parentSessionId,
					workerId: effectiveWorkerId,
					workItemId: effectiveWorkItemId,
					runId,
				}),
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

			const result = {
				status: rawResult.status,
				taskId: rawResult.taskId,
				summary: rawResult.summary,
				nextStep: rawResult.nextStep,
				writeLockAcquired: lockAcquired,
				...(fallbackApplied ? { fallbackApplied: true } : {}),
				...extractOptionalWorkerResultFields(rawResult),
			};

			const evidence = buildExecutionEvidence({
				handoff,
				result,
				workerId: effectiveWorkerId,
				fallbackApplied,
				handoffBytes,
				activeModel: targetModel,
				parentPromptBytes,
			});
			emitExecutionEvidence({ evidence, onEvidence, events });
			result.evidence = evidence;

			return result;
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
