const DELIVERY_COMMANDS = new Set(["triage", "frame", "grill-with-docs", "plan", "implement", "verify", "sync"]);
const STAGE_COMMANDS_OPTIONAL_TARGET = new Set(["frame", "grill-with-docs", "plan", "implement", "verify", "sync"]);
const TASK_REF_RE = /^(github|gitlab|jira|local):([^\s]+)$/i;
const TRACKED_REF_PATTERN = "((?:github|gitlab|jira|local):\\S+)";

function normalizeInput(input) {
	if (Array.isArray(input)) {
		return input.join(" ").trim();
	}
	return typeof input === "string" ? input.trim() : "";
}

function normalizeForMatch(input) {
	return normalizeInput(input).replace(/\s+/g, " ");
}

function normalizeTrackedTaskRef(value) {
	const task = parseTrackedTaskRef(value);
	return task ? `${task.source}:${task.id}` : String(value || "").trim();
}

const ROUTE_RULES = [
	{
		id: "delivery-triage-ref",
		route: "delivery",
		pattern: new RegExp(`^/?triage\\s+${TRACKED_REF_PATTERN}$`, "i"),
		command: (match) => `/triage ${normalizeTrackedTaskRef(match[1])}`,
	},
	{
		id: "delivery-unsupported-action-ref",
		route: "delivery",
		pattern: new RegExp(`^/?(?:implement|verify|fix|ship|deliver)\\s+${TRACKED_REF_PATTERN}$`, "i"),
		command: () => null,
	},
	{
		id: "notes-write-destination",
		route: "notes",
		pattern: /(?:^|\b(?:and|then)\s+)(?:please\s+)?(?:write|save|add)\b[\s\S]*\b(?:to|in)\s+(?:notes|the vault)\b/i,
		command: () => "pi --notes",
	},
	{
		id: "notes-explicit-note",
		route: "notes",
		pattern: /^\/?(?:note|distill)\s+\S/i,
		command: () => "pi --notes",
	},
	{
		id: "discovery-explicit-research",
		route: "discovery",
		pattern: /^\/?(?:research|investigate|look\s+up)\s+\S/i,
		command: () => "pi --research",
	},
];

function routeMatches(input) {
	const text = normalizeForMatch(input);
	return ROUTE_RULES.flatMap((rule) => {
		const match = rule.pattern.exec(text);
		return match ? [{ rule, match }] : [];
	});
}

export function stripOuterQuotes(str) {
	const s = String(str || "").trim();
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1).trim();
	}
	return s;
}

export function slugifyTopic(topic) {
	const slug = String(topic || "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || `topic-${Date.now().toString(36)}`;
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
	const matches = routeMatches(input);
	const routes = new Set(matches.map(({ rule }) => rule.route));

	if (routes.size > 1) {
		return {
			kind: "route-recommendation",
			route: "needs-confirmation",
			command: null,
			confidence: "high",
			reason: `rules:${matches.map(({ rule }) => rule.id).join(",")}`,
		};
	}

	if (matches.length === 1) {
		const [{ rule, match }] = matches;
		return {
			kind: "route-recommendation",
			route: rule.route,
			command: rule.command(match),
			confidence: "high",
			reason: `rule:${rule.id}`,
		};
	}

	return {
		kind: "route-recommendation",
		route: "chat",
		command: null,
		confidence: "high",
		reason: "rule:chat-fallback",
	};
}

function extractModelOverride(args) {
	if (!Array.isArray(args) || args.length === 0) return { cleanArgs: args || [], requestedModel: null };
	const clean = [];
	let requestedModel = null;
	for (let i = 0; i < args.length; i++) {
		const token = args[i];
		const lower = token.toLowerCase();
		if ((lower === "use" || lower === "with" || lower === "using" || lower === "--model") && i + 1 < args.length) {
			let targetIdx = i + 1;
			const nextLower = args[targetIdx].toLowerCase();
			if ((nextLower === "model" || nextLower === "provider") && targetIdx + 1 < args.length) {
				targetIdx++;
			}
			let rawModel = stripOuterQuotes(args[targetIdx]);
			rawModel = rawModel.replace(/[,.!;]+$/, "");
			requestedModel = stripOuterQuotes(rawModel);
			i = targetIdx;
		} else {
			clean.push(token);
		}
	}
	return { cleanArgs: clean, requestedModel };
}

export function parseNochestraInput(input) {
	const raw = normalizeInput(input);
	if (!raw) {
		return { kind: "chat", prompt: "" };
	}

	let command = "";
	let rest = [];

	if (raw.startsWith("/")) {
		const [head, ...r] = raw.split(/\s+/);
		command = head.slice(1).toLowerCase();
		rest = r;
	} else {
		const [head, ...r] = raw.split(/\s+/);
		const lowerHead = head.toLowerCase();
		if (lowerHead === "research") {
			command = "research";
			rest = r;
		} else if (lowerHead === "note") {
			command = "note";
			rest = r;
		}
	}

	if (command === "research") {
		const topic = stripOuterQuotes(rest.join(" "));
		if (!topic) {
			return {
				kind: "delivery-error",
				command: "research",
				error: "Research command requires a topic.",
			};
		}
		const id = slugifyTopic(topic);
		return {
			kind: "delivery",
			route: "discovery",
			command: "research",
			task: { source: "research", id },
			topic,
			args: [topic],
			raw,
		};
	}

	if (command === "note") {
		const topic = stripOuterQuotes(rest.join(" "));
		if (!topic) {
			return {
				kind: "delivery-error",
				command: "note",
				error: "Note command requires a topic.",
			};
		}
		const id = slugifyTopic(topic);
		return {
			kind: "delivery",
			route: "notes",
			command: "note",
			task: { source: "note", id },
			topic,
			args: [topic],
			raw,
		};
	}

	if (!raw.startsWith("/")) {
		return { kind: "chat", prompt: raw };
	}

	if (!DELIVERY_COMMANDS.has(command)) {
		return { kind: "chat", prompt: raw };
	}

	const task = parseTrackedTaskRef(rest[0]);
	if (!task && !STAGE_COMMANDS_OPTIONAL_TARGET.has(command)) {
		return {
			kind: "delivery-error",
			command,
			error: "Delivery commands require an explicit source:id target.",
		};
	}

	const remainingArgs = task ? rest.slice(1) : rest;
	const { cleanArgs, requestedModel } = extractModelOverride(remainingArgs);

	return {
		kind: "delivery",
		route: "delivery",
		command,
		task: task || null,
		args: cleanArgs,
		...(requestedModel ? { requestedModel } : {}),
		raw,
	};
}
