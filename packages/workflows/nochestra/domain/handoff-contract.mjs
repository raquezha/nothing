export const NOCHESTRA_HANDOFF_CONTRACT = Object.freeze({
	forbiddenTranscriptFields: Object.freeze(["parentTranscript", "messages", "rawParentHistory", "transcript"]),
	compactWorkerResultKeys: Object.freeze(["status", "taskId", "summary", "nextStep"]),
	forbiddenWorkerResultFields: Object.freeze(["transcript", "messages", "rawWorkerLog", "fullParentTranscript"]),
});

export function assertPlainObject(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be a plain object`);
	}
}

export function assertNoTranscriptFields(value, label, contract = NOCHESTRA_HANDOFF_CONTRACT) {
	for (const field of contract.forbiddenTranscriptFields) {
		if (field in value) {
			throw new Error(`Forbidden transcript field in ${label}: ${field}`);
		}
	}
}

export function validateCompactWorkerResult(result, contract = NOCHESTRA_HANDOFF_CONTRACT) {
	assertPlainObject(result, "Worker result");

	for (const key of contract.compactWorkerResultKeys) {
		if (!(key in result)) {
			throw new Error(`Missing required worker result field: ${key}`);
		}
	}

	for (const field of contract.forbiddenWorkerResultFields) {
		if (field in result) {
			throw new Error(`Forbidden worker result field: ${field}`);
		}
	}

	return true;
}
