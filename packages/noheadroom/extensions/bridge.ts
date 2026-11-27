import type { ImageContent, TextContent, ToolCall } from "@earendil-works/pi-ai";
import type {
	AgentMessage,
	ApplyCompressionOptions,
	ApplyCompressionResult,
	CompressionMapping,
	CompressionPayload,
	OpenAIAssistantMessage,
	OpenAIMessage,
	OpenAIToolCall,
} from "./types.js";

type AnyMessage = AgentMessage & { role?: string; content?: unknown; timestamp?: number };

interface MessageWithContent {
	content: unknown;
}

const STANDARD_COMPRESSIBLE_ROLES = new Set(["user", "assistant", "toolResult"]);
// File reads supply exact edit anchors; directives and recovered evidence must stay raw.
const PROTECTED_TOOLS = new Set(["read", "read_file", "view", "edit", "write", "skill", "headroom_retrieve"]);
const CCR_MARKER = /Retrieve\s+(?:more|original):\s*hash=|<<ccr:/i;
// Pi ends truncated output with a one-line note such as
// "[Showing lines 580-1501 of 1501 (50.0KB limit). Full output: /tmp/pi-bash-….log]".
// With it attached, Headroom's content router treats the text as mixed and skips it,
// so the note is kept aside during compression and re-appended verbatim.
const TRAILING_NOTE = /\n\n\[[^\n]*\]\n?$/;

export function splitTrailingNote(text: string): { body: string; note: string } {
	const match = TRAILING_NOTE.exec(text);
	return match ? { body: text.slice(0, match.index), note: match[0] } : { body: text, note: "" };
}

export function buildCompressionPayload(
	messages: AgentMessage[],
	minMessageChars: number,
	cacheCold = false,
): CompressionPayload {
	const mappings: CompressionMapping[] = [];
	let candidateCount = 0;

	// Results sent before the latest assistant message were part of an earlier turn
	// and may already sit in the provider prompt cache. Unless cache is cold, freeze them.
	let answered = false;
	const answeredToolCalls = new Set<string>();
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as AnyMessage;
		if (m.role === "assistant") answered = true;
		if (answered && m.role === "toolResult") {
			const id = readStringProperty(m, "toolCallId");
			if (id) answeredToolCalls.add(id);
		}
	}

	for (let sourceIndex = 0; sourceIndex < messages.length; sourceIndex++) {
		const source = messages[sourceIndex] as AnyMessage;
		const converted = convertMessage(source);
		if (!converted) continue;

		const originalText = extractOpenAIText(converted);
		const toolCallId = readStringProperty(source, "toolCallId") ?? "";
		// Mark candidates for compression.
		// ONLY toolResults are candidates, preserving original Pi conversation fidelity.
		const textOnly = typeof source.content === "string" ||
			(Array.isArray(source.content) && source.content.every(isTextContent));
		let applyTo: "toolResult" | null = source.role === "toolResult" &&
			textOnly && originalText.length >= minMessageChars &&
			!("isError" in source && source.isError) &&
			!PROTECTED_TOOLS.has((readStringProperty(source, "toolName") ?? "").toLowerCase()) &&
			(cacheCold || !answeredToolCalls.has(toolCallId))
			? "toolResult" : null;

		// Headroom Bypass Rules (Android Hat)
		// We never want to compress `android layout` JSON dumps or critical adb dumps.
		if (source.role === "toolResult" && originalText.trim().startsWith("[") && originalText.includes('"resource-id"')) {
			applyTo = null;
		}
		
		let note = "";
		let messageForPayload = converted;
		if (applyTo) {
			const split = splitTrailingNote(originalText);
			if (split.body.length < minMessageChars) {
				applyTo = null;
			} else {
				if (split.note) {
					note = split.note;
					messageForPayload = { ...converted, content: split.body };
				}
				candidateCount++;
			}
		}
		mappings.push({ sourceIndex, message: messageForPayload, applyTo, originalText, note });
	}

	return {
		messages: mappings.map((mapping) => mapping.message),
		mappings,
		candidateCount,
	};
}

