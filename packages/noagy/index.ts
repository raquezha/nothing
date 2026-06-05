import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { createAssistantMessageEventStream, type AssistantMessageEventStream } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ProviderModelConfig } from "@earendil-works/pi-coding-agent";

type OAuthCredentials = {
	refresh: string;
	access: string;
	expires: number;
	projectId?: string;
	email?: string;
};

type OAuthCallbacks = {
	onAuth(params: { url: string; instructions?: string }): void;
	onPrompt?(params: { message: string }): Promise<string>;
	onSelect?(params: { message: string; options: { id: string; label: string }[] }): Promise<string | undefined>;
};

type AntigravityApiKey = {
	token: string;
	projectId: string;
};

const PROVIDER_ID = "antigravity";
const PROVIDER_NAME = "Antigravity";
const MODEL_ID = "gemini-3.5-flash";
const DEFAULT_RUNTIME_MODEL_ID = "gemini-3.5-flash-low";
const MODEL_VARIANTS = [
	{
		id: "gemini-3.5-flash-low",
		name: "Gemini 3.5 Flash Low (Antigravity)",
		runtimeModel: "gemini-3.5-flash-extra-low",
		reasoning: true,
		input: ["text", "image"] as Array<"text" | "image">,
		contextWindow: 1048576,
		maxTokens: 65535,
	},
	{
		id: MODEL_ID,
		name: "Gemini 3.5 Flash Medium (Antigravity)",
		runtimeModel: DEFAULT_RUNTIME_MODEL_ID,
		reasoning: true,
		input: ["text", "image"] as Array<"text" | "image">,
		contextWindow: 1048576,
		maxTokens: 65535,
	},
	{
		id: "gemini-3.5-flash-high",
		name: "Gemini 3.5 Flash High (Antigravity)",
		runtimeModel: "gemini-3-flash-agent",
		reasoning: true,
		input: ["text", "image"] as Array<"text" | "image">,
		contextWindow: 1048576,
		maxTokens: 65535,
	},
	{
		id: "gemini-3.1-pro-low",
		name: "Gemini 3.1 Pro Low (Antigravity)",
		runtimeModel: "gemini-3.1-pro-low",
		reasoning: true,
		input: ["text", "image"] as Array<"text" | "image">,
		contextWindow: 1048576,
		maxTokens: 65535,
	},
	{
		id: "gemini-3.1-pro-high",
		name: "Gemini 3.1 Pro High (Antigravity)",
		runtimeModel: "gemini-pro-agent",
		reasoning: true,
		input: ["text", "image"] as Array<"text" | "image">,
		contextWindow: 1048576,
		maxTokens: 65535,
	},
	{
		id: "claude-sonnet-4-6-thinking",
		name: "Claude Sonnet 4.6 Thinking (Antigravity)",
		runtimeModel: "claude-sonnet-4-6",
		reasoning: true,
		input: ["text", "image"] as Array<"text" | "image">,
		contextWindow: 200000,
		maxTokens: 64000,
	},
	{
		id: "claude-opus-4-6-thinking",
		name: "Claude Opus 4.6 Thinking (Antigravity)",
		runtimeModel: "claude-opus-4-6-thinking",
		reasoning: true,
		input: ["text", "image"] as Array<"text" | "image">,
		contextWindow: 200000,
		maxTokens: 128000,
	},
	{
		id: "gpt-oss-120b-medium",
		name: "GPT-OSS 120B Medium (Antigravity)",
		runtimeModel: "gpt-oss-120b-medium",
		reasoning: false,
		input: ["text"] as Array<"text" | "image">,
		contextWindow: 131072,
		maxTokens: 32768,
	},
] as const;
const DEFAULT_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com";
const ENDPOINT_FALLBACKS = [DEFAULT_ENDPOINT];
const REDIRECT_URI = "http://localhost:51121/oauth-callback";
const CALLBACK_HOST = process.env.NOAGY_CALLBACK_HOST || "127.0.0.1";
const DEFAULT_PROJECT_ID = process.env.NOAGY_PROJECT_ID || stableProjectId(process.cwd());
const CLIENT_ID = process.env.NOAGY_CLIENT_ID || Buffer.from(
	"MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlc" + "C5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==",
	"base64",
).toString("utf8");
const CLIENT_SECRET = process.env.NOAGY_CLIENT_SECRET || Buffer.from(
	"R09DU1BYLUs1OEZXUjQ" + "4NkxkTEoxbUxCOHNYQzR6NnFEQWY=",
	"base64",
).toString("utf8");
const SCOPES = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"https://www.googleapis.com/auth/cclog",
	"https://www.googleapis.com/auth/experimentsandconfigs",
];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANTIGRAVITY_SYSTEM_INSTRUCTION =
	"You are Antigravity, a powerful agentic AI coding assistant designed by Google DeepMind. " +
	"You are pair programming with a user to solve coding tasks. Be concise, practical, and tool-aware.";

