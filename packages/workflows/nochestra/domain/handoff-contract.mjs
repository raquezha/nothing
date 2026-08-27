import {
	COMPACT_WORKER_RESULT_KEYS,
	FORBIDDEN_TRANSCRIPT_FIELDS,
	FORBIDDEN_WORKER_RESULT_FIELDS,
	OPTIONAL_WORKER_RESULT_KEYS,
} from "./handoff-policy.mjs";

export {
	COMPACT_WORKER_RESULT_KEYS,
	FORBIDDEN_TRANSCRIPT_FIELDS,
	FORBIDDEN_WORKER_RESULT_FIELDS,
	OPTIONAL_WORKER_RESULT_KEYS,
} from "./handoff-policy.mjs";

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

export function validateWorkerHandoff(handoff) {
	assertPlainObject(handoff, "Worker handoff");
	if (!handoff.assignment || typeof handoff.assignment !== "string") {
		throw new Error("Worker handoff requires assignment string");
	}
	assertNoTranscriptFields(handoff, "worker handoff");
	return true;
}

export function compactWorkerResultInstruction() {
	return `Return only compact JSON with required keys: ${COMPACT_WORKER_RESULT_KEYS.map((key) => `"${key}"`).join(", ")} and optional keys: ${OPTIONAL_WORKER_RESULT_KEYS.map((key) => `"${key}"`).join(", ")}.`;
}

export function extractOptionalWorkerResultFields(result) {
	const fields = {};
	for (const key of OPTIONAL_WORKER_RESULT_KEYS) {
		if (result[key] !== undefined) {
			fields[key] = result[key];
		}
	}
	return fields;
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

	for (const field of ["artifacts", "verification", "blockers", "warnings"]) {
		if (result[field] !== undefined && result[field] !== null && !Array.isArray(result[field])) {
			throw new Error(`Worker result field '${field}' must be an array`);
		}
	}

	return true;
}
