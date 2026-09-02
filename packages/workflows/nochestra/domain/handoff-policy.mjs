export const FORBIDDEN_TRANSCRIPT_FIELDS = Object.freeze(["parentTranscript", "messages", "rawParentHistory", "transcript"]);
export const COMPACT_WORKER_RESULT_KEYS = Object.freeze(["status", "taskId", "summary", "nextStep"]);
export const OPTIONAL_WORKER_RESULT_KEYS = Object.freeze(["artifacts", "verification", "blockers", "warnings", "recovery", "evidence", "fallbackApplied"]);
export const FORBIDDEN_WORKER_RESULT_FIELDS = Object.freeze(["transcript", "messages", "rawWorkerLog", "fullParentTranscript"]);

export function isWriteCapableHandoff(handoff) {
	return Array.isArray(handoff?.permissions) && handoff.permissions.some((p) => p.includes("write"));
}

export function needsWriterLock(handoff, requiresWriteLock) {
	if (requiresWriteLock === false) {
		return false;
	}
	if (requiresWriteLock === true) {
		return true;
	}
	return isWriteCapableHandoff(handoff);
}
