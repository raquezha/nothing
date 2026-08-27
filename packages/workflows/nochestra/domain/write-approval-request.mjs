import { resolveWriteScope } from "./write-scope-policy.mjs";

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

export function buildWriteApprovalRequest({ handoff, destination = handoff?.destination ?? handoff?.artifact?.destination ?? null, requiresWriteLock = false } = {}) {
	const task = handoff?.artifact ?? {
		source: handoff?.artifactSnapshot?.source,
		id: handoff?.artifactSnapshot?.id,
	};
	return {
		assignment: handoff?.assignment,
		destination,
		permissions: clone(handoff?.permissions ?? []),
		writeScope: resolveWriteScope({ destination, assignment: handoff?.assignment, task }),
		requiresWriteLock,
	};
}
