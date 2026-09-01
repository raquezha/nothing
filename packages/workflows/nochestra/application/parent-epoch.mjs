import { validateCheckpoint } from "../domain/checkpoint-contract.mjs";

export const DEFAULT_COMPACTION_THRESHOLD = 4000;
export const DEFAULT_QUARANTINE_TURNS = 2;

export function shouldCompactParentEpoch(opts = {}) {
	const envVal = process.env.NOCH_COMPACTION_TOKEN_THRESHOLD;
	const threshold = opts.maxTokens ?? (envVal ? parseInt(envVal, 10) : DEFAULT_COMPACTION_THRESHOLD);
	if (typeof opts.activeTokens === "number" && opts.activeTokens >= threshold) {
		return true;
	}
	if (typeof opts.turnCount === "number" && typeof opts.turnThreshold === "number" && opts.turnCount >= opts.turnThreshold) {
		return true;
	}
	return false;
}

export function compactParentEpoch({
	currentEpochId = "epoch-1",
	checkpoint,
	instructions = "",
	transcript = [],
	quarantineWindowSize = DEFAULT_QUARANTINE_TURNS,
	currentApprovals = [],
	taskMaterial = {},
	contextSnapshot = null,
} = {}) {
	validateCheckpoint(checkpoint);

	const turns = Array.isArray(transcript) ? transcript : [];
	const cutoff = Math.max(0, turns.length - quarantineWindowSize);
	const archivedTranscript = turns.slice(0, cutoff);
	const recentTurns = turns.slice(cutoff);

	const transitionResult = transitionParentEpoch({
		currentEpochId,
		checkpoint,
		instructions,
		recentTurns,
		currentApprovals,
		taskMaterial,
		archivedTranscript,
		contextSnapshot,
	});

	validateCheckpoint(transitionResult.hotContext.checkpoint);

	return transitionResult;
}






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
