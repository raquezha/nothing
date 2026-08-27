const DELIVERY_COMMANDS = new Set(["triage"]);
const DELIVERY_VERBS = ["triage", "implement", "fix", "ship", "verify", "deliver"];
const NOTE_PHRASES = [
	"write this to notes",
	"write to notes",
	"save this to notes",
	"save to notes",
	"write this to the vault",
	"write to the vault",
	"save this to the vault",
	"save to the vault",
];
const AMBIGUOUS_DURABLE_PHRASES = ["write this down", "save this", "capture this", "remember this"];
const RESEARCH_PHRASES = ["research", "investigate", "look up", "find docs", "explore", "compare"];
const TASK_REF_RE = /^(github|gitlab|jira|local):([^\s]+)$/i;
const TASK_REF_IN_TEXT_RE = /\b(github|gitlab|jira|local):([^\s]+)/i;
const QUESTION_RE = /\?$/;

function normalizeInput(input) {
	if (Array.isArray(input)) {
		return input.join(" ").trim();
	}
	return typeof input === "string" ? input.trim() : "";
}

function normalizeForMatch(input) {
	return normalizeInput(input).toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text, phrases) {
	return phrases.some((phrase) => text.includes(phrase));
}

function findTrackedTaskRefInText(value) {
	const match = TASK_REF_IN_TEXT_RE.exec(String(value || ""));
	if (!match) {
		return null;
	}

	return {
		source: match[1].toLowerCase(),
		id: match[2],
	};
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

export function recommendNochestraRoute(input) {
	const raw = normalizeInput(input);
	const text = normalizeForMatch(input);
	const task = findTrackedTaskRefInText(raw);

	if (task && includesAny(text, DELIVERY_VERBS)) {
		return {
			kind: "route-recommendation",
			route: "delivery",
			command: `/triage ${task.source}:${task.id}`,
			confidence: "high",
			reason: "tracker reference with delivery verb",
		};
	}

	if (includesAny(text, NOTE_PHRASES)) {
		return {
			kind: "route-recommendation",
			route: "notes",
			command: "pi --notes",
			confidence: "high",
			reason: "explicit note-writing or vault intent",
		};
	}

	if (includesAny(text, AMBIGUOUS_DURABLE_PHRASES)) {
		return {
			kind: "route-recommendation",
			route: "needs-confirmation",
			command: null,
			confidence: "low",
			reason: "durable write intent is ambiguous",
		};
	}

	if (includesAny(text, RESEARCH_PHRASES) || QUESTION_RE.test(raw)) {
		return {
			kind: "route-recommendation",
			route: "discovery",
			command: "pi --research",
			confidence: includesAny(text, RESEARCH_PHRASES) ? "high" : "medium",
			reason: includesAny(text, RESEARCH_PHRASES) ? "research verb detected" : "question prompt suggests discovery",
		};
	}

	return {
		kind: "route-recommendation",
		route: "chat",
		command: null,
		confidence: "high",
		reason: "plain discussion with no durable or delivery signal",
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
