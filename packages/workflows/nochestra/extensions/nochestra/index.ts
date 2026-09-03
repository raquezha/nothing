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
				const setStatus = (msg: string) => ctx?.ui?.setStatus?.("nochestra", msg);
				const start = Date.now();
				const timer = setInterval(() => {
					const s = ((Date.now() - start) / 1000).toFixed(1);
					setStatus(`⚡ /${cmdName} ▶ 🤖 ornith ▶ ⏳ ${s}s`);
				}, 500);
				try {
					const result = await dispatchNochestraInput({
						input: fullInput,
						cwd: ctx?.cwd ?? process.cwd(),
						approveWriteDispatch: async () => true,
						promptRemediation: async () => "skip",
						showStartLog: false,
					});
					clearInterval(timer);
					setStatus("");
					if (result && result.kind !== "chat") {
						process.stdout.write(`\n${formatNochestraResult(result)}\n`);
					}
				} catch (err: any) {
					clearInterval(timer);
					setStatus("");
					const msg = err?.message || String(err);
					console.error(`❖ NOCHESTRA ▶ /${cmdName} ▶ ${msg}`);
				}
			},
		});
	}
}
