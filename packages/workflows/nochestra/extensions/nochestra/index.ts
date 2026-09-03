import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { dispatchNochestraInput, formatNochestraResult } from "../../application/parent-runtime.mjs";

const NOCHESTRA_COMMANDS = [
	"triage",
	"frame",
	"grill-with-docs",
	"plan",
	"implement",
	"verify",
	"sync",
	"checkpoint",
];

export default function (pi: ExtensionAPI) {
	for (const cmdName of NOCHESTRA_COMMANDS) {
		pi.registerCommand(cmdName, {
			description: `Run Nochestra /${cmdName} via worker sub-process`,
			handler: async (args, ctx) => {
				const fullInput = args ? `/${cmdName} ${args}` : `/${cmdName}`;
				const start = Date.now();
				const timer = setInterval(() => {
					const s = ((Date.now() - start) / 1000).toFixed(1);
					ctx.ui.setStatus("nochestra", `⚡ /${cmdName} ▶ 🤖 ornith ▶ ⏳ ${s}s`);
				}, 500);
				try {
					const result = await dispatchNochestraInput({
						input: fullInput,
						cwd: ctx?.cwd || process.cwd(),
						approveWriteDispatch: async () => true,
					});
					clearInterval(timer);
					ctx.ui.setStatus("nochestra", "");
					if (result && result.kind !== "chat") {
						const formatted = formatNochestraResult(result);
						console.log(formatted);
					}
				} catch (err: any) {
					clearInterval(timer);
					ctx.ui.setStatus("nochestra", "");
					console.error(`✖ NOCHESTRA ▶ Error: ${err?.message || String(err)}`);
				}
			},
		});
	}
}
