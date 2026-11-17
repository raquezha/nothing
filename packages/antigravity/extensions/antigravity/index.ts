import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	PROVIDER_ID,
	PROVIDER_NAME,
	ANTIGRAVITY_MODELS,
} from "./models.js";
import {
	loginAntigravity,
	refreshAntigravityToken,
	getApiKey,
	readDiagnostics,
	DIAGNOSTICS_PATH,
	DEFAULT_ENDPOINT,
} from "./oauth.js";
import { streamAntigravity } from "./cloud-code-assist.js";

export default function (pi: ExtensionAPI) {
	pi.registerProvider(PROVIDER_ID, {
		name: PROVIDER_NAME,
		baseUrl: DEFAULT_ENDPOINT,
		api: "antigravity-api" as any,
		models: ANTIGRAVITY_MODELS,
		oauth: {
			name: PROVIDER_NAME,
			login: loginAntigravity as any,
			refreshToken: refreshAntigravityToken as any,
			getApiKey: getApiKey as any,
		},
		streamSimple: streamAntigravity,
	} as any);

	pi.registerCommand("antigravity.doctor", {
		description: "Show sanitized Antigravity provider diagnostics",
		handler: async (_args, ctx) => {
			const d = readDiagnostics();
			const lines = [
				`provider=${PROVIDER_ID}`,
				`extensionPath=${import.meta.url}`,
				`diagnosticsPath=${DIAGNOSTICS_PATH}`,
				`updatedAt=${d.updatedAt || "none"}`,
				`lastResolvedRuntimeModel=${d.lastResolvedRuntimeModel || "none"}`,
				`availableModels=${d.lastAvailableModels || "none"}`,
				`matchedModel=${d.lastMatchedModelDebug || "none"}`,
				`lastEndpoint=${d.lastEndpoint || "none"}`,
				`lastStatus=${d.lastStatus ?? "none"}`,
				`lastProjectId=${d.lastProjectId || "none"}`,
				`lastError=${d.lastError || "none"}`,
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
