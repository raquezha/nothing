import { buildParentEpochContext } from "./parent-epoch.mjs";

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

export function validateCompactWorkerResult(result) {
	if (!result || typeof result !== "object" || Array.isArray(result)) {
		throw new Error("Worker result must be a plain object");
	}

	for (const key of ["status", "taskId", "summary", "nextStep"]) {
		if (!(key in result)) {
			throw new Error(`Missing required worker result field: ${key}`);
		}
	}

	for (const forbidden of ["transcript", "messages", "rawWorkerLog", "fullParentTranscript"]) {
		if (forbidden in result) {
			throw new Error(`Forbidden worker result field: ${forbidden}`);
		}
	}

	return true;
}
