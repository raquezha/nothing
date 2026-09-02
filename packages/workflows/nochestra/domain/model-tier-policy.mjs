export const AVAILABLE_MODEL_TIERS = Object.freeze({
	ollama: [
		{ provider: "ollama", name: "ornith:9b", contextWindow: 262144 },
	],
	antigravity: [
		{ provider: "antigravity", name: "gemini-3.7-flash", contextWindow: 1048576 },
		{ provider: "antigravity", name: "gemini-3.6-flash", contextWindow: 1048576 },
		{ provider: "antigravity", name: "gemini-3.5-flash", contextWindow: 1048576 },
		{ provider: "antigravity", name: "gemini-3.1-pro", contextWindow: 1048576 },
		{ provider: "antigravity", name: "claude-sonnet-4-6", contextWindow: 250000 },
		{ provider: "antigravity", name: "claude-opus-4-6", contextWindow: 250000 },
		{ provider: "antigravity", name: "gpt-oss-120b", contextWindow: 131072 },
	],
	"openai-codex": [
		{ provider: "openai-codex", name: "gpt-5.3-codex-spark", contextWindow: 128000 },
		{ provider: "openai-codex", name: "gpt-5.4", contextWindow: 272000 },
		{ provider: "openai-codex", name: "gpt-5.4-mini", contextWindow: 272000 },
		{ provider: "openai-codex", name: "gpt-5.5", contextWindow: 272000 },
		{ provider: "openai-codex", name: "gpt-5.6-luna", contextWindow: 272000 },
		{ provider: "openai-codex", name: "gpt-5.6-sol", contextWindow: 272000 },
		{ provider: "openai-codex", name: "gpt-5.6-terra", contextWindow: 272000 },
	],
});

export const DEFAULT_LOCAL_TIER = Object.freeze(AVAILABLE_MODEL_TIERS.ollama[0]);
export const DEFAULT_CLOUD_TIER = Object.freeze(AVAILABLE_MODEL_TIERS.antigravity[1]);

const MODEL_ALIASES = new Map();
for (const models of Object.values(AVAILABLE_MODEL_TIERS)) {
	for (const m of models) {
		MODEL_ALIASES.set(m.name.toLowerCase(), m);
		const compact = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
		if (!MODEL_ALIASES.has(compact)) {
			MODEL_ALIASES.set(compact, m);
		}
	}
}

// Typo and shortcut alias mappings
const TYPO_ALIASES = [
	["ornith", AVAILABLE_MODEL_TIERS.ollama[0]],
	["ornith9", AVAILABLE_MODEL_TIERS.ollama[0]],
	["ornith-9b", AVAILABLE_MODEL_TIERS.ollama[0]],
	["3.6flash", AVAILABLE_MODEL_TIERS.antigravity[1]],
	["3.6-flash", AVAILABLE_MODEL_TIERS.antigravity[1]],
	["36flash", AVAILABLE_MODEL_TIERS.antigravity[1]],
	["3.7flash", AVAILABLE_MODEL_TIERS.antigravity[0]],
	["3.7-flash", AVAILABLE_MODEL_TIERS.antigravity[0]],
	["37flash", AVAILABLE_MODEL_TIERS.antigravity[0]],
	["sonnet", AVAILABLE_MODEL_TIERS.antigravity[4]],
	["opus", AVAILABLE_MODEL_TIERS.antigravity[5]],
	["gpt54", AVAILABLE_MODEL_TIERS["openai-codex"][1]],
	["gpt54m", AVAILABLE_MODEL_TIERS["openai-codex"][2]],
	["gpt54mini", AVAILABLE_MODEL_TIERS["openai-codex"][2]],
];

for (const [alias, model] of TYPO_ALIASES) {
	if (!MODEL_ALIASES.has(alias)) {
		MODEL_ALIASES.set(alias, model);
	}
}

const PROVIDER_ALIASES = new Map([
	["openai", "openai-codex"],
	["codex", "openai-codex"],
	["gemini", "antigravity"],
	["google", "antigravity"],
]);

export function resolveModelOverride(overrideSpec) {
	if (!overrideSpec || typeof overrideSpec !== "string") return null;
	const spec = overrideSpec.trim().toLowerCase();
	if (spec.includes("/")) {
		let [provider, ...rest] = spec.split("/");
		const name = rest.join("/");
		provider = PROVIDER_ALIASES.get(provider) || provider;
		const known = MODEL_ALIASES.get(name) || MODEL_ALIASES.get(name.replace(/[^a-z0-9]/g, ""));
		return {
			provider,
			name,
			contextWindow: known?.contextWindow || 128000,
		};
	}
	const direct = MODEL_ALIASES.get(spec);
	if (direct) return direct;
	const compactSpec = spec.replace(/[^a-z0-9]/g, "");
	return MODEL_ALIASES.get(compactSpec) || null;
}

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
