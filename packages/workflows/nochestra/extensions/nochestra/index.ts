import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { recommendNochestraRoute } from "../../domain/delivery-command.mjs";

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, _ctx) => {
		if (event.source !== "interactive") {
			return { action: "continue" };
		}

		const rawText = typeof event.text === "string" ? event.text : "";
		if (!rawText.trim()) {
			return { action: "continue" };
		}

		const rec = recommendNochestraRoute(rawText);

		if (rec.command) {
			return { action: "transform", text: rec.command };
		}

		if (rawText.startsWith("/") && rawText.includes("\n")) {
			return { action: "transform", text: ` ${rawText}` };
		}

		return { action: "continue" };
	});
}
