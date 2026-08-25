import fs from "node:fs";
import { validateCheckpoint } from "./domain/checkpoint-contract.mjs";

export { REQUIRED_CHECKPOINT_KEYS, validateCheckpoint } from "./domain/checkpoint-contract.mjs";

export function writeCheckpoint(filePath, checkpoint) {
	validateCheckpoint(checkpoint);
	fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), "utf8");
}

export function readCheckpoint(filePath) {
	const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
	validateCheckpoint(data);
	return data;
}
