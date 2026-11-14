import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export const PROVIDER_ID = "antigravity";
export const PROVIDER_NAME = "Antigravity";

export type AntigravityRouting = {
	off?: string;
	routing?: Partial<Record<"off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max", string>>;
	defaultRequestId?: string;
};

// Routing table mapping public selectable model IDs to their backend request models based on effort.
export const ANTIGRAVITY_ROUTING: Record<string, AntigravityRouting> = {
	"claude-opus-5-5": {
		off: "claude-opus-5-5-low",
		routing: {
			minimal: "claude-opus-5-5-low",
			low: "claude-opus-5-5-low",
			medium: "claude-opus-5-5-medium",
			high: "claude-opus-5-5-high",
			xhigh: "claude-opus-5-5-high",
		},
		defaultRequestId: "claude-opus-5-5-medium",
	},
	"claude-sonnet-5-5": {
		off: "claude-sonnet-5-5-low",
		routing: {
			minimal: "claude-sonnet-5-5-low",
			low: "claude-sonnet-5-5-low",
			medium: "claude-sonnet-5-5-medium",
			high: "claude-sonnet-5-5-high",
			xhigh: "claude-sonnet-5-5-high",
		},
		defaultRequestId: "claude-sonnet-5-5-medium",
	},
	"gemini-3.1-pro": {
		off: "gemini-3.1-pro-low",
		routing: {
			minimal: "gemini-3.1-pro-low",
			low: "gemini-3.1-pro-low",
			high: "gemini-3.1-pro-high",
		},
		defaultRequestId: "gemini-3.1-pro-low",
	},
	"gemini-4-argon": {
		off: "gemini-4-argon-low",
		routing: {
			minimal: "gemini-4-argon-low",
			low: "gemini-4-argon-low",
			medium: "gemini-4-argon-medium",
			high: "gemini-4-argon-high",
			xhigh: "gemini-4-argon-high",
		},
		defaultRequestId: "gemini-4-argon-medium",
	},
	"gemini-4-hydrogen": {
		off: "gemini-4-hydrogen-low",
		routing: {
			minimal: "gemini-4-hydrogen-low",
			low: "gemini-4-hydrogen-low",
			medium: "gemini-4-hydrogen-medium",
			high: "gemini-4-hydrogen-high",
			xhigh: "gemini-4-hydrogen-xhigh",
			max: "gemini-4-hydrogen-xhigh",
		},
		defaultRequestId: "gemini-4-hydrogen-high",
	},
	// These account-catalog routes manage thinking server-side; no low/medium/high IDs exist.
	"gemini-3.8-flash": { defaultRequestId: "gemini-3.8-flash-tiered" },
	"gemini-3.8.flash": { defaultRequestId: "gemini-3.8-flash-tiered" },
	"gemini-3.5-flash": {
		off: "gemini-3.5-flash-low",
		routing: {
			minimal: "gemini-3.5-flash-low",
			low: "gemini-3.5-flash-low",
			medium: "gemini-3.5-flash-medium",
			high: "gemini-3.5-flash-high",
			xhigh: "gemini-3.5-flash-high",
		},
		defaultRequestId: "gemini-3.5-flash-low",
	},
	"gpt-oss-120b": {
		off: "gpt-oss-120b-medium",
		routing: {
			minimal: "gpt-oss-120b-medium",
			low: "gpt-oss-120b-medium",
			medium: "gpt-oss-120b-medium",
			high: "gpt-oss-120b-medium",
		},
		defaultRequestId: "gpt-oss-120b-medium",
	},
};

export const ANTIGRAVITY_MODELS: ProviderModelConfig[] = [
	{
		id: "claude-opus-5-5",
		name: "Claude Opus 5.5 (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, low: "LOW", medium: "MEDIUM", high: "HIGH", xhigh: "HIGH", max: "HIGH" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 250000,
		maxTokens: 64000,
	},
	{
		id: "claude-sonnet-5-5",
		name: "Claude Sonnet 5.5 (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, low: "LOW", medium: "MEDIUM", high: "HIGH", xhigh: "HIGH", max: "HIGH" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 250000,
		maxTokens: 64000,
	},
	{
		id: "gemini-3.1-pro",
		name: "Gemini 3.1 Pro (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, low: "LOW", high: "HIGH", xhigh: "HIGH", max: "HIGH" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65535,
	},
	{
		id: "gemini-4-argon",
		name: "Gemini 4 Argon (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, low: "LOW", medium: "MEDIUM", high: "HIGH", xhigh: "HIGH", max: "HIGH" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65536,
	},
	{
		id: "gemini-4-hydrogen",
		name: "Gemini 4 Hydrogen (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, low: "LOW", medium: "MEDIUM", high: "HIGH", xhigh: "HIGH", max: "HIGH" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65536,
	},
	{
		id: "gemini-3.8-flash",
		name: "Gemini 3.8 Flash (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, minimal: null, low: null, medium: null, high: "AUTO", xhigh: "AUTO", max: "AUTO" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65536,
	},
	{
		id: "gemini-3.8.flash",
		name: "Gemini 3.8 Flash (Antigravity) [alias]",
		reasoning: true,
		thinkingLevelMap: { off: null, minimal: null, low: null, medium: null, high: "AUTO", xhigh: "AUTO", max: "AUTO" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65536,
	},
	{
		id: "gemini-3.5-flash",
		name: "Gemini 3.5 Flash (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, low: "LOW", medium: "MEDIUM", high: "HIGH", xhigh: "HIGH", max: "HIGH" } as any,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65536,
	},
	{
		id: "gpt-oss-120b",
		name: "GPT-OSS 120B (Antigravity)",
		reasoning: true,
		thinkingLevelMap: { off: null, low: "LOW" } as any,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 131072,
		maxTokens: 32768,
	},
];

export function getAntigravityRequestModelId(modelId: string, effort: string | undefined): string {
	const r = ANTIGRAVITY_ROUTING[modelId];
	if (!r) return modelId;
	if (effort === undefined || effort === "off") {
		return r.off ?? r.routing?.minimal ?? r.routing?.low ?? r.defaultRequestId ?? modelId;
	}
	const effortKey = effort as "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	if (effortKey === "max" || effortKey === "xhigh") {
		return r.routing?.max ?? r.routing?.xhigh ?? r.routing?.high ?? r.routing?.low ?? r.routing?.minimal ?? r.off ?? r.defaultRequestId ?? modelId;
	}
	return r.routing?.[effortKey] ?? r.routing?.low ?? r.routing?.minimal ?? r.off ?? r.defaultRequestId ?? modelId;
}
