import fs from "node:fs";
import {
	NOCHESTRA_HANDOFF_CONTRACT,
	assertNoTranscriptFields,
	assertPlainObject,
} from "../domain/handoff-contract.mjs";

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
	assertPlainObject(handoff, "Worker handoff");
	if (!handoff.assignment || typeof handoff.assignment !== "string") {
		throw new Error("Worker handoff requires assignment string");
	}
	assertNoTranscriptFields(handoff, "worker handoff");
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

	for (const [key, rawValue] of Object.entries(handoff)) {
		const value = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue, null, 2);
		parts.push(`${key}:\n${value}`);
	}

	parts.push(`Return only compact JSON with keys: ${NOCHESTRA_HANDOFF_CONTRACT.compactWorkerResultKeys.map((key) => `"${key}"`).join(", ")}.`);
	return parts.join("\n\n");
}
