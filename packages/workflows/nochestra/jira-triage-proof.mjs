import { validateCompactWorkerResult } from "./handoff-contract.mjs";
import { buildParentEpochContext } from "./parent-epoch.mjs";

export { validateCompactWorkerResult } from "./handoff-contract.mjs";

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

export function buildJiraTriageProof({
	checkpoint,
	jiraIssue,
	jiraUpdate = null,
	triageTask,
	currentApprovals = [],
	recentTurns = [],
	contextBudget = { maxTurns: 3 },
} = {}) {
	if (!jiraIssue || typeof jiraIssue !== "object") {
		throw new Error("jiraIssue is required");
	}

	if (!triageTask || typeof triageTask !== "object") {
		throw new Error("triageTask is required");
	}

	if (triageTask.destination !== "triage") {
		throw new Error("triageTask.destination must be 'triage'");
	}

	if (jiraUpdate && !currentApprovals.includes("jira-update-approved")) {
		throw new Error("jiraUpdate requires explicit jira-update-approved approval");
	}

	const hotContext = buildParentEpochContext({
		checkpoint,
		recentTurns,
		currentApprovals,
		taskMaterial: {
			jiraIssue: {
				key: jiraIssue.key,
				summary: jiraIssue.summary,
			},
			triageTask: {
				source: triageTask.source,
				id: triageTask.id,
			},
		},
	});

	return {
		route: "jira-refine-then-triage",
		jira: {
			issue: {
				key: jiraIssue.key,
				summary: jiraIssue.summary,
			},
			update: jiraUpdate ? clone(jiraUpdate) : null,
			updateApproved: currentApprovals.includes("jira-update-approved"),
		},
		handoff: {
			assignment: `Create or update RPIV task artifact for ${triageTask.source}:${triageTask.id}`,
			destination: triageTask.destination,
			artifact: {
				source: triageTask.source,
				id: triageTask.id,
				stateFile: triageTask.stateFile ?? null,
			},
			acceptedDecisions: clone(hotContext.checkpoint.decisions),
			constraints: clone(hotContext.checkpoint.constraints),
			openQuestions: clone(hotContext.checkpoint.openQuestions),
			permissions: [jiraUpdate ? "apply-approved-jira-update" : "read-jira", "run-triage"],
			contextBudget: clone(contextBudget),
			resultSchema: {
				required: ["status", "taskId", "summary", "nextStep"],
				optional: ["jiraUpdateApplied", "workerFailure", "warnings"],
			},
		},
		parentContext: {
			currentRoute: hotContext.checkpoint.currentRoute,
			suggestedNextRoute: hotContext.checkpoint.suggestedNextRoute,
			recentTurns: hotContext.recentTurns,
		},
	};
}

export function evaluateJiraTriageExecution({
	proof,
	userAction = "dispatch",
	jiraAdapter = null,
	workerRunner = null,
} = {}) {
	if (!proof || typeof proof !== "object" || proof.route !== "jira-refine-then-triage") {
		throw new Error("Invalid Nochestra Jira triage proof object");
	}

	if (userAction === "cancel") {
		return {
			status: "cancelled",
			jiraUpdateApplied: false,
			summary: "Dispatch cancelled by user. Existing workflow state remains recoverable.",
			nextStep: "manual-takeover",
		};
	}

	let jiraUpdateApplied = false;

	if (proof.jira.update) {
		if (!proof.jira.updateApproved) {
			throw new Error("Cannot apply Jira update without explicit user approval");
		}
		if (jiraAdapter && typeof jiraAdapter.applyUpdate === "function") {
			jiraAdapter.applyUpdate(proof.jira.update);
		}
		jiraUpdateApplied = true;
	}

	if (!workerRunner || typeof workerRunner !== "function") {
		return {
			status: "pending-worker",
			jiraUpdateApplied,
			summary: "Jira update applied. Awaiting worker dispatch.",
			nextStep: "/triage",
		};
	}

	let res;
	try {
		res = workerRunner(proof.handoff);
	} catch (e) {
		return {
			status: "failed",
			jiraUpdateApplied,
			workerFailure: e?.message ?? String(e),
			summary: "Triage worker execution failed.",
			nextStep: "retry-or-direct-rpiv",
			reapprovalRequired: false,
		};
	}

	try {
		validateCompactWorkerResult(res);
	} catch (e) {
		return {
			status: "rejected",
			jiraUpdateApplied,
			summary: "Worker returned invalid payload.",
			nextStep: "retry",
		};
	}

	if (res.status === "failed" || res.status === "error") {
		return {
			status: "failed",
			jiraUpdateApplied,
			workerFailure: res.summary ?? "Worker failure",
			summary: "Worker execution reported failure.",
			nextStep: "retry-or-direct-rpiv",
		};
	}

	return {
		status: res.status ?? "ok",
		taskId: res.taskId,
		jiraUpdateApplied,
		summary: res.summary,
		nextStep: res.nextStep,
	};
}
