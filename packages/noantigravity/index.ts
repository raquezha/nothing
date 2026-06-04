import { appendFileSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	type Api,
	createAssistantMessageEventStream,
	type AssistantMessageEventStream,
	type Context,
	type Model,
	type SimpleStreamOptions,
} from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createRequire } from "node:module";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function findNodeModules(startDir: string): string | undefined {
	let curr = startDir;
	while (curr !== dirname(curr)) {
		const potential = resolve(curr, "node_modules");
		const pkgPath = resolve(potential, "@mariozechner/pi-ai/dist/providers/google-gemini-cli.js");
		try {
			// check if the file actually exists
			if (readFileSync(pkgPath)) {
				return potential;
			}
		} catch {
			// ignore
		}
		curr = dirname(curr);
	}
	return undefined;
}

const localNodeModules = findNodeModules(CURRENT_DIR);
const GOOGLE_GEMINI_CLI_MODULE_URL = localNodeModules
	? pathToFileURL(resolve(localNodeModules, "@mariozechner/pi-ai/dist/providers/google-gemini-cli.js")).href
	: pathToFileURL(resolve(CURRENT_DIR, "../../../node_modules/@mariozechner/pi-ai/dist/providers/google-gemini-cli.js")).href;

const PROVIDER_ID = "antigravity-cli";
const PROVIDER_NAME = "Google Antigravity CLI";
const PROVIDER_API = "antigravity-custom";
const TRANSPORT_PROVIDER_ID = "google-antigravity";
const TRANSPORT_API = "google-gemini-cli";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_URI = "http://localhost:51121/oauth-callback";
const DEFAULT_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const DEFAULT_ENDPOINT = "https://daily-cloudcode-pa.sandbox.googleapis.com";
const DEFAULT_PROJECT_ID = "rising-fact-p41fc";
const ANTIGRAVITY_LOG_FILE = `${process.env.HOME || "/tmp"}/.pi/agent/antigravity.log`;
const PI_SECRETS_FILE = `${process.env.HOME || "/tmp"}/.pi-secrets/.env`;
const SCOPES = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"https://www.googleapis.com/auth/cclog",
	"https://www.googleapis.com/auth/experimentsandconfigs",
];
const ANTIGRAVITY_DEBUG = process.env.ANTIGRAVITY_DEBUG === "1" || process.env.ANTIGRAVITY_DEBUG === "true";

let streamSimpleGoogleGeminiCliPromise: Promise<{ streamSimpleGoogleGeminiCli: any }> | undefined;

const MODEL_ALIASES: Record<string, string> = {
	"gemini-3.5-flash": "gemini-3-flash",
	"gemini-3.1-pro-high": "gemini-3.1-pro-low",
	"gpt-oss-120b": "gpt-oss-120b-medium",
};

async function loadStreamSimpleGoogleGeminiCli() {
	if (!streamSimpleGoogleGeminiCliPromise) {
		const candidates: string[] = [];

		// 1. Try absolute path in local node_modules directly
		const directLocalPath = resolve(CURRENT_DIR, "../../../node_modules/@mariozechner/pi-ai/dist/providers/google-gemini-cli.js");
		candidates.push(directLocalPath);

		// 2. Try the repo root node_modules discovered by findNodeModules
		if (GOOGLE_GEMINI_CLI_MODULE_URL) {
			const p = GOOGLE_GEMINI_CLI_MODULE_URL.startsWith("file://") 
				? fileURLToPath(GOOGLE_GEMINI_CLI_MODULE_URL) 
				: GOOGLE_GEMINI_CLI_MODULE_URL;
			candidates.push(p);
		}

		// 3. Try manual resolution
		try {
			const resolved = require.resolve("@mariozechner/pi-ai/google-gemini-cli");
			if (resolved) candidates.push(resolved);
		} catch {
			// ignore
		}

		// 4. Last ditch: the package name
		candidates.push("@mariozechner/pi-ai/google-gemini-cli");

		const errors: string[] = [];
		let lastError: unknown;
		for (const candidate of candidates) {
			try {
				let mod: any;
				
				// If it's an absolute path to a .js file, use direct require to bypass jiti/esm hijacks
				if (candidate.startsWith("/") && candidate.endsWith(".js")) {
					mod = require(candidate);
				} else {
					const importPath = (candidate.startsWith("/") && !candidate.startsWith("file://"))
						? pathToFileURL(candidate).href
						: candidate;
					mod = await import(importPath);
				}

				streamSimpleGoogleGeminiCliPromise = Promise.resolve(mod as { streamSimpleGoogleGeminiCli: any });
				break;
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				errors.push(`Candidate: ${candidate}\nError: ${msg}`);
				lastError = error;
			}
		}

		if (!streamSimpleGoogleGeminiCliPromise) {
			const errorDetails = errors.join("\n\n");
			throw new Error(`Failed to load google-gemini-cli.\n\n${errorDetails}`);
		}
	}

	return streamSimpleGoogleGeminiCliPromise;
}

