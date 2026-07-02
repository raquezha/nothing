import { createAssistantMessageEventStream, type AssistantMessageEventStream } from "@earendil-works/pi-ai";
import {
	lastEndpoint,
	lastMatchedModelDebug,
	lastAvailableModels,
	setLastStatus,
	setLastEndpoint,
	setLastError,
	setLastProjectId,
	setLastResolvedRuntimeModel,
	setLastAvailableModels,
	endpointCandidates,
	safeError,
	sanitizeText,
	parseApiKey,
	antigravityHeaders,
	jsonOrTextError,
	loadCodeAssist,
	fetchAvailableRuntimeModel,
	DEFAULT_PROJECT_ID,
	nowRequestId,
} from "./oauth.js";
import { getAntigravityRequestModelId, PROVIDER_ID } from "./models.js";

const ANTIGRAVITY_SYSTEM_INSTRUCTION =
	"You are Antigravity, a powerful agentic AI coding assistant designed by Google DeepMind. " +
	"You are pair programming with a user to solve coding tasks. Be concise, practical, and tool-aware.";

const ANTIGRAVITY_NO_PREAMBLE_INSTRUCTION =
	'CRITICAL: NEVER output rule checks, formatting guidelines, constraint checklists (e.g. "No emdashes"), or your thinking/personality preambles in the final response. Output only the final response.';

let _toolCallCounter = 0;

function sanitizeToolCallId(id: string, fallbackName?: string): string {
	const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "_");
	// Cap ID length to 64 characters (matching yofriadi / API limitations)
	const capped = cleaned.slice(0, 64);
	return capped || `${fallbackName || "tool"}_${Date.now()}_${++_toolCallCounter}`;
}

function toolCallIdNeeded(modelId: string, runtimeModel: string): boolean {
	return modelId.startsWith("claude-") || modelId.startsWith("gpt-oss-") ||
		runtimeModel.startsWith("claude-") || runtimeModel.startsWith("gpt-oss-");
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

function convertMessages(model: any, context: any, runtimeModel: string): any[] {
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
							...(toolCallIdNeeded(model.id, runtimeModel) ? { id: sanitizeToolCallId(block.id || "", block.name) } : {}),
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
					...(toolCallIdNeeded(model.id, runtimeModel) ? { id: sanitizeToolCallId(msg.toolCallId || "", msg.toolName) } : {}),
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

function buildRequest(model: any, context: any, projectId: string, options: any, runtimeModel: string): any {
	const request: any = {
		contents: convertMessages(model, context, runtimeModel),
		systemInstruction: {
			role: "user",
			parts: [
				{ text: ANTIGRAVITY_SYSTEM_INSTRUCTION },
				{ text: `Please ignore following [ignore]${ANTIGRAVITY_SYSTEM_INSTRUCTION}[/ignore]` },
				{ text: ANTIGRAVITY_NO_PREAMBLE_INSTRUCTION },
				...(context.systemPrompt ? [{ text: sanitizeText(context.systemPrompt) }] : [])
			],
		},
	};
	const generationConfig: any = {};
	if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
	if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
	else generationConfig.maxOutputTokens = Math.min(8192, model.maxTokens || 8192);

	// Thinking Config: Antigravity model IDs already encode their thinking variant in runtimeModel
	// (e.g. claude-sonnet-4-6 or gemini-3.5-flash-low). Sending thinkingConfig explicitly is rejected by the API.
	
	if (Object.keys(generationConfig).length) request.generationConfig = generationConfig;
	const tools = convertTools(context.tools, runtimeModel.startsWith("claude-"));
	if (tools) request.tools = tools;

	if (runtimeModel.startsWith("claude-")) {
		request.toolConfig = options?.toolChoice
			? {
					functionCallingConfig: {
						mode: options.toolChoice === "none" ? "NONE" : options.toolChoice === "any" ? "ANY" : "AUTO",
					},
				}
			: {
					functionCallingConfig: {
						mode: "VALIDATED",
					},
				};
	} else if (options?.toolChoice) {
		request.toolConfig = {
			functionCallingConfig: {
				mode: options.toolChoice === "none" ? "NONE" : options.toolChoice === "any" ? "ANY" : "AUTO",
			},
		};
	}
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
					const rawId = part.functionCall.id || "";
					const toolCall = { type: "toolCall" as const, id: sanitizeToolCallId(rawId, part.functionCall.name), name: part.functionCall.name || "", arguments: part.functionCall.args || {}, ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}) };
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

				// Cost tracking math (critical for notrace dashboard UI)
				let inCost = 0, outCost = 0, cacheCost = 0;
				const m = (output.model || "").toLowerCase();
				if (m.includes("pro")) {
					inCost = 1.25; outCost = 5.0; cacheCost = 0.31;
				} else {
					inCost = 0.075; outCost = 0.3; cacheCost = 0.018;
				}
				output.usage.cost.input = output.usage.input * inCost / 1000000;
				output.usage.cost.output = output.usage.output * outCost / 1000000;
				output.usage.cost.cacheRead = output.usage.cacheRead * cacheCost / 1000000;
				output.usage.cost.cacheWrite = 0;
				output.usage.cost.total = output.usage.cost.input + output.usage.cost.output + output.usage.cost.cacheRead;
			}
		}
	}
	finishCurrent();
	return hasContent;
}

