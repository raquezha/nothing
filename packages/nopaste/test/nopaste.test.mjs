import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import http from "node:http";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import extension, { tunnel } from "../dist/nopaste/index.js";
import { imageType, checkedImage, MAX_IMAGE_BYTES } from "../dist/nopaste/clipboard.js";
import { fetchClipboard, serveClipboard } from "../dist/nopaste/server.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("accepts supported image signatures, not arbitrary bytes or oversize payloads", () => {
  assert.equal(imageType(png), "image/png");
  assert.equal(imageType(Buffer.from([255, 216, 255, 1])), "image/jpeg");
  assert.equal(imageType(Buffer.from("GIF89a")), "image/gif");
  assert.equal(imageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])), "image/webp");
  assert.equal(checkedImage(Buffer.from("not an image")), undefined);
  assert.equal(checkedImage(Buffer.alloc(MAX_IMAGE_BYTES + 1, 1)), undefined);
});

test("SSH clipboard socket refuses wrong token without reading clipboard", async () => {
  const token = randomBytes(32).toString("hex");
  const service = await serveClipboard(token);
  try {
    await assert.rejects(fetchClipboard(service.socket, "wrong"), /403/);
  } finally {
    await service.close();
  }
  await assert.rejects(fetchClipboard(service.socket, token), /ENOENT/);
});

test("forwarded image is validated before attaching", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nopaste-test-"));
  const socket = join(dir, "test.sock");
  const server = http.createServer((_req, res) => res.writeHead(200, { "Content-Type": "image/png" }).end(png));
  await new Promise((resolve) => server.listen(socket, resolve));
  try {
    const result = await fetchClipboard(socket, "test");
    assert.deepEqual(result?.data, png);
    assert.equal(result?.mimeType, "image/png");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test("draft markers attach bytes only when present and stale markers are stripped", async () => {
  const commands = new Map();
  const handlers = new Map();
  const pi = {
    registerCommand: (name, options) => commands.set(name, options.handler),
    registerShortcut: () => {},
    on: (name, handler) => handlers.set(name, handler),
  };
  extension(pi);
  const originalSocket = process.env.NOPASTE_SOCKET;
  const originalToken = process.env.NOPASTE_TOKEN;
  const dir = await mkdtemp(join(tmpdir(), "nopaste-test-"));
  const socket = join(dir, "test.sock");
  const server = http.createServer((_req, res) => res.writeHead(200, { "Content-Type": "image/png" }).end(png));
  await new Promise((resolve) => server.listen(socket, resolve));
  process.env.NOPASTE_SOCKET = socket;
  process.env.NOPASTE_TOKEN = "test";
  let draft = "";
  const ctx = { ui: { pasteToEditor: (s) => { draft += s; }, notify: () => {} }, isIdle: () => true };
  try {
    await commands.get("nopaste")("", ctx);
    assert.match(draft, /\[nopaste:image:/);
    const result = await handlers.get("input")({ source: "interactive", text: draft, images: [] });
    assert.equal(result.action, "transform");
    assert.equal(result.text, "Describe this image.");
    assert.equal(result.images[0].data, png.toString("base64"));
    await commands.get("nopaste")("", ctx);
    const staleMarker = draft.match(/\[nopaste:image:[^\]]+\]/)[0];
    assert.equal((await handlers.get("input")({ source: "interactive", text: "marker deleted", images: [] })).action, "continue");
    const stale = await handlers.get("input")({ source: "interactive", text: `retry ${staleMarker}`, images: [] });
    assert.equal(stale.action, "transform");
    assert.equal(stale.text, "retry");
  } finally {
    if (originalSocket === undefined) delete process.env.NOPASTE_SOCKET; else process.env.NOPASTE_SOCKET = originalSocket;
    if (originalToken === undefined) delete process.env.NOPASTE_TOKEN; else process.env.NOPASTE_TOKEN = originalToken;
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test("persistent Herdr process can resolve the active SSH tunnel config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nopaste-test-"));
  const socket = join(dir, "clipboard.sock");
  const config = join(dir, "tunnel.json");
  const server = http.createServer((_req, res) => res.writeHead(204).end());
  await new Promise((resolve) => server.listen(socket, resolve));
  try {
    await writeFile(config, JSON.stringify({ socket, token: "token", pid: process.pid }), { mode: 0o600 });
    assert.deepEqual(tunnel(config), { socket, token: "token" });
    await rm(socket, { force: true });
    assert.equal(tunnel(config), undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test("SSH status reports a missing clipboard tunnel", async () => {
  const commands = new Map();
  const pi = { registerCommand: (name, options) => commands.set(name, options.handler), registerShortcut: () => {}, on: () => {} };
  extension(pi);
  const original = process.env.SSH_CONNECTION;
  process.env.SSH_CONNECTION = "client 22 100.0.0.1 22";
  let notice = "";
  try {
    await commands.get("nopaste-status")("", { ui: { notify: (message) => { notice = message; } } });
    assert.match(notice, /tunnel missing/);
  } finally {
    if (original === undefined) delete process.env.SSH_CONNECTION; else process.env.SSH_CONNECTION = original;
  }
});

test("SSH wrapper rejects a remote command without --", () => {
  const bin = fileURLToPath(new URL("../bin/nopaste.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [bin, "ssh", "host", "pi"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: nopaste ssh HOST \[-- COMMAND/);
});

test("bare SSH wrapper opens an interactive remote shell with tunnel variables", async () => {
  const bin = fileURLToPath(new URL("../bin/nopaste.mjs", import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), "nopaste-test-"));
  const argsFile = join(dir, "ssh-args");
  const fakeSsh = join(dir, "ssh");
  await writeFile(fakeSsh, `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(argsFile)}\n`);
  await chmod(fakeSsh, 0o755);
  try {
    const result = spawnSync(process.execPath, [bin, "ssh", "host", "--"], { encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
    assert.equal(result.status, 0, result.stderr);
    const args = await readFile(argsFile, "utf8");
    assert.match(args, /NOPASTE_SOCKET=/);
    assert.match(args, /NOPASTE_TOKEN=/);
    assert.match(args, /\"\$SHELL\" -il/);
    assert.match(args, /tunnel\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
