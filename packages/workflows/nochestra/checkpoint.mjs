import fs from "node:fs";

export const REQUIRED_CHECKPOINT_KEYS = [
	"subject",
	"goal",
	"decisions",
	"constraints",
	"openQuestions",
	"rejectedOptions",
	"currentRoute",
	"suggestedNextRoute",
];

const FORBIDDEN_ACCUMULATION_KEYS = [
	"history",
	"priorCheckpoints",
	"previousCheckpoints",
	"messages",
	"transcript",
];

export function validateCheckpoint(checkpoint) {
	if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
		throw new Error("Checkpoint must be a plain object");
	}

	for (const key of REQUIRED_CHECKPOINT_KEYS) {
		if (!(key in checkpoint)) {
			throw new Error(`Missing required checkpoint field: ${key}`);
		}
	}

	for (const key of FORBIDDEN_ACCUMULATION_KEYS) {
		if (key in checkpoint) {
			throw new Error(`Forbidden transcript/history accumulation field found: ${key}`);
		}
	}

	return true;
}

export function writeCheckpoint(filePath, checkpoint) {
	validateCheckpoint(checkpoint);
	fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), "utf8");
}

export function readCheckpoint(filePath) {
	const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
	validateCheckpoint(data);
	return data;
}