export function applyCompressionResult(
	originalMessages: AgentMessage[],
	mappings: CompressionMapping[],
	compressedMessages: OpenAIMessage[],
	options: ApplyCompressionOptions,
): ApplyCompressionResult {
	if (!Array.isArray(compressedMessages) || compressedMessages.length !== mappings.length) {
		return { ok: false, reason: "message-count-changed" };
	}

	const nextMessages = structuredClone(originalMessages) as AgentMessage[];
	let appliedMessages = 0;
	let appliedTokensBefore = 0;
	let appliedTokensAfter = 0;

	for (let index = 0; index < mappings.length; index++) {
		const mapping = mappings[index];
		const compressed = compressedMessages[index];

		// We only validate and apply changes to explicit candidates.
		// Headroom is allowed to mangle non-candidates (like assistant history) in its output,
		// but we simply ignore those changes and keep the original Pi message intact.
		if (!mapping.applyTo || mapping.originalText.length < options.minMessageChars) continue;

		const validation = validateAlignedMessage(mapping.message, compressed);
		if (!validation.ok) return validation;

		const rawNextText = extractOpenAIText(compressed);
		const nextText = rawNextText + (mapping.note ?? "");
		if (nextText === mapping.originalText) continue;
		// No retrieval executor is registered. Reject only a marker created by this response:
		// prior session history can already contain one and must not disable later safe compaction.
		if (CCR_MARKER.test(nextText) && !CCR_MARKER.test(mapping.originalText)) {
			return { ok: false, reason: "unrecoverable-ccr-marker" };
		}
		if (!nextText.trim()) return { ok: false, reason: "empty-compressed-content" };
		if (estimateTokens(nextText) >= estimateTokens(mapping.originalText)) continue;

		const target = nextMessages[mapping.sourceIndex] as AnyMessage;
		if (!hasContent(target) || !replaceTextContent(target, nextText)) {
			return { ok: false, reason: "target-content-unreplaceable" };
		}
		appliedTokensBefore += estimateTokens(mapping.originalText);
		appliedTokensAfter += estimateTokens(nextText);
		appliedMessages++;
	}

	if (appliedMessages === 0) {
		return { ok: false, reason: "no-applicable-message-changed" };
	}
	const appliedTokensSaved = Math.max(0, appliedTokensBefore - appliedTokensAfter);
	if (appliedTokensSaved === 0) {
		return { ok: false, reason: "no-estimated-token-savings" };
	}

	return {
		ok: true,
		messages: nextMessages,
		appliedMessages,
		appliedTokensBefore,
		appliedTokensAfter,
		appliedTokensSaved,
		appliedCompressionRatio: appliedTokensAfter / appliedTokensBefore,
	};
}

export function convertMessage(message: AnyMessage): OpenAIMessage | undefined {
	if (!message.role || !STANDARD_COMPRESSIBLE_ROLES.has(message.role)) return undefined;
	switch (message.role) {
		case "user":
			return convertUserMessage(message);
		case "assistant":
			return convertAssistantMessage(message);
		case "toolResult":
			return convertToolResultMessage(message);
		default:
			return undefined;
	}
}

function convertUserMessage(message: AnyMessage): OpenAIMessage | undefined {
	if (!hasContent(message)) return undefined;
	if (typeof message.content === "string") {
		return { role: "user", content: message.content };
	}
	if (!Array.isArray(message.content)) return undefined;

	const text = message.content
		.filter((part): part is TextContent => isTextContent(part))
		.map((part) => part.text)
		.join("\n");
	if (text) return { role: "user", content: text };
	const hasImages = message.content.some((part) => isImageContent(part));
	return hasImages ? { role: "user", content: "[image omitted from Headroom compression payload]" } : undefined;
}

