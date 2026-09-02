export const FORBIDDEN_TRANSCRIPT_FIELDS = Object.freeze(["parentTranscript", "messages", "rawParentHistory", "transcript"]);
export const COMPACT_WORKER_RESULT_KEYS = Object.freeze(["status", "taskId", "summary", "nextStep"]);
export const OPTIONAL_WORKER_RESULT_KEYS = Object.freeze(["artifacts", "verification", "blockers", "warnings", "recovery", "evidence", "fallbackApplied"]);
export const FORBIDDEN_WORKER_RESULT_FIELDS = Object.freeze(["transcript", "messages", "rawWorkerLog", "fullParentTranscript"]);
export const WORKSPACE_ACCESS_VALUES = Object.freeze(["read-only", "write-checkout"]);

export function isValidWorkspaceAccess(value) {
	return value === undefined || WORKSPACE_ACCESS_VALUES.includes(value);
}

export function hasExplicitWritePermission(handoff) {
	return Array.isArray(handoff?.permissions) && handoff.permissions.includes("write-checkout");
}

export function isReadOnlyHandoff(handoff) {
	if (handoff?.workspaceAccess === "read-only") {
		return true;
	}
	if (handoff?.workspaceAccess === "write-checkout") {
		return false;
	}
	return Array.isArray(handoff?.permissions)
		&& handoff.permissions.length > 0
		&& handoff.permissions.every((p) => p === "read-only");
}

export function isWriteCapableHandoff(handoff) {
	return !isReadOnlyHandoff(handoff);
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
