import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export type Image = { data: Buffer; mimeType: string };

export function imageType(data: Buffer): string | undefined {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data.length >= 3 && data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (data.length >= 6 && /^GIF8[79]a$/.test(data.toString("ascii", 0, 6))) return "image/gif";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
}

export function checkedImage(data: Buffer): Image | undefined {
  const mimeType = imageType(data);
  return mimeType && data.length <= MAX_IMAGE_BYTES ? { data, mimeType } : undefined;
}

async function command(exe: string, args: string[], options: { env?: NodeJS.ProcessEnv; timeout?: number } = {}): Promise<Buffer | undefined> {
  try {
    const { stdout } = await run(exe, args, { encoding: "buffer", timeout: options.timeout ?? 12000, maxBuffer: MAX_IMAGE_BYTES, env: options.env });
    return stdout as Buffer;
  } catch {
    return undefined;
  }
}

const swiftImage = `import AppKit
let pb = NSPasteboard.general
if let png = pb.data(forType: .png) { FileHandle.standardOutput.write(png) }
else if let tiff = pb.data(forType: .tiff), let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) { FileHandle.standardOutput.write(png) }`;
const swiftFile = `import AppKit
let pb = NSPasteboard.general
if let url = (pb.readObjects(forClasses: [NSURL.self]) as? [URL])?.first, url.isFileURL { print(url.path) }`;

async function fileImage(file: string): Promise<Image | undefined> {
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) return;
    return checkedImage(await readFile(file));
  } catch {
    return undefined;
  }
}

function waylandEnvironment(): NodeJS.ProcessEnv | undefined {
  if (process.env.WAYLAND_DISPLAY) return process.env;
  const runtime = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? ""}`;
  if (!existsSync(runtime)) return undefined;
  const socket = readdirSync(runtime).find((name) => /^wayland-\d+$/.test(name));
  return socket ? { ...process.env, XDG_RUNTIME_DIR: runtime, WAYLAND_DISPLAY: socket } : undefined;
}

function baseMime(type: string): string { return type.split(";", 1)[0]?.trim().toLowerCase() ?? ""; }

export async function readClipboardImage(): Promise<Image | undefined> {
  if (process.platform === "darwin") {
    const image = await command("swift", ["-e", swiftImage], { timeout: 30000 });
    if (image?.length) return checkedImage(image);
    const file = await command("swift", ["-e", swiftFile], { timeout: 30000 });
    return file?.length ? fileImage(file.toString().trim()) : undefined;
  }
  if (process.platform !== "linux") return;
  const wayland = waylandEnvironment();
  const providers: { exe: string; list: string[]; read: (type: string) => string[]; env?: NodeJS.ProcessEnv }[] = [
    ...(wayland ? [{ exe: "wl-paste", list: ["--list-types"], read: (type: string) => ["--no-newline", "--type", type], env: wayland }] : []),
    { exe: "xclip", list: ["-selection", "clipboard", "-t", "TARGETS", "-o"], read: (type: string) => ["-selection", "clipboard", "-t", type, "-o"] },
  ];
  for (const provider of providers) {
    const types = (await command(provider.exe, provider.list, { env: provider.env }))?.toString().split(/\r?\n/).map(baseMime) ?? [];
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      if (!types.includes(type)) continue;
      const image = await command(provider.exe, provider.read(type), { env: provider.env });
      if (image?.length) return checkedImage(image);
    }
    if (types.includes("text/uri-list")) {
      const urls = (await command(provider.exe, provider.read("text/uri-list"), { env: provider.env }))?.toString();
      const url = urls?.split(/\r?\n/).find((line) => line.startsWith("file://"));
      if (url) {
        try {
          const image = await fileImage(fileURLToPath(url));
          if (image) return image;
        } catch { /* Invalid URL, try next provider. */ }
      }
    }
  }
}