type ModelDef = {
	id: string;
	name: string;
	reasoning: boolean;
	input: Array<"text" | "image">;
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextWindow: number;
	maxTokens: number;
};

function log(message: string): void {
	if (!ANTIGRAVITY_DEBUG) return;
	try {
		appendFileSync(ANTIGRAVITY_LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
	} catch {
		// ignore
	}
}

function readSecretFromEnvFile(key: string): string | undefined {
	try {
		const contents = readFileSync(PI_SECRETS_FILE, "utf8");
		for (const rawLine of contents.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith("#")) continue;
			const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
			const equalsIndex = normalized.indexOf("=");
			if (equalsIndex === -1) continue;
			const parsedKey = normalized.slice(0, equalsIndex).trim();
			if (parsedKey !== key) continue;
			let value = normalized.slice(equalsIndex + 1).trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			return value.trim() || undefined;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function resolveSecret(key: string): string | undefined {
	return process.env[key]?.trim() || readSecretFromEnvFile(key);
}

function getClientId(): string {
	return resolveSecret("ANTIGRAVITY_CLIENT_ID") || DEFAULT_CLIENT_ID;
}

function getClientSecret(): string | undefined {
	return resolveSecret("ANTIGRAVITY_CLIENT_SECRET");
}

function resolveTransportBaseUrl(): string | undefined {
	const explicit = process.env.ANTIGRAVITY_BASE_URL?.trim();
	return explicit || undefined;
}

function describeEndpointStrategy(): string {
	return resolveTransportBaseUrl() || "built-in antigravity fallbacks (daily -> autopush -> default)";
}

function summarizeModelIds(models: ModelDef[]): string {
	return models.map((model) => model.id).join(",");
}

function generatePKCE(): { verifier: string; challenge: string } {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

function startCallbackServer(): Promise<{ server: Server; getCode: () => Promise<{ code: string; state: string }> }> {
	return new Promise((resolve, reject) => {
		let resolveCode!: (value: { code: string; state: string }) => void;
		let rejectCode!: (error: Error) => void;

		const codePromise = new Promise<{ code: string; state: string }>((res, rej) => {
			resolveCode = res;
			rejectCode = rej;
		});

		const server = createServer((req, res) => {
			const url = new URL(req.url || "", "http://localhost:51121");
			if (url.pathname !== "/oauth-callback") {
				res.writeHead(404);
				res.end();
				return;
			}

			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");
			const error = url.searchParams.get("error");

			if (error) {
				res.writeHead(400, { "Content-Type": "text/html" });
				res.end(`<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p></body></html>`);
				rejectCode(new Error(`OAuth error: ${error}`));
				return;
			}

			if (!code || !state) {
				res.writeHead(400, { "Content-Type": "text/html" });
				res.end(`<html><body><h1>Authentication Failed</h1><p>Missing code or state.</p></body></html>`);
				rejectCode(new Error("Missing code or state in OAuth callback"));
				return;
			}

			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(`<html><body><h1>Authentication Successful</h1><p>You can close this window and return to pi.</p></body></html>`);
			resolveCode({ code, state });
		});

		server.on("error", reject);
		server.listen(51121, "127.0.0.1", () => resolve({ server, getCode: () => codePromise }));
	});
}

function antigravityModels(): ModelDef[] {
	return [
		{ id: "gemini-3-flash", name: "Gemini 3 Flash (Google Antigravity)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65535 },
		{ id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro (high) (Google Antigravity)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65535 },
		{ id: "gemini-3.1-pro-low", name: "Gemini 3.1 Pro (low) (Google Antigravity)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65535 },
		{ id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Google Antigravity)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 64000 },
		{ id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 Thinking (Google Antigravity)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 64000 },
		{ id: "gpt-oss-120b-medium", name: "GPT-OSS-120b Medium (Google Antigravity)", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 131072, maxTokens: 32768 },
	];
}

function parseModelsFromDocs(html: string): ModelDef[] {
	const section = html.split(/##\s+Reasoning Model/i)[1] ?? "";
	const out = antigravityModels();
	if (!section) return out;
	const normalized = section.toLowerCase();
	const filtered = out.filter((m) => normalized.includes(m.id.toLowerCase()) || normalized.includes(m.name.toLowerCase().split(" (")[0]!.toLowerCase()));
	return filtered.length > 0 ? filtered : out;
}

async function loadAntigravityModels(): Promise<ModelDef[]> {
	try {
		const res = await fetch("https://antigravity.google/docs/models");
		if (!res.ok) return antigravityModels();
		return parseModelsFromDocs(await res.text());
	} catch {
		return antigravityModels();
	}
}

async function loginAntigravity(callbacks: any): Promise<any> {
	const { verifier, challenge } = generatePKCE();
	const { server, getCode } = await startCallbackServer();
	const clientSecret = getClientSecret();
	log(`oauth login start provider=${PROVIDER_ID} redirect=${REDIRECT_URI}`);

	try {
		const authParams = new URLSearchParams({
			client_id: getClientId(),
			response_type: "code",
			redirect_uri: REDIRECT_URI,
			scope: SCOPES.join(" "),
			code_challenge: challenge,
			code_challenge_method: "S256",
			state: verifier,
			access_type: "offline",
			prompt: "consent",
		});

		callbacks.onAuth?.({ url: `${AUTH_URL}?${authParams.toString()}`, instructions: "Complete the browser sign-in. pi will capture the callback automatically." });
		callbacks.onProgress?.("Waiting for browser OAuth callback...");

		const { code, state } = await getCode();
		if (state !== verifier) throw new Error("OAuth state mismatch");
		log(`oauth callback received provider=${PROVIDER_ID} state=ok codeLength=${code.length}`);

		const tokenResponse = await fetch(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: getClientId(),
				...(clientSecret ? { client_secret: clientSecret } : {}),
				code,
				grant_type: "authorization_code",
				redirect_uri: REDIRECT_URI,
				code_verifier: verifier,
			}),
		});

		if (!tokenResponse.ok) {
			const tokenError = await tokenResponse.text();
			if (tokenError.includes("client_secret is missing")) {
				throw new Error(`Token exchange failed: ${tokenError} (Set ANTIGRAVITY_CLIENT_SECRET in ${PI_SECRETS_FILE} or export it in your shell.)`);
			}
			throw new Error(`Token exchange failed: ${tokenError}`);
		}
		const tokenData = (await tokenResponse.json()) as { access_token: string; refresh_token: string; expires_in: number };
		if (!tokenData.refresh_token) throw new Error("No refresh token received from Google.");
		log(`oauth login success provider=${PROVIDER_ID} projectId=${DEFAULT_PROJECT_ID} expiresIn=${tokenData.expires_in}`);

		return { type: "oauth", refresh: tokenData.refresh_token, access: tokenData.access_token, expires: Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000, projectId: DEFAULT_PROJECT_ID };
	} finally {
		server.close();
	}
}

async function refreshAntigravityToken(credentials: any): Promise<any> {
	const clientSecret = getClientSecret();
	log(`oauth refresh start provider=${PROVIDER_ID} projectId=${credentials.projectId || DEFAULT_PROJECT_ID}`);
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: getClientId(),
			...(clientSecret ? { client_secret: clientSecret } : {}),
			refresh_token: credentials.refresh,
			grant_type: "refresh_token",
		}),
	});

	if (!response.ok) throw new Error(`Antigravity token refresh failed: ${await response.text()}`);
	const data = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
	log(`oauth refresh success provider=${PROVIDER_ID} expiresIn=${data.expires_in}`);
	return { type: "oauth", refresh: data.refresh_token || credentials.refresh, access: data.access_token, expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000, projectId: credentials.projectId || DEFAULT_PROJECT_ID };
}

