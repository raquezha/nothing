#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { readClipboardImage } from "../dist/nopaste/clipboard.js";
import { serveClipboard } from "../dist/nopaste/server.js";

const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === "ssh") {
    const separator = args.indexOf("--");
    const host = args[0];
    if (!host || host.startsWith("-") || separator < 1) throw new Error("Usage: nopaste ssh HOST [-- COMMAND [args]]");
    const remoteArgs = args.slice(separator + 1);
    const token = randomBytes(32).toString("hex");
    const service = await serveClipboard(token);
    const remoteSocket = `/tmp/nopaste-${randomUUID()}.sock`;
    const remoteCommand = `config_dir="$HOME/.cache/nopaste"; config="$config_dir/tunnel.json"; mkdir -p "$config_dir"; chmod 700 "$config_dir"; export NOPASTE_SOCKET=${quote(remoteSocket)} NOPASTE_TOKEN=${quote(token)}; umask 077; printf '{"socket":"%s","token":"%s","pid":%s}\\n' "$NOPASTE_SOCKET" "$NOPASTE_TOKEN" "$$" > "$config"; trap 'rm -f ${remoteSocket} "$config"' EXIT; ${remoteArgs.length ? remoteArgs.map(quote).join(" ") : '"$SHELL" -il'}`;
    try {
      const code = await new Promise((resolve, reject) => {
        const ssh = spawn("ssh", ["-tt", "-o", "ExitOnForwardFailure=yes", "-o", "StreamLocalBindMask=0177", "-R", `${remoteSocket}:${service.socket}`, host, `"$SHELL" -ic ${quote(remoteCommand)}`], { stdio: "inherit" });
        ssh.once("error", reject);
        ssh.once("exit", (status) => resolve(status ?? 1));
      });
      process.exitCode = code;
    } finally {
      await service.close();
    }
    return;
  }
  if (action === "save") {
    if (!args[0]) throw new Error("Usage: nopaste save FILE");
    const image = await readClipboardImage();
    if (!image) throw new Error("No supported clipboard image");
    await writeFile(args[0], image.data, { flag: "wx", mode: 0o600 });
    console.log(`Saved ${image.mimeType} to ${args[0]}`);
    return;
  }
  if (action === "status") {
    const image = await readClipboardImage();
    console.log(image ? `Local clipboard: ${image.mimeType} (${image.data.length} bytes)` : "No supported image in local clipboard");
    return;
  }
  console.log("Usage: nopaste ssh HOST [-- COMMAND [args]] | nopaste save FILE | nopaste status\nInside Pi: Alt+V or /nopaste [prompt]; native Ctrl+V remains unchanged.");
}
main().catch((error) => { console.error(`nopaste: ${error.message}`); process.exitCode = 1; });