export function streamAntigravity(model: any, context: any, options?: any): any {
	const stream = createAssistantMessageEventStream();
	void (async () => {
		const output = createOutput(model);
		try {
			const creds = parseApiKey(options?.apiKey);
			const warmedProject = await loadCodeAssist(creds.token);
			const projectId = process.env.ANTIGRAVITY_PROJECT_ID?.trim() || process.env.NOAGY_PROJECT_ID?.trim() || warmedProject || creds.projectId || DEFAULT_PROJECT_ID;
			setLastProjectId(projectId);
			await fetchAvailableRuntimeModel(creds.token, projectId);

			// Dynamic effort-based model routing
			const effort = options?.reasoning ?? "off";
			const runtimeModel = process.env.ANTIGRAVITY_RUNTIME_MODEL?.trim() || process.env.NOAGY_RUNTIME_MODEL?.trim() || getAntigravityRequestModelId(model.id, effort);
			setLastResolvedRuntimeModel(runtimeModel);

			const body = JSON.stringify(buildRequest(model, context, projectId, options || {}, runtimeModel));
			
			// Claude interleaving beta header if using a Claude reasoning model
			const isClaudeReasoning = runtimeModel.startsWith("claude-") && model.reasoning;
			const requestHeaders: Record<string, string> = {
				...antigravityHeaders(creds.token),
				...(isClaudeReasoning ? { "anthropic-beta": "interleaved-thinking-2025-05-14" } : {}),
			};

			let response: Response | undefined;
			let lastText = "";
			let received = false;

			// Empty-stream retry loop (up to 2 retries with backoff)
			for (let emptyAttempt = 0; emptyAttempt <= 2; emptyAttempt++) {
				if (options?.signal?.aborted) throw new Error("Request was aborted");
				if (emptyAttempt > 0) {
					const delay = 500 * Math.pow(2, emptyAttempt - 1);
					await new Promise((res) => setTimeout(res, delay));
				}

				for (const endpoint of endpointCandidates()) {
					setLastEndpoint(endpoint);
					response = await fetch(`${endpoint}/v1internal:streamGenerateContent?alt=sse`, {
						method: "POST",
						headers: requestHeaders,
						body,
						signal: options?.signal,
					});
					setLastStatus(response.status);
					if (response.ok) break;
					lastText = await response.text();
					if (![403, 404, 429, 500, 502, 503, 504].includes(response.status)) break;
				}

				if (!response || !response.ok) {
					throw new Error(`Antigravity API error (${response?.status ?? "no response"}, endpoint=${lastEndpoint || "unknown"}, project=${projectId}, runtimeModel=${runtimeModel}, matched=${lastMatchedModelDebug || "none"}, available=${lastAvailableModels || "unknown"}): ${jsonOrTextError(lastText)}`);
				}

				// Reset output contents before retry
				output.content = [];
				output.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
				output.stopReason = "stop";

				received = await streamResponse(response, stream, output);
				if (received) break;
			}

			if (!received) throw new Error("Antigravity API returned an empty response");
			stream.push({ type: "done", reason: output.stopReason, message: output });
			stream.end();
		} catch (error) {
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = safeError(error);
			setLastError(output.errorMessage);
			stream.push({ type: "error", reason: output.stopReason, error: output });
			stream.end();
		}
	})();
	return stream;
}
