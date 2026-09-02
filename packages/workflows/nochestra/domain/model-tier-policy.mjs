export const DEFAULT_LOCAL_TIER = Object.freeze({
	provider: "ollama",
	name: "qwen:7b",
	contextWindow: 8192,
});

export const DEFAULT_CLOUD_TIER = Object.freeze({
	provider: "openai",
	name: "gpt-4o",
	contextWindow: 128000,
});

const LIGHTWEIGHT_DESTINATIONS = new Set(["triage", "frame", "note"]);

export function resolveModelTier(destination, options = {}) {
	const env = options.env || process.env;
	const localModel = {
		provider: env.NOCH_LOCAL_PROVIDER || DEFAULT_LOCAL_TIER.provider,
		name: env.NOCH_LOCAL_MODEL || DEFAULT_LOCAL_TIER.name,
		contextWindow: Number(env.NOCH_LOCAL_CONTEXT_WINDOW) || DEFAULT_LOCAL_TIER.contextWindow,
	};
	const cloudModel = {
		provider: env.NOCH_CLOUD_PROVIDER || DEFAULT_CLOUD_TIER.provider,
		name: env.NOCH_CLOUD_MODEL || DEFAULT_CLOUD_TIER.name,
		contextWindow: Number(env.NOCH_CLOUD_CONTEXT_WINDOW) || DEFAULT_CLOUD_TIER.contextWindow,
	};

	if (LIGHTWEIGHT_DESTINATIONS.has(destination)) {
		return {
			model: localModel,
			fallbackModel: cloudModel,
			tier: "local-fast",
		};
	}

	return {
		model: cloudModel,
		fallbackModel: null,
		tier: "cloud-premium",
	};
}
