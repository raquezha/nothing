import fs from "node:fs";

const FORBIDDEN_HANDOFF_FIELDS = ["parentTranscript", "messages", "rawParentHistory", "transcript"];
const PROMPT_FIELDS = [
	["Assignment", "assignment"],
	["Artifact snapshot", "artifactSnapshot"],
	["Accepted decisions", "acceptedDecisions"],
	["Constraints", "constraints"],
	["Open questions", "openQuestions"],
	["Selected skills", "selectedSkills"],
	["Permissions", "permissions"],
	["Context budget", "contextBudget"],
	["Expected result JSON", "expectedResultShape"],
	["Result schema", "resultSchema"],
];

function parseJson(raw, source) {
	try {
		return JSON.parse(String(raw || ""));
	} catch (e) {
		throw new Error(`Invalid handoff JSON from ${source}: ${e.message}`);
	}
}

function readStdin() {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
}

export function parseWorkerHandoffArgs(args = process.argv.slice(2)) {
	const handoffIndex = args.indexOf("--handoff");
	if (handoffIndex === -1) {
		return { handoffPath: null };
	}
	const handoffPath = args[handoffIndex + 1];
	if (!handoffPath) {
		throw new Error("--handoff requires a file path");
	}
	return { handoffPath };
}

export function validateBoundedWorkerHandoff(handoff) {
	if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) {
		throw new Error("Worker handoff must be a plain object");
	}
	if (!handoff.assignment || typeof handoff.assignment !== "string") {
		throw new Error("Worker handoff requires assignment string");
	}
	for (const field of FORBIDDEN_HANDOFF_FIELDS) {
		if (field in handoff) {
			throw new Error(`Forbidden transcript field in worker handoff: ${field}`);
		}
	}
	return true;
}

export async function readWorkerHandoff({ args = process.argv.slice(2), stdin = null } = {}) {
	const { handoffPath } = parseWorkerHandoffArgs(args);
	const raw = handoffPath ? fs.readFileSync(handoffPath, "utf8") : (stdin ?? await readStdin());
	const handoff = parseJson(raw, handoffPath || "stdin");
	validateBoundedWorkerHandoff(handoff);
	return handoff;
}

export function buildWorkerPrompt(handoff) {
	validateBoundedWorkerHandoff(handoff);
	const parts = [
		"You are a Nochestra worker. Use only this bounded handoff. Do not infer or request the parent transcript.",
	];

	for (const [label, key] of PROMPT_FIELDS) {
		if (handoff[key] !== undefined) {
			const value = typeof handoff[key] === "string" ? handoff[key] : JSON.stringify(handoff[key], null, 2);
			parts.push(`${label}:\n${value}`);
		}
	}

	parts.push('Return only compact JSON with keys: "status", "taskId", "summary", "nextStep".');
	return parts.join("\n\n");
}
