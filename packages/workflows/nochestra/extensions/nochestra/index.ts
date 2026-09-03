import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { recommendNochestraRoute } from "../../domain/delivery-command.mjs";
import { dispatchNochestraInput, formatNochestraResult } from "../../application/parent-runtime.mjs";

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		if (event.source !== "interactive") {
			return { action: "continue" };
		}

		const rawText = typeof event.text === "string" ? event.text : "";
		if (!rawText.trim()) {
			return { action: "continue" };
		}

		if (rawText.startsWith("/") && rawText.includes("\n")) {
			return { action: "transform", text: ` ${rawText}` };
		}

		const rec = recommendNochestraRoute(rawText);

		if (rec.command && (rec.route === "delivery" || rec.route === "discovery" || rec.route === "notes" || rec.route === "checkpoint")) {
			try {
				const result = await dispatchNochestraInput({
					input: rec.command,
					cwd: ctx?.cwd || process.cwd(),
					approveWriteDispatch: async () => true,
				});

				if (result && result.kind !== "chat") {
					const formatted = formatNochestraResult(result);
					console.log(formatted);
				}
			} catch (err: any) {
				console.error(`✖ NOCHESTRA ▶ Error: ${err?.message || String(err)}`);
			}
			return { action: "handled" };
		}

		if (rec.command) {
			return { action: "transform", text: rec.command };
		}

		return { action: "continue" };
	});
}
