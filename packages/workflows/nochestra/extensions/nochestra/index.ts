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
				try {
					const result = await dispatchNochestraInput({
						input: fullInput,
						cwd: ctx?.cwd || process.cwd(),
						approveWriteDispatch: async () => true,
					});

					if (result && result.kind !== "chat") {
						const formatted = formatNochestraResult(result);
						if (ctx?.ui?.notify) {
							ctx.ui.notify(formatted, "info");
						}
						console.log(formatted);
					}
				} catch (err: any) {
					const msg = `✖ NOCHESTRA ▶ Error: ${err?.message || String(err)}`;
					if (ctx?.ui?.notify) {
						ctx.ui.notify(msg, "error");
					}
					console.error(msg);
				}
			},
		});
	}
}
