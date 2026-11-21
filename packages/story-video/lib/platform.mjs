import fs from "node:fs";
import { spawnSync } from "node:child_process";

const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const linuxBrowsers = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

export function findBrowser({ platform = process.platform, environment = process.env, exists = fs.existsSync } = {}) {
  const requested = environment.STORY_VIDEO_CHROME;
  const candidates = requested ? [requested] : platform === "darwin" ? [macChrome] : platform === "linux" ? linuxBrowsers : [];
  const browser = candidates.find(exists);
  if (!browser) {
    const target = requested ? `STORY_VIDEO_CHROME (${requested})` : platform === "linux" ? "a system Chrome or Chromium executable" : "Google Chrome";
    throw new Error(`Browser dependency missing: install ${target} or set STORY_VIDEO_CHROME to its executable path.`);
  }
  return browser;
}

function commandResult(command, args, run) {
  const result = run(command, args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") return null;
  return result;
}

export function resolveEncoder({ platform = process.platform, run = spawnSync } = {}) {
  if (platform === "darwin") {
    if (!commandResult("swift", ["--version"], run)) {
      throw new Error("Encoder dependency missing: install Swift/Xcode Command Line Tools.");
    }
    return { kind: "swift", command: "swift" };
  }
  if (platform === "linux") {
    const result = commandResult("ffmpeg", ["-hide_banner", "-encoders"], run);
    if (!result) throw new Error("Encoder dependency missing: install ffmpeg with the libx264 encoder.");
    if (result.status !== 0 || !`${result.stdout ?? ""}${result.stderr ?? ""}`.includes("libx264")) {
      throw new Error("Encoder dependency missing: install an ffmpeg build with the libx264 encoder.");
    }
    if (!commandResult("ffprobe", ["-version"], run)) {
      throw new Error("Encoder dependency missing: install ffprobe with ffmpeg.");
    }
    return { kind: "ffmpeg", command: "ffmpeg", probe: "ffprobe" };
  }
  throw new Error(`Unsupported platform: ${platform}. story-video supports macOS and Linux.`);
}

export function validateDimensions(platform, width, height) {
  if (platform === "linux" && (width % 2 || height % 2)) {
    throw new Error("Linux H.264/yuv420p output requires even --width and --height.");
  }
}