function rewriteAssistantMetadata(payload: any): void {
	if (!payload || typeof payload !== "object") return;
	if ("provider" in payload) payload.provider = PROVIDER_ID;
	if ("api" in payload) payload.api = PROVIDER_API;
}

function rewriteStreamEvent(event: any): any {
	rewriteAssistantMetadata(event?.partial);
	rewriteAssistantMetadata(event?.message);
	rewriteAssistantMetadata(event?.error);
	return event;
}

function createErrorStreamEvent(model: Model<Api>, message: string) {
	return {
		type: "error" as const,
		reason: "error" as const,
		error: {
			role: "assistant" as const,
			content: [],
			api: PROVIDER_API,
			provider: PROVIDER_ID,
			model: model.id,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "error" as const,
			errorMessage: message,
			timestamp: Date.now(),
		},
	};
}

function streamAntigravity(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();

	(async () => {
		try {
			const transportBaseUrl = resolveTransportBaseUrl();
			const runtimeModelId = MODEL_ALIASES[model.id] || model.id;
			const innerModel = {
				...model,
				id: runtimeModelId,
				provider: TRANSPORT_PROVIDER_ID,
				api: TRANSPORT_API,
				...(transportBaseUrl ? { baseUrl: transportBaseUrl } : {}),
			} as Model<"google-gemini-cli">;

			log(`provider request provider=${PROVIDER_ID} transportProvider=${TRANSPORT_PROVIDER_ID} api=${TRANSPORT_API} model=${model.id} runtimeModel=${runtimeModelId} endpoint=${transportBaseUrl || "fallbacks"}`);

			const { streamSimpleGoogleGeminiCli } = await loadStreamSimpleGoogleGeminiCli();
			const innerStream = streamSimpleGoogleGeminiCli(innerModel, context, {
				...options,
				onPayload: async (payload, _innerModel) => {
					const requestModel = (payload as any)?.model || model.id;
					const requestType = (payload as any)?.requestType || "unknown";
					const hasTools = Boolean((payload as any)?.request?.tools?.length);
					log(`provider payload provider=${PROVIDER_ID} model=${requestModel} requestType=${requestType} hasTools=${hasTools}`);
					return (await options?.onPayload?.(payload, model)) ?? payload;
				},
				onResponse: async (response, _innerModel) => {
					log(`upstream status=${response.status} provider=${PROVIDER_ID} model=${model.id}`);
					await options?.onResponse?.(response, model);
				},
			});

			for await (const event of innerStream) {
				stream.push(rewriteStreamEvent(event));
			}
			stream.end();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			log(`provider error=${message}`);
			stream.push(createErrorStreamEvent(model, message));
			stream.end();
		}
	})();

	return stream;
}

