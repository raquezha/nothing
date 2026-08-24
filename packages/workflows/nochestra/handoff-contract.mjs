export const FORBIDDEN_TRANSCRIPT_FIELDS = ["parentTranscript", "messages", "rawParentHistory", "transcript"];
export const COMPACT_WORKER_RESULT_KEYS = ["status", "taskId", "summary", "nextStep"];
export const FORBIDDEN_WORKER_RESULT_FIELDS = ["transcript", "messages", "rawWorkerLog", "fullParentTranscript"];

export function assertPlainObject(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be a plain object`);
	}
}

export function assertNoTranscriptFields(value, label) {
	for (const field of FORBIDDEN_TRANSCRIPT_FIELDS) {
		if (field in value) {
			throw new Error(`Forbidden transcript field in ${label}: ${field}`);
		}
	}
}

export function validateCompactWorkerResult(result) {
	assertPlainObject(result, "Worker result");

	for (const key of COMPACT_WORKER_RESULT_KEYS) {
		if (!(key in result)) {
			throw new Error(`Missing required worker result field: ${key}`);
		}
	}

	for (const field of FORBIDDEN_WORKER_RESULT_FIELDS) {
		if (field in result) {
			throw new Error(`Forbidden worker result field: ${field}`);
		}
	}

	return true;
}
