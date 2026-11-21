#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFrames } from "../lib/frames.mjs";
import { findBrowser, resolveEncoder, validateDimensions } from "../lib/platform.mjs";
import { publishPreview } from "../lib/publish.mjs";
import { captureTimes } from "../lib/render.mjs";

const usage = `Usage:
  story-video render --scene <file> --duration <seconds> --fps <frames-per-second> \\
    --width <pixels> --height <pixels> --output <file> [--preview]

--preview writes three PNG keyframes to <output>.preview.
Scenes must define window.renderAt(seconds) and use only local assets.`;

function fail(message) {
  throw new Error(`${message}\n\n${usage}`);
}

function parse(args) {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) return { help: true };
  if (args.shift() !== "render") fail("Expected the render command.");
  const values = { preview: false };
  while (args.length) {
    const flag = args.shift();
    if (flag === "--preview") {
      values.preview = true;
      continue;
    }
    const name = flag.slice(2);
    if (!flag.startsWith("--") || !["scene", "duration", "fps", "width", "height", "output"].includes(name) || args.length === 0) {
      fail(`Invalid argument: ${flag}`);
    }
    values[name] = args.shift();
  }
  for (const key of ["scene", "duration", "fps", "width", "height", "output"]) {
    if (!values[key]) fail(`Missing --${key}.`);
  }
  const duration = Number(values.duration);
  const fps = Number(values.fps);
  const width = Number(values.width);
  const height = Number(values.height);
  if (!Number.isFinite(duration) || duration <= 0) fail("--duration must be a positive number.");
  if (!Number.isInteger(fps) || fps <= 0) fail("--fps must be a positive integer.");
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) fail("--width and --height must be positive integers.");
  const frameCount = duration * fps;
  if (!Number.isInteger(frameCount)) fail("--duration multiplied by --fps must be a whole number of frames.");
  const scene = path.resolve(values.scene);
  const output = path.resolve(values.output);
  if (scene === output) fail("--scene and --output must be different files.");
  return { scene, duration, fps, width, height, frameCount, output, preview: values.preview };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", () => reject(new Error(`${command} is required for encoding.`)));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${command} exited with status ${code}.`));
    });
  });
}

async function renderPreview(options) {
  const finalDir = `${options.output}.preview`;
  const tempDir = await fs.mkdtemp(path.join(path.dirname(options.output), `.${path.basename(options.output)}.preview-`));
  try {
    const times = [0, options.duration / 2, options.duration];
    await captureTimes(options, times, (png, index) => fs.writeFile(path.join(tempDir, `keyframe_${String(index).padStart(2, "0")}.png`), png));
    await publishPreview(tempDir, finalDir);
    console.log(`Wrote ${times.length} keyframes to ${finalDir}`);
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

async function renderVideo(options, encoder) {
  const runDir = await fs.mkdtemp(path.join(path.dirname(options.output), `.${path.basename(options.output)}.run-`));
  const framesDir = path.join(runDir, "frames");
  const temporaryOutput = path.join(runDir, "video.mp4");
  try {
    await fs.mkdir(framesDir);
    const times = Array.from({ length: options.frameCount }, (_, index) => index / options.fps);
    await captureTimes(options, times, (png, index) => fs.writeFile(path.join(framesDir, `frame_${String(index).padStart(6, "0")}.png`), png));
    await validateFrames(framesDir, options.frameCount);
    const args = encoder.kind === "swift"
      ? [fileURLToPath(new URL("../scripts/encode.swift", import.meta.url)), framesDir, temporaryOutput, String(options.frameCount), String(options.width), String(options.height), String(options.fps)]
      : ["-y", "-framerate", String(options.fps), "-start_number", "0", "-i", path.join(framesDir, "frame_%06d.png"), "-frames:v", String(options.frameCount), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(options.fps), temporaryOutput];
    await run(encoder.command, args);
    if ((await fs.stat(temporaryOutput)).size === 0) throw new Error("Encoder produced no output.");
    if (encoder.kind === "ffmpeg") {
      const probe = JSON.parse(await run(encoder.probe, ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,nb_read_frames", "-of", "json", temporaryOutput]));
      const stream = probe.streams?.[0];
      if (stream?.width !== options.width || stream?.height !== options.height || Number(stream.nb_read_frames) !== options.frameCount) {
        throw new Error("FFmpeg output did not contain the expected dimensions and frame count.");
      }
    }
    await fs.rename(temporaryOutput, options.output);
    console.log(`Wrote ${options.output}`);
  } finally {
    await fs.rm(runDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (options.help) return console.log(usage);
  try {
    const parent = await fs.stat(path.dirname(options.output));
    if (!parent.isDirectory()) fail(`Output directory does not exist: ${path.dirname(options.output)}`);
  } catch (error) {
    if (error.code === "ENOENT") fail(`Output directory does not exist: ${path.dirname(options.output)}`);
    throw error;
  }
  const browserPath = findBrowser();
  console.log(`Using browser: ${browserPath}`);
  options.browserPath = browserPath;
  if (options.preview) await renderPreview(options);
  else {
    validateDimensions(process.platform, options.width, options.height);
    await renderVideo(options, resolveEncoder());
  }
}

main().catch((error) => {
  console.error(`story-video: ${error.message}`);
  process.exit(1);
});
