const DELIVERY_COMMANDS = new Set(["triage", "frame", "grill-with-docs", "plan", "sync"]);
const TASK_REF_RE = /^(github|gitlab|jira|local):([^\s]+)$/i;

function normalizeInput(input) {
	if (Array.isArray(input)) {
		return input.join(" ").trim();
	}
	return typeof input === "string" ? input.trim() : "";
}

export function parseTrackedTaskRef(value) {
	const match = TASK_REF_RE.exec(String(value || "").trim());
	if (!match) {
		return null;
	}

	return {
		source: match[1].toLowerCase(),
		id: match[2],
	};
}

export function parseNochestraInput(input) {
	const raw = normalizeInput(input);
	if (!raw.startsWith("/")) {
		return { kind: "chat", prompt: raw };
	}

	const [head, ...rest] = raw.split(/\s+/);
	const command = head.slice(1).toLowerCase();
	if (!DELIVERY_COMMANDS.has(command)) {
		return { kind: "chat", prompt: raw };
	}

	const task = parseTrackedTaskRef(rest[0]);
	if (!task) {
		return {
			kind: "delivery-error",
			command,
			error: "Delivery commands require an explicit source:id target.",
		};
	}

	return {
		kind: "delivery",
		route: "delivery",
		command,
		task,
		args: rest.slice(1),
		raw,
	};
}
