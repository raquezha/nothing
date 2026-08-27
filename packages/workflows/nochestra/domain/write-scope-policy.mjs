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
	research: (taskRef) => ({
		canChange: Object.freeze([
			`.workflow/research/${taskRef}/RESEARCH.md`,
			`.workflow/research/${taskRef}/metadata.json`,
			".workflow/active.json",
		]),
		willNot: Object.freeze(["create RPIV task", "edit code", "update tracker"]),
	}),
});

function sanitizeTaskId(id) {
	return String(id)
		.replace(/[\\/]+/g, "-")
		.replace(/\.\.+/g, "-")
		.replace(/^\.+/, "");
}

function taskRefFromParts(source, id) {
	return `${String(source).toLowerCase()}-${sanitizeTaskId(id)}`;
}

function extractTaskRef(assignment, task) {
	if (task?.source === "research" && task?.id) {
		return sanitizeTaskId(task.id);
	}
	if (task?.source && task?.id) {
		return taskRefFromParts(task.source, task.id);
	}
	const researchMatch = String(assignment || "").match(/Run research for "([^"]+)"/i);
	if (researchMatch) {
		return sanitizeTaskId(researchMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
	}
	const taskMatch = String(assignment || "").match(/(github|gitlab|jira|local):([^\s]+)/i);
	return taskMatch ? taskRefFromParts(taskMatch[1], taskMatch[2]) : "task-id";
}

export function resolveWriteScope({ destination, assignment, task = null } = {}) {
	const builder = WRITE_SCOPE_BY_DESTINATION[destination];
	if (!builder) {
		return null;
	}
	const taskRef = extractTaskRef(assignment, task);
	return builder(taskRef);
}
