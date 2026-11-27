import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { HeadroomConfig, HeadroomMode } from "./types.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:8788";
const DEFAULT_MIN_CONTEXT_TOKENS = 0;
const DEFAULT_MIN_MESSAGE_CHARS = 2_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export const HEADROOM_SETTINGS_DIR = path.join(os.homedir(), ".pi", "agent", "headroom");
export const HEADROOM_SETTINGS_FILE = path.join(HEADROOM_SETTINGS_DIR, "settings.json");

export interface HeadroomSettings {
	enabled?: boolean | string;
	baseUrl?: string;
	url?: string;
	allowRemote?: boolean | string;
	autoStart?: boolean | string;
	mode?: string;
	silent?: boolean | string;
	command?: string;
	minContextTokens?: number | string;
	minMessageChars?: number | string;
	timeoutMs?: number | string;
}

export function loadHeadroomSettings(settingsPath: string = HEADROOM_SETTINGS_FILE): HeadroomSettings {
	try {
		const raw = fs.readFileSync(settingsPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as HeadroomSettings;
	} catch {
		// Missing or invalid settings.json falls back to env/defaults.
	}
	return {};
}

export function saveHeadroomSettings(
	patch: Partial<HeadroomSettings>,
	settingsPath: string = HEADROOM_SETTINGS_FILE,
): void {
	const current = loadHeadroomSettings(settingsPath);
	const updated = { ...current, ...patch };
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
	} catch (error) {
		console.warn(`[noheadroom] Failed to save settings to ${settingsPath}:`, error);
	}
}

export function loadHeadroomConfig(
	env: NodeJS.ProcessEnv = process.env,
	settings: HeadroomSettings = env === process.env ? loadHeadroomSettings() : {},
): HeadroomConfig {
	const envBaseUrl = env.PI_HEADROOM_URL || env.HEADROOM_URL || env.HEADROOM_BASE_URL;
	const baseUrl = normalizeBaseUrl(parseString(envBaseUrl, settings.baseUrl ?? settings.url ?? DEFAULT_BASE_URL));
	return {
		enabled: parseBoolean(env.PI_HEADROOM_ENABLED, parseBoolean(settings.enabled, true)),
		baseUrl,
		allowRemote: parseBoolean(env.PI_HEADROOM_ALLOW_REMOTE, parseBoolean(settings.allowRemote, false)),
		autoStart: parseBoolean(env.PI_HEADROOM_AUTO_START, parseBoolean(settings.autoStart, true)),
		mode: parseMode(
			env.PI_HEADROOM_MODE,
			settings.mode,
			parseBoolean(env.PI_HEADROOM_SILENT, parseBoolean(settings.silent, false)) ? "silent" : "normal",
		),
		command: parseString(env.PI_HEADROOM_COMMAND?.trim(), settings.command || "headroom"),
		minContextTokens: parseInteger(
			env.PI_HEADROOM_MIN_CONTEXT_TOKENS,
			parseInteger(settings.minContextTokens, DEFAULT_MIN_CONTEXT_TOKENS, 0),
			0,
		),
		minMessageChars: parseInteger(
			env.PI_HEADROOM_MIN_MESSAGE_CHARS,
			parseInteger(settings.minMessageChars, DEFAULT_MIN_MESSAGE_CHARS, 1),
			1,
		),
		timeoutMs: parseInteger(env.PI_HEADROOM_TIMEOUT_MS, parseInteger(settings.timeoutMs, DEFAULT_TIMEOUT_MS, 100), 100),
	};
}

export function isLocalHeadroomUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
			["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
	} catch {
		return false;
	}
}

export function isRemoteBlocked(config: Pick<HeadroomConfig, "baseUrl" | "allowRemote">): boolean {
	return !config.allowRemote && !isLocalHeadroomUrl(config.baseUrl);
}

function normalizeBaseUrl(raw: string): string {
	const trimmed = raw.trim() || DEFAULT_BASE_URL;
	return trimmed.replace(/\/+$/, "");
}

function parseString(raw: unknown, fallback: string): string {
	if (typeof raw !== "string") return fallback;
	return raw.trim() || fallback;
}

function parseBoolean(raw: unknown, fallback: boolean): boolean {
	if (raw === undefined) return fallback;
	if (typeof raw === "boolean") return raw;
	if (typeof raw !== "string") return fallback;
	const normalized = raw.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return fallback;
}

function parseInteger(raw: unknown, fallback: number, min: number): number {
	if (raw === undefined) return fallback;
	const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
	if (!Number.isFinite(parsed) || parsed < min) return fallback;
	return Math.trunc(parsed);
}

const HEADROOM_MODES: HeadroomMode[] = ["normal", "quiet", "silent"];

function parseMode(raw: unknown, envRaw: string | undefined, fallback: HeadroomMode): HeadroomMode {
	const normalize = (v: unknown): HeadroomMode | null => {
		if (typeof v !== "string") return null;
		const s = v.trim().toLowerCase() as HeadroomMode;
		return HEADROOM_MODES.includes(s) ? s : null;
	};
	return normalize(raw) ?? normalize(envRaw) ?? fallback;
}
