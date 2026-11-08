import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readClipboardImage, type Image } from "./clipboard.js";
import { fetchClipboard } from "./server.js";

type Tunnel = { socket: string; token: string };

export function tunnel(configPath = join(homedir(), ".cache", "nopaste", "tunnel.json")): Tunnel | undefined {
  if (process.env.NOPASTE_SOCKET && process.env.NOPASTE_TOKEN) return { socket: process.env.NOPASTE_SOCKET, token: process.env.NOPASTE_TOKEN };
  try {
    const value = JSON.parse(readFileSync(configPath, "utf8"));
    if (typeof value.socket !== "string" || typeof value.token !== "string" || !Number.isSafeInteger(value.pid) || !existsSync(value.socket)) throw new Error("Invalid nopaste tunnel config");
    process.kill(value.pid, 0);
    // shortcut: one active SSH clipboard client per Mac user, add per-client routing when concurrent clients matter.
    return { socket: value.socket, token: value.token };
  } catch {
    if (existsSync(configPath)) { try { unlinkSync(configPath); } catch {} }
  }
}

export default function (pi: ExtensionAPI) {
  const pending = new Map<string, Image>();

  async function paste(ctx: ExtensionContext, prompt = "") {
    try {
      const activeTunnel = tunnel();
      if (process.env.SSH_CONNECTION && !activeTunnel) {
        ctx.ui.notify("SSH clipboard unavailable: reconnect with a bare interactive ssh login", "warning");
        return;
      }
      // A configured tunnel is the only remote clipboard; never silently read the host clipboard instead.
      const image = activeTunnel
        ? await fetchClipboard(activeTunnel.socket, activeTunnel.token)
        : await readClipboardImage();
      if (!image) { ctx.ui.notify("No supported image in clipboard (PNG, JPEG, GIF, WebP, or copied image file)", "warning"); return; }
      if (prompt.trim()) {
        pi.sendUserMessage([
          { type: "text", text: prompt },
          { type: "image", data: image.data.toString("base64"), mimeType: image.mimeType },
        ], ctx.isIdle() ? undefined : { deliverAs: "followUp" });
        return;
      }
      const marker = `[nopaste:image:${randomUUID()}]`;
      pending.set(marker, image);
      ctx.ui.pasteToEditor(marker);
      ctx.ui.notify("Image attached to draft. Delete the marker to discard it.", "info");
    } catch (error) {
      ctx.ui.notify(`Image paste failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  pi.registerCommand("nopaste", { description: "Attach clipboard image to the draft; optionally send /nopaste <prompt>", handler: (args, ctx) => paste(ctx, args) });
  pi.registerCommand("paste", { description: "Attach clipboard image to the draft", handler: (args, ctx) => paste(ctx, args) });
  pi.registerShortcut("alt+v", { description: "Attach clipboard image without overriding Pi Ctrl+V", handler: (ctx) => paste(ctx) });
  pi.registerCommand("nopaste-status", { description: "Show clipboard source", handler: async (_args, ctx) => {
    const activeTunnel = tunnel();
    ctx.ui.notify(activeTunnel
      ? "SSH clipboard tunnel configured (Linux/Mac client)"
      : process.env.SSH_CONNECTION
        ? "SSH clipboard tunnel missing: reconnect with a bare interactive ssh login"
        : "Local clipboard", "info");
  } });

  pi.on("input", async (event) => {
    if (event.source !== "interactive") return { action: "continue" };
    const images = [...(event.images ?? [])];
    let text = event.text;
    for (const [marker, image] of pending) {
      if (text.includes(marker)) {
        images.push({ type: "image", data: image.data.toString("base64"), mimeType: image.mimeType });
        text = text.replace(marker, "");
      }
      pending.delete(marker);
    }
    // Never send a stale marker after an extension reload or session restart.
    const hadStaleMarker = /\[nopaste:image:[0-9a-f-]+\]/i.test(text);
    text = text.replace(/\[nopaste:image:[0-9a-f-]+\]/gi, "");
    if (images.length > (event.images?.length ?? 0)) {
      return { action: "transform", text: text.trim() || "Describe this image.", images };
    }
    if (hadStaleMarker && !text.trim()) {
      return { action: "handled" };
    }
    return text === event.text ? { action: "continue" } : { action: "transform", text: text.trim() };
  });
  pi.on("session_start", () => pending.clear());
}
