import { validateCheckpoint } from "./checkpoint.mjs";

export function buildParentEpochContext({
	instructions = "",
	checkpoint,
	recentTurns = [],
	currentApprovals = [],
	taskMaterial = {},
} = {}) {
	validateCheckpoint(checkpoint);

	return {
		instructions,
		checkpoint: JSON.parse(JSON.stringify(checkpoint)),
		recentTurns: Array.isArray(recentTurns) ? recentTurns.slice() : [],
		currentApprovals: Array.isArray(currentApprovals) ? currentApprovals.slice() : [],
		taskMaterial: typeof taskMaterial === "object" && taskMaterial !== null ? JSON.parse(JSON.stringify(taskMaterial)) : {},
	};
}

export function transitionParentEpoch({
	currentEpochId = "epoch-1",
	checkpoint,
	instructions = "",
	recentTurns = [],
	currentApprovals = [],
	taskMaterial = {},
	archivedTranscript = [],
	contextSnapshot = null,
} = {}) {
	validateCheckpoint(checkpoint);

	const epochNumber = parseInt(currentEpochId.replace(/^epoch-/, ""), 10) || 1;
	const nextEpochId = `epoch-${epochNumber + 1}`;

	const hotContext = buildParentEpochContext({
		instructions,
		checkpoint,
		recentTurns,
		currentApprovals,
		taskMaterial,
	});

	const coldArchive = {
		epochId: currentEpochId,
		archivedTurns: Array.isArray(archivedTranscript) ? archivedTranscript.slice() : [],
		archivedAt: new Date().toISOString(),
	};

	const beforeActiveTokens = contextSnapshot?.activeTokens ?? null;
	const beforePeakTokens = contextSnapshot?.peakTokens ?? null;
	const contextWindow = contextSnapshot?.contextWindow ?? null;

	const hotContextJson = JSON.stringify(hotContext);
	const afterActiveTokensEstimate = Math.ceil(hotContextJson.length / 4);

	return {
		epochId: nextEpochId,
		previousEpochId: currentEpochId,
		hotContext,
		coldArchive,
		metrics: {
			beforeActiveTokens,
			beforePeakTokens,
			contextWindow,
			afterActiveTokensEstimate,
		},
	};
}

export function retrieveArchivedTurns({ coldArchive, turnIndices } = {}) {
	if (!coldArchive || !Array.isArray(coldArchive.archivedTurns)) {
		throw new Error("Invalid cold archive object");
	}

	if (!Array.isArray(turnIndices)) {
		return coldArchive.archivedTurns.slice();
	}

	return turnIndices
		.map((idx) => coldArchive.archivedTurns[idx])
		.filter((turn) => turn !== undefined);
}