function convertAssistantMessage(message: AnyMessage): OpenAIAssistantMessage | undefined {
	if (!hasContent(message) || !Array.isArray(message.content)) return undefined;
	const text = message.content
		.filter((part): part is TextContent => isTextContent(part))
		.map((part) => part.text)
		.join("");
	const toolCalls = message.content.filter((part): part is ToolCall => isToolCall(part));
	if (!text && toolCalls.length === 0) return undefined;

	const converted: OpenAIAssistantMessage = {
		role: "assistant",
		content: text || null,
	};
	if (toolCalls.length > 0) {
		converted.tool_calls = toolCalls.map(convertToolCall);
	}
	return converted;
}

function convertToolResultMessage(message: AnyMessage): OpenAIMessage | undefined {
	if (!hasContent(message)) return undefined;
	const toolCallId = readStringProperty(message, "toolCallId");
	if (!toolCallId) return undefined;
	return {
		role: "tool",
		content: extractTextFromContent(message.content),
		tool_call_id: toolCallId,
	};
}

function convertToolCall(toolCall: ToolCall): OpenAIToolCall {
	return {
		id: toolCall.id,
		type: "function",
		function: {
			// Preserve upstream tool protections as well as routing context.
			name: toolCall.name,
			arguments: JSON.stringify(toolCall.arguments),
		},
	};
}

function validateAlignedMessage(
	original: OpenAIMessage,
	compressed: OpenAIMessage,
): { ok: true } | { ok: false; reason: string } {
	if (!isRecord(compressed) || (original.role === "tool" && typeof compressed.content !== "string")) {
		return { ok: false, reason: "invalid-compressed-message" };
	}
	if (original.role !== compressed.role) {
		return { ok: false, reason: `role-changed:${original.role}->${compressed.role}` };
	}
	if (original.role === "tool" && compressed.role === "tool") {
		if (original.tool_call_id !== compressed.tool_call_id) return { ok: false, reason: "tool-call-id-changed" };
	}
	if (original.role === "assistant" && compressed.role === "assistant") {
		const originalIds = (original.tool_calls ?? []).map((call) => call.id).join("\n");
		const compressedIds = (compressed.tool_calls ?? []).map((call) => call.id).join("\n");
		if (originalIds !== compressedIds) return { ok: false, reason: "assistant-tool-calls-changed" };
	}
	return { ok: true };
}

export function extractOpenAIText(message: OpenAIMessage): string {
	if (message.role === "assistant") return typeof message.content === "string" ? message.content : "";
	if (message.role === "tool" || message.role === "system") return message.content;
	if (typeof message.content === "string") return message.content;
	return message.content
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

function extractTextFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is TextContent => isTextContent(part))
		.map((part) => part.text)
		.join("\n");
}

function replaceTextContent(message: MessageWithContent, text: string): boolean {
	if (typeof message.content === "string") {
		message.content = text;
		return true;
	}
	if (!Array.isArray(message.content)) return false;

	const nextContent: unknown[] = [];
	let replacedText = false;

	for (const part of message.content) {
		if (isTextContent(part)) {
			if (!replacedText) {
				nextContent.push({ type: "text", text });
				replacedText = true;
			}
			continue;
		}
		nextContent.push(part);
	}

	if (!replacedText && text.length > 0) {
		nextContent.unshift({ type: "text", text });
	}

	message.content = nextContent as typeof message.content;
	return true;
}

function hasContent(message: AnyMessage): message is AnyMessage & MessageWithContent {
	return "content" in message;
}

function isTextContent(value: unknown): value is TextContent {
	return isRecord(value) && value.type === "text" && typeof value.text === "string";
}

function isImageContent(value: unknown): value is ImageContent {
	return (
		isRecord(value) && value.type === "image" && typeof value.data === "string" && typeof value.mimeType === "string"
	);
}

function isToolCall(value: unknown): value is ToolCall {
	return (
		isRecord(value) &&
		value.type === "toolCall" &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		isRecord(value.arguments)
	);
}

function readStringProperty(value: unknown, key: string): string | undefined {
	if (!isRecord(value)) return undefined;
	const property = value[key];
	return typeof property === "string" ? property : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function estimateTokens(text: string): number {
	// ponytail: cheap local estimate; exact tokenizer would add a heavy dependency for a footer number.
	return text.length === 0 ? 0 : Math.max(1, Math.ceil(text.length / 4));
}