let lastStatus: number | undefined;
let lastEndpoint: string | undefined;
let lastError: string | undefined;
let lastProjectId: string | undefined;
let lastResolvedRuntimeModel: string | undefined;
let lastAvailableModels: string | undefined;
let lastMatchedModelDebug: string | undefined;

function nowRequestId(): string {
	return `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function stableProjectId(seed: string): string {
	const bytes = createHash("sha1").update(`antigravity:${seed}`).digest().subarray(0, 16);
	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function base64Url(buffer: Buffer): string {
	return buffer.toString("base64url");
}

function generatePKCE(): { verifier: string; challenge: string } {
	const verifier = base64Url(randomBytes(32));
	const challenge = base64Url(createHash("sha256").update(verifier).digest());
	return { verifier, challenge };
}

function endpointCandidates(): string[] {
	const explicit = process.env.NOAGY_BASE_URL?.trim();
	return explicit ? [explicit] : ENDPOINT_FALLBACKS;
}

function safeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sanitizeText(text: unknown): string {
	return String(text ?? "").replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

function parseApiKey(apiKeyRaw: string | undefined): AntigravityApiKey {
	if (!apiKeyRaw) throw new Error("No Antigravity OAuth credentials. Run /login antigravity.");
	try {
		const parsed = JSON.parse(apiKeyRaw) as Partial<AntigravityApiKey>;
		if (!parsed.token || !parsed.projectId) throw new Error("missing token or projectId");
		return { token: parsed.token, projectId: parsed.projectId };
	} catch (error) {
		throw new Error(`Invalid Antigravity credentials. Run /login antigravity. (${safeError(error)})`);
	}
}

function antigravityHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
		Accept: "text/event-stream",
		"User-Agent": process.env.NOAGY_USER_AGENT || "antigravity/1.0.5 darwin/arm64",
		"X-Goog-Api-Client": "google-api-nodejs-client/9.15.1",
		"Client-Metadata": JSON.stringify({ ideType: "ANTIGRAVITY" }),
	};
}

function jsonOrTextError(text: string): string {
	try {
		const parsed = JSON.parse(text) as { error?: { message?: string; status?: string; code?: number } };
		if (parsed.error?.message) return parsed.error.message;
	} catch {
		// not JSON
	}
	return text;
}

async function getUserEmail(token: string): Promise<string | undefined> {
	try {
		const res = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) return undefined;
		const data = (await res.json()) as { email?: string };
		return data.email;
	} catch {
		return undefined;
	}
}

function extractProjectId(data: any): string | undefined {
	if (!data || typeof data !== "object") return undefined;
	const direct = data.antigravityProjectId ?? data.projectId ?? data.backendProjectId ?? data.userDefinedCloudaicompanionProject ?? data.cloudaicompanionProject ?? data.project;
	if (typeof direct === "string" && direct) return direct;
	if (direct && typeof direct === "object" && typeof direct.id === "string" && direct.id) return direct.id;
	for (const key of ["projects", "projectIds", "cloudaicompanionProjects"]) {
		const value = data[key];
		if (Array.isArray(value)) {
			for (const item of value) {
				const nested = extractProjectId(item);
				if (nested) return nested;
				if (typeof item === "string" && item) return item;
			}
		}
	}
	return undefined;
}

async function listCloudAICompanionProjects(token: string): Promise<string | undefined> {
	for (const endpoint of endpointCandidates()) {
		try {
			const res = await fetch(`${endpoint}/v1internal:listCloudAICompanionProjects`, {
				method: "POST",
				headers: antigravityHeaders(token),
				body: JSON.stringify({}),
			});
			lastStatus = res.status;
			lastEndpoint = endpoint;
			if (!res.ok) continue;
			return extractProjectId(await res.json());
		} catch (error) {
			lastError = safeError(error);
		}
	}
	return undefined;
}

function collectModelLabels(value: any, out: string[] = []): string[] {
	if (!value || out.length > 50) return out;
	if (typeof value === "string") {
		if (/gemini|claude|gpt-oss/i.test(value)) out.push(value);
		return out;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectModelLabels(item, out);
		return out;
	}
	if (typeof value === "object") {
		for (const key of ["id", "name", "label", "displayName", "model", "modelId"]) collectModelLabels(value[key], out);
		for (const nested of Object.values(value)) {
			if (nested && typeof nested === "object") collectModelLabels(nested, out);
		}
	}
	return out;
}

function summarizeModelCandidate(value: any): string {
	if (!value || typeof value !== "object") return String(value ?? "none");
	const out: Record<string, unknown> = {};
	for (const [key, raw] of Object.entries(value)) {
		if (/token|auth|credential|secret|email/i.test(key)) continue;
		if (raw === null || ["string", "number", "boolean"].includes(typeof raw)) out[key] = raw;
		else if (Array.isArray(raw)) out[key] = `[array:${raw.length}]`;
		else if (typeof raw === "object") out[key] = `{${Object.keys(raw as Record<string, unknown>).slice(0, 12).join(",")}}`;
	}
	return JSON.stringify(out).slice(0, 1200);
}

function findGemini35Model(value: any): string | undefined {
	if (!value) return undefined;
	if (typeof value === "string") return /gemini[- ]3\.5[- ]flash|Gemini 3\.5 Flash/i.test(value) ? value : undefined;
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findGemini35Model(item);
			if (found) return found;
		}
		return undefined;
	}
	if (typeof value === "object") {
		const label = value.label ?? value.displayName ?? value.name ?? value.modelId ?? value.id ?? value.model;
		if (typeof label === "string" && /gemini[- ]3\.5[- ]flash|Gemini 3\.5 Flash/i.test(label)) {
			lastMatchedModelDebug = summarizeModelCandidate(value);
			const candidate = String(value.modelId ?? value.id ?? value.model ?? label);
			return candidate;
		}
		for (const nested of Object.values(value)) {
			if (nested && typeof nested === "object") {
				const found = findGemini35Model(nested);
				if (found) return found;
			}
		}
	}
	return undefined;
}

async function fetchAvailableRuntimeModel(token: string, projectId: string): Promise<string | undefined> {
	const bodies = [{}, { cloudaicompanionProject: projectId }, { project: projectId }];
	for (const endpoint of endpointCandidates()) {
		for (const candidateBody of bodies) {
			try {
				const res = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
					method: "POST",
					headers: antigravityHeaders(token),
					body: JSON.stringify(candidateBody),
				});
				lastStatus = res.status;
				lastEndpoint = endpoint;
				if (!res.ok) continue;
				const data = await res.json();
				const labels = [...new Set(collectModelLabels(data))].slice(0, 12);
				lastAvailableModels = labels.join(",");
				return findGemini35Model(data);
			} catch (error) {
				lastError = safeError(error);
			}
		}
	}
	return undefined;
}

async function loadCodeAssist(token: string): Promise<string | undefined> {
	const body = JSON.stringify({
		metadata: { ideType: "ANTIGRAVITY" },
	});

	for (const endpoint of endpointCandidates()) {
		try {
			const res = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
				method: "POST",
				headers: antigravityHeaders(token),
				body,
			});
			lastStatus = res.status;
			lastEndpoint = endpoint;
			if (!res.ok) continue;
			const project = extractProjectId(await res.json());
			if (project) return project;
			return await listCloudAICompanionProjects(token);
		} catch (error) {
			lastError = safeError(error);
		}
	}
	return undefined;
}

type CallbackServer = {
	server: Server;
	waitForCode: () => Promise<{ code: string; state: string }>;
};

function startCallbackServer(): Promise<CallbackServer> {
	return new Promise((resolve, reject) => {
		let resolveCode!: (value: { code: string; state: string }) => void;
		let rejectCode!: (error: Error) => void;
		const codePromise = new Promise<{ code: string; state: string }>((res, rej) => {
			resolveCode = res;
			rejectCode = rej;
		});

		const server = createServer((req, res) => {
			const url = new URL(req.url || "", REDIRECT_URI);
			if (url.pathname !== "/oauth-callback") {
				res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
				res.end("Antigravity OAuth callback route not found.");
				return;
			}

			const error = url.searchParams.get("error");
			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");
			if (error) {
				res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
				res.end(`Antigravity authentication failed: ${error}`);
				rejectCode(new Error(`OAuth error: ${error}`));
				return;
			}
			if (!code || !state) {
				res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
				res.end("Antigravity authentication failed: missing code or state.");
				rejectCode(new Error("Missing code or state in OAuth callback"));
				return;
			}

			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end("Antigravity authentication complete. You can close this window and return to Pi.");
			resolveCode({ code, state });
		});

		server.on("error", reject);
		server.listen(51121, CALLBACK_HOST, () => resolve({ server, waitForCode: () => codePromise }));
	});
}

async function loginNoagy(callbacks: OAuthCallbacks): Promise<OAuthCredentials> {
	const { verifier, challenge } = generatePKCE();
	const { server, waitForCode } = await startCallbackServer();
	try {
		const authParams = new URLSearchParams({
			client_id: CLIENT_ID,
			response_type: "code",
			redirect_uri: REDIRECT_URI,
			scope: SCOPES.join(" "),
			code_challenge: challenge,
			code_challenge_method: "S256",
			state: verifier,
			access_type: "offline",
			prompt: "consent",
		});
		callbacks.onAuth({ url: `${AUTH_URL}?${authParams.toString()}`, instructions: "Complete Google sign-in. Pi will capture the local callback." });

		const { code, state } = await waitForCode();
		if (state !== verifier) throw new Error("OAuth state mismatch");

		const tokenResponse = await fetch(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				code,
				grant_type: "authorization_code",
				redirect_uri: REDIRECT_URI,
				code_verifier: verifier,
			}).toString(),
		});
		if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
		const tokenData = (await tokenResponse.json()) as { access_token: string; refresh_token?: string; expires_in: number };
		if (!tokenData.refresh_token) throw new Error("No refresh token received. Re-run /login antigravity and allow offline access.");

		const [email, discoveredProject] = await Promise.all([getUserEmail(tokenData.access_token), loadCodeAssist(tokenData.access_token)]);
		return {
			refresh: tokenData.refresh_token,
			access: tokenData.access_token,
			expires: Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000,
			projectId: discoveredProject || DEFAULT_PROJECT_ID,
			email,
		};
	} finally {
		server.close();
	}
}

async function refreshNoagyToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			refresh_token: credentials.refresh,
			grant_type: "refresh_token",
		}).toString(),
	});
	if (!response.ok) throw new Error(`Antigravity token refresh failed: ${await response.text()}`);
	const data = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
	const discoveredProject = await loadCodeAssist(data.access_token);
	return {
		...credentials,
		refresh: data.refresh_token || credentials.refresh,
		access: data.access_token,
		expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000,
		projectId: discoveredProject || credentials.projectId || DEFAULT_PROJECT_ID,
	};
}

function getApiKey(credentials: OAuthCredentials): string {
	return JSON.stringify({ token: credentials.access, projectId: credentials.projectId || DEFAULT_PROJECT_ID });
}

function runtimeModelFor(modelId: string): string {
	return MODEL_VARIANTS.find((variant) => variant.id === modelId)?.runtimeModel || DEFAULT_RUNTIME_MODEL_ID;
}

function noagyModels(): ProviderModelConfig[] {
	return MODEL_VARIANTS.map((variant) => ({
		id: variant.id,
		name: variant.name,
		reasoning: variant.reasoning,
		thinkingLevelMap: variant.reasoning ? ({ off: null, xhigh: "HIGH" } as any) : undefined,
		input: variant.input,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: variant.contextWindow,
		maxTokens: variant.maxTokens,
	}));
}

function asTextParts(content: unknown): any[] {
	if (typeof content === "string") return [{ text: sanitizeText(content) }];
	if (!Array.isArray(content)) return [];
	return content.flatMap<any>((item) => {
		if (!item || typeof item !== "object") return [];
		const block = item as any;
		if (block.type === "text") return [{ text: sanitizeText(block.text) }];
		if (block.type === "image") {
			const data = block.data || block.source?.data;
			const mimeType = block.mimeType || block.mediaType || block.source?.mediaType || "image/png";
			return data ? [{ inlineData: { mimeType, data } }] : [];
		}
		return [];
	});
}

function toolCallIdNeeded(modelId: string): boolean {
	return modelId.startsWith("claude-") || modelId.startsWith("gpt-oss-");
}

function convertMessages(model: any, context: any): any[] {
	const contents: any[] = [];
	const messages = Array.isArray(context.messages) ? context.messages : [];
	for (const msg of messages) {
		if (msg.role === "user") {
			const parts = asTextParts(msg.content);
			if (parts.length) contents.push({ role: "user", parts });
		} else if (msg.role === "assistant") {
			const parts: any[] = [];
			for (const block of msg.content || []) {
				if (block.type === "text" && String(block.text || "").trim()) parts.push({ text: sanitizeText(block.text) });
				else if (block.type === "thinking" && String(block.thinking || "").trim()) {
					if (msg.provider === PROVIDER_ID && msg.model === model.id) parts.push({ thought: true, text: sanitizeText(block.thinking), ...(block.thinkingSignature ? { thoughtSignature: block.thinkingSignature } : {}) });
					else parts.push({ text: sanitizeText(block.thinking) });
				} else if (block.type === "toolCall") {
					parts.push({
						functionCall: {
							name: block.name,
							args: block.arguments ?? {},
							...(toolCallIdNeeded(model.id) ? { id: block.id } : {}),
						},
						...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
					});
				}
			}
			if (parts.length) contents.push({ role: "model", parts });
		} else if (msg.role === "toolResult") {
			const content = Array.isArray(msg.content) ? msg.content : [];
			const text = content.filter((c: any) => c.type === "text").map((c: any) => sanitizeText(c.text)).join("\n");
			const responseText = text || (msg.isError ? "Tool failed" : "");
			const part = {
				functionResponse: {
					name: msg.toolName,
					response: msg.isError ? { error: responseText } : { output: responseText },
					...(toolCallIdNeeded(model.id) ? { id: msg.toolCallId } : {}),
				},
			};
			const last = contents[contents.length - 1];
			if (last?.role === "user" && last.parts?.some((p: any) => p.functionResponse)) last.parts.push(part);
			else contents.push({ role: "user", parts: [part] });
		}
	}
	return contents;
}

function stripMetaSchema(schema: unknown): unknown {
	if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;
	const omit = new Set(["$schema", "$id", "$anchor", "$dynamicAnchor", "$vocabulary", "$comment", "$defs", "definitions"]);
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(schema)) {
		if (!omit.has(key)) out[key] = stripMetaSchema(value);
	}
	return out;
}

function normalizeGoogleSchema(schema: unknown): unknown {
	if (!schema || typeof schema !== "object") return schema;
	if (Array.isArray(schema)) return schema.map(normalizeGoogleSchema);
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(schema)) {
		if (key === "type" && typeof value === "string") out[key] = value.toUpperCase();
		else out[key] = normalizeGoogleSchema(value);
	}
	return out;
}

function convertTools(tools: any[] | undefined, useLegacyParameters = false): any[] | undefined {
	if (!tools?.length) return undefined;
	return [
		{
			functionDeclarations: tools.map((tool) => {
				const parameters = stripMetaSchema(tool.parameters);
				return {
					name: tool.name,
					description: tool.description,
					...(useLegacyParameters
						? { parameters: normalizeGoogleSchema(parameters) }
						: { parametersJsonSchema: parameters }),
				};
			}),
		},
	];
}

function thinkingLevel(reasoning: string | undefined): string | undefined {
	switch (reasoning) {
		case "minimal":
			return "MINIMAL";
		case "low":
			return "LOW";
		case "medium":
			return "MEDIUM";
		case "high":
		case "xhigh":
			return "HIGH";
		default:
			return undefined;
	}
}

function buildRequest(model: any, context: any, projectId: string, options: any, runtimeModel: string): any {
	const request: any = {
		contents: convertMessages(model, context),
		systemInstruction: {
			role: "user",
			parts: [{ text: ANTIGRAVITY_SYSTEM_INSTRUCTION }, ...(context.systemPrompt ? [{ text: sanitizeText(context.systemPrompt) }] : [])],
		},
	};
	const generationConfig: any = {};
	if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
	if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
	else generationConfig.maxOutputTokens = Math.min(8192, model.maxTokens || 8192);
	const level = model.reasoning ? thinkingLevel(options?.reasoning) : undefined;
	if (level) generationConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: level };
	if (Object.keys(generationConfig).length) request.generationConfig = generationConfig;
	const tools = convertTools(context.tools, runtimeModel.startsWith("claude-"));
	if (tools) request.tools = tools;
	if (options?.toolChoice) request.toolConfig = { functionCallingConfig: { mode: options.toolChoice === "none" ? "NONE" : options.toolChoice === "any" ? "ANY" : "AUTO" } };
	if (options?.sessionId) request.sessionId = options.sessionId;
	return { project: projectId, model: runtimeModel, request, requestType: "agent", userAgent: "antigravity", requestId: nowRequestId() };
}

function mapStopReason(reason: string | undefined): "stop" | "length" | "toolUse" | "error" {
	if (reason === "STOP") return "stop";
	if (reason === "MAX_TOKENS") return "length";
	return reason ? "error" : "stop";
}

function createOutput(model: any): any {
	return {
		role: "assistant",
		content: [],
		api: "antigravity-api",
		provider: PROVIDER_ID,
		model: model.id,
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

async function streamResponse(response: Response, stream: AssistantMessageEventStream, output: any): Promise<boolean> {
	if (!response.body) throw new Error("No response body");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let started = false;
	let currentBlock: any = null;
	let hasContent = false;
	const blocks = output.content;
	const blockIndex = () => blocks.length - 1;
	const ensureStarted = () => {
		if (!started) {
			stream.push({ type: "start", partial: output });
			started = true;
		}
	};
	const finishCurrent = () => {
		if (!currentBlock) return;
		if (currentBlock.type === "text") stream.push({ type: "text_end", contentIndex: blockIndex(), content: currentBlock.text, partial: output });
		else if (currentBlock.type === "thinking") stream.push({ type: "thinking_end", contentIndex: blockIndex(), content: currentBlock.thinking, partial: output });
		currentBlock = null;
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";
		for (const line of lines) {
			if (!line.startsWith("data:")) continue;
			const json = line.slice(5).trim();
			if (!json || json === "[DONE]") continue;
			let chunk: any;
			try {
				chunk = JSON.parse(json);
			} catch {
				continue;
			}
			if (chunk.error) throw new Error(chunk.error.message || JSON.stringify(chunk.error));
			const responseData = chunk.response || chunk;
			const candidate = responseData.candidates?.[0];
			for (const part of candidate?.content?.parts || []) {
				if (part.text !== undefined) {
					hasContent = true;
					const isThinking = part.thought === true;
					const type = isThinking ? "thinking" : "text";
					if (!currentBlock || currentBlock.type !== type) {
						finishCurrent();
						currentBlock = isThinking ? { type: "thinking", thinking: "", thinkingSignature: undefined } : { type: "text", text: "" };
						blocks.push(currentBlock);
						ensureStarted();
						stream.push({ type: isThinking ? "thinking_start" : "text_start", contentIndex: blockIndex(), partial: output });
					}
					if (isThinking) {
						currentBlock.thinking += part.text;
						if (part.thoughtSignature) currentBlock.thinkingSignature = part.thoughtSignature;
						stream.push({ type: "thinking_delta", contentIndex: blockIndex(), delta: part.text, partial: output });
					} else {
						currentBlock.text += part.text;
						if (part.thoughtSignature) currentBlock.textSignature = part.thoughtSignature;
						stream.push({ type: "text_delta", contentIndex: blockIndex(), delta: part.text, partial: output });
					}
				}
				if (part.functionCall) {
					hasContent = true;
					finishCurrent();
					const toolCall = { type: "toolCall" as const, id: part.functionCall.id || `${part.functionCall.name || "tool"}_${Date.now()}_${blocks.length}`, name: part.functionCall.name || "", arguments: part.functionCall.args || {}, ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}) };
					blocks.push(toolCall);
					ensureStarted();
					stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
					stream.push({ type: "toolcall_delta", contentIndex: blockIndex(), delta: JSON.stringify(toolCall.arguments), partial: output });
					stream.push({ type: "toolcall_end", contentIndex: blockIndex(), toolCall, partial: output });
				}
			}
			if (candidate?.finishReason) output.stopReason = blocks.some((b: any) => b.type === "toolCall") ? "toolUse" : mapStopReason(candidate.finishReason);
			if (responseData.usageMetadata) {
				const prompt = responseData.usageMetadata.promptTokenCount || 0;
				const cacheRead = responseData.usageMetadata.cachedContentTokenCount || 0;
				output.usage.input = prompt - cacheRead;
				output.usage.output = (responseData.usageMetadata.candidatesTokenCount || 0) + (responseData.usageMetadata.thoughtsTokenCount || 0);
				output.usage.cacheRead = cacheRead;
				output.usage.totalTokens = responseData.usageMetadata.totalTokenCount || 0;
			}
		}
	}
	finishCurrent();
	return hasContent;
}

function streamNoagy(model: any, context: any, options?: any): any {
	const stream = createAssistantMessageEventStream();
	void (async () => {
		const output = createOutput(model);
		try {
			const creds = parseApiKey(options?.apiKey);
			const warmedProject = await loadCodeAssist(creds.token);
			const projectId = process.env.NOAGY_PROJECT_ID?.trim() || warmedProject || creds.projectId || DEFAULT_PROJECT_ID;
			lastProjectId = projectId;
			await fetchAvailableRuntimeModel(creds.token, projectId);
			const runtimeModel = process.env.NOAGY_RUNTIME_MODEL?.trim() || runtimeModelFor(model.id);
			lastResolvedRuntimeModel = runtimeModel;
			const body = JSON.stringify(buildRequest(model, context, projectId, options || {}, runtimeModel));
			let response: Response | undefined;
			let lastText = "";
			for (const endpoint of endpointCandidates()) {
				lastEndpoint = endpoint;
				response = await fetch(`${endpoint}/v1internal:streamGenerateContent?alt=sse`, {
					method: "POST",
					headers: antigravityHeaders(creds.token),
					body,
					signal: options?.signal,
				});
				lastStatus = response.status;
				if (response.ok) break;
				lastText = await response.text();
				if (![403, 404, 429, 500, 502, 503, 504].includes(response.status)) break;
			}
			if (!response || !response.ok) throw new Error(`Antigravity API error (${response?.status ?? "no response"}, endpoint=${lastEndpoint || "unknown"}, project=${projectId}, runtimeModel=${runtimeModel}, matched=${lastMatchedModelDebug || "none"}, available=${lastAvailableModels || "unknown"}): ${jsonOrTextError(lastText)}`);
			const received = await streamResponse(response, stream, output);
			if (!received) throw new Error("Antigravity API returned an empty response");
			stream.push({ type: "done", reason: output.stopReason, message: output });
			stream.end();
		} catch (error) {
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = safeError(error);
			lastError = output.errorMessage;
			stream.push({ type: "error", reason: output.stopReason, error: output });
			stream.end();
		}
	})();
	return stream;
}

export default function (pi: ExtensionAPI) {
	pi.registerProvider(PROVIDER_ID, {
		name: PROVIDER_NAME,
		baseUrl: DEFAULT_ENDPOINT,
		api: "antigravity-api" as any,
		models: noagyModels(),
		oauth: {
			name: PROVIDER_NAME,
			login: loginNoagy as any,
			refreshToken: refreshNoagyToken as any,
			getApiKey: getApiKey as any,
		},
		streamSimple: streamNoagy,
	} as any);

	pi.registerCommand("antigravity.doctor", {
		description: "Show sanitized Antigravity provider diagnostics",
		handler: async (_args, ctx) => {
			const lines = [
				`provider=${PROVIDER_ID}`,
				`model=${MODEL_ID}`,
				`runtimeModel=${DEFAULT_RUNTIME_MODEL_ID}`,
				`lastResolvedRuntimeModel=${lastResolvedRuntimeModel || "none"}`,
				`availableModels=${lastAvailableModels || "none"}`,
				`matchedModel=${lastMatchedModelDebug || "none"}`,
				`endpoint=${endpointCandidates()[0]}`,
				`lastEndpoint=${lastEndpoint || "none"}`,
				`lastStatus=${lastStatus ?? "none"}`,
				`lastProjectId=${lastProjectId || "none"}`,
				`lastError=${lastError || "none"}`,
				"transport=native-streamSimple",
				"runtimeCli=not-used",
			];
			const text = lines.join("\n");
			if (ctx.hasUI) ctx.ui.notify(`Antigravity doctor\n${text}`, "info");
			console.log(text);
		},
	});

	return {
		deactivate: async () => {
			try {
				pi.unregisterProvider(PROVIDER_ID);
			} catch {
				// ignore
			}
		},
	};
}
