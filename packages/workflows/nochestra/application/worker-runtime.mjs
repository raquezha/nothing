import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkerHandoff, validateBoundedWorkerHandoff } from "./worker-handoff.mjs";

const DEFAULT_TRIAGE_HELPER_PATH = process.env.NOCH_TRIAGE_HELPER_PATH || fileURLToPath(new URL("../../norpiv/scripts/triage_helper.sh", import.meta.url));

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function sectionBody(text, section) {
	const match = text.match(new RegExp(`(?:^|\\n)## \\[${section}\\]\\n([\\s\\S]*?)(?=\\n## \\[|$)`));
	return match ? match[1].trim() : "";
}

function hasMeaningfulContent(body) {
	return body
		.split("\n")
		.map((line) => line.trim())
		.some((line) => line && line !== "-" && line !== "- [ ]");
}

function inferNextStep(workText) {
	if (hasMeaningfulContent(sectionBody(workText, "PLAN"))) {
		return "/implement";
	}
	if (hasMeaningfulContent(sectionBody(workText, "GRILL"))) {
		return "/plan";
	}
	if (hasMeaningfulContent(sectionBody(workText, "BRIEF"))) {
		return "/grill-with-docs";
	}
	return "/frame";
}

function inferAction(stdout) {
	if (/Created WORK\.md|Creating task workspace/.test(stdout)) {
		return "created";
	}
	if (/Resumed existing task/.test(stdout)) {
		return "resumed";
	}
	if (/Reopened task/.test(stdout)) {
		return "reopened";
	}
	return "ok";
}

function extractTask(handoff) {
	const source = handoff.artifact?.source ?? handoff.artifactSnapshot?.source ?? handoff.task?.source;
	const id = handoff.artifact?.id ?? handoff.artifactSnapshot?.id ?? handoff.task?.id;
	const mode = handoff.artifact?.mode ?? handoff.task?.mode ?? "auto";
	if (!source || !id) {
		throw new Error("Triage worker handoff requires artifact source and id");
	}
	return { source, id, mode };
}

function runScript(command, args, cwd) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error((stderr || stdout).trim() || `Worker helper exited with code ${code}`));
				return;
			}
			resolve({ stdout, stderr });
		});
	});
}

export async function executeTriageWorker(handoff, { cwd = process.cwd(), triageHelperPath = DEFAULT_TRIAGE_HELPER_PATH } = {}) {
	validateBoundedWorkerHandoff(handoff);
	const { source, id, mode } = extractTask(handoff);
	const destination = handoff.destination ?? handoff.artifact?.destination ?? "triage";
	if (destination !== "triage") {
		throw new Error(`Unsupported worker destination: ${destination}`);
	}

	const { stdout } = await runScript(triageHelperPath, [source, id, mode], cwd);
	const active = readJson(path.join(cwd, ".workflow/active.json"));
	const workText = readText(path.join(cwd, active.stateFile));
	const action = inferAction(stdout);

	return {
		status: action,
		taskId: active.id,
		summary: `Triage ${action} for ${source}:${id}`,
		nextStep: inferNextStep(workText),
	};
}

export async function runNochestraWorker(options = {}) {
	const handoff = options.handoff ?? await readWorkerHandoff(options);
	return executeTriageWorker(handoff, options);
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entryPath) {
	runNochestraWorker()
		.then((result) => {
			process.stdout.write(`${JSON.stringify(result)}\n`);
		})
		.catch((error) => {
			process.stderr.write(`${error.message}\n`);
			process.exitCode = 1;
		});
}
