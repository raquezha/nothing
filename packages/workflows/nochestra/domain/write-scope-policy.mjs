const WRITE_SCOPE_BY_DESTINATION = Object.freeze({
	triage: (taskRef) => ({
		canChange: Object.freeze([
			`.workflow/tasks/${taskRef}/WORK.md`,
			`.workflow/tasks/${taskRef}/metadata.json`,
			".workflow/active.json",
		]),
		willNot: Object.freeze(["edit code", "update tracker"]),
	}),
	frame: (taskRef) => ({
		canChange: Object.freeze([
			`.workflow/tasks/${taskRef}/WORK.md [BRIEF], [LOG]`,
		]),
		willNot: Object.freeze(["edit code", "update tracker"]),
	}),
	"grill-with-docs": (taskRef) => ({
		canChange: Object.freeze([
			`.workflow/tasks/${taskRef}/WORK.md [GRILL], [LOG]`,
		]),
		willNot: Object.freeze(["edit code", "update tracker"]),
	}),
	plan: (taskRef) => ({
		canChange: Object.freeze([
			`.workflow/tasks/${taskRef}/WORK.md [PLAN], [LOG]`,
		]),
		willNot: Object.freeze(["edit code", "update tracker"]),
	}),
	sync: (taskRef) => ({
		canChange: Object.freeze([
			"target issue/PR marker comment (<!-- pi-sync-marker -->)",
			`.workflow/tasks/${taskRef}/WORK.md [LOG]`,
		]),
		willNot: Object.freeze(["edit code"]),
	}),
});

function extractTaskRef(assignment, task) {
	if (task?.source && task?.id) {
		return `${task.source.toLowerCase()}-${task.id.toLowerCase()}`;
	}
	const taskMatch = String(assignment || "").match(/(?:github|gitlab|jira|local):[^\s]+/i);
	return taskMatch ? taskMatch[0].toLowerCase().replace(":", "-") : "task-id";
}

export function resolveWriteScope({ destination, assignment, task = null } = {}) {
	const builder = WRITE_SCOPE_BY_DESTINATION[destination];
	if (!builder) {
		return null;
	}
	const taskRef = extractTaskRef(assignment, task);
	return builder(taskRef);
}