export default async function (pi: ExtensionAPI) {
	const models = await loadAntigravityModels();
	log(`extension activate provider=${PROVIDER_ID} api=${PROVIDER_API} transportProvider=${TRANSPORT_PROVIDER_ID} endpoint=${describeEndpointStrategy()} models=${summarizeModelIds(models)}`);

	pi.registerProvider(PROVIDER_ID, {
		name: PROVIDER_NAME,
		baseUrl: DEFAULT_ENDPOINT,
		api: PROVIDER_API as any,
		models,
		oauth: {
			name: PROVIDER_NAME,
			login: loginAntigravity,
			refreshToken: refreshAntigravityToken,
			getApiKey: (credentials: any) => JSON.stringify({ token: credentials.access, projectId: credentials.projectId || DEFAULT_PROJECT_ID }),
		},
		streamSimple: streamAntigravity,
	} as any);
	log(`provider register provider=${PROVIDER_ID} api=${PROVIDER_API} transportProvider=${TRANSPORT_PROVIDER_ID} endpoint=${describeEndpointStrategy()} modelCount=${models.length}`);

	pi.registerCommand("antigravity.doctor", {
		description: "Show Antigravity provider diagnostics",
		handler: async (_args, ctx) => {
			const lines = [
				`provider=${PROVIDER_ID}`,
				`api=${PROVIDER_API}`,
				`transportProvider=${TRANSPORT_PROVIDER_ID}`,
				`transportApi=${TRANSPORT_API}`,
				`endpointStrategy=${describeEndpointStrategy()}`,
				`debug=${ANTIGRAVITY_DEBUG ? "on" : "off"}`,
				`logFile=${ANTIGRAVITY_LOG_FILE}`,
				`transport=streamSimple`,
			];
			const summary = lines.join("\n");
			log(`doctor run provider=${PROVIDER_ID} transport=streamSimple`);
			if (ctx.hasUI) {
				ctx.ui.notify(`Antigravity doctor\n${summary}`, "info");
			}
			console.log(summary);
		},
	});

	return {
		deactivate: async () => {
			log(`extension deactivate provider=${PROVIDER_ID}`);
			try {
				pi.unregisterProvider(PROVIDER_ID);
				log(`provider unregister provider=${PROVIDER_ID}`);
			} catch {
				// ignore
			}
		},
	};
}
