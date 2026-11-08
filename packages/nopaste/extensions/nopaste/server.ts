import http from "node:http";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { checkedImage, MAX_IMAGE_BYTES, readClipboardImage, type Image } from "./clipboard.js";

export async function serveClipboard(token: string): Promise<{ socket: string; close: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "nopaste-"));
  await chmod(dir, 0o700);
  const socket = join(dir, "clipboard.sock");
  const server = http.createServer(async (req, res) => {
    const supplied = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (req.method !== "GET" || req.url !== "/image" || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const image = await readClipboardImage();
      if (!image) { res.writeHead(204).end(); return; }
      res.writeHead(200, { "Content-Type": image.mimeType, "Content-Length": image.data.length }).end(image.data);
    } catch {
      res.writeHead(500).end();
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socket, resolve);
    });
    await chmod(socket, 0o600);
  } catch (error) {
    server.close();
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { socket, close: async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  } };
}

export function fetchClipboard(socket: string, token: string): Promise<Image | undefined> {
  return new Promise((resolve, reject) => {
    const request = http.get({ socketPath: socket, path: "/image", headers: { Authorization: `Bearer ${token}` }, timeout: 12000 }, (response) => {
      if (response.statusCode === 204) { response.resume(); resolve(undefined); return; }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`Clipboard service returned ${response.statusCode}`)); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) { response.destroy(new Error("Clipboard image exceeds 20 MiB")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => {
        const image = checkedImage(Buffer.concat(chunks));
        if (!image || response.headers["content-type"] !== image.mimeType) reject(new Error("Invalid clipboard image"));
        else resolve(image);
      });
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Clipboard timed out")));
    request.on("error", reject);
  });
}
