import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFrames } from "./frames.mjs";
import { findBrowser, resolveEncoder, validateDimensions } from "./platform.mjs";
import { publishFfmpegOutput } from "./probe.mjs";
import { publishPreview } from "./publish.mjs";
import { captureTimes } from "./render.mjs";

function runProcess(command, args) {
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
    const times = [0, options.duration / 2, (options.frameCount - 1) / options.fps];
    await captureTimes(options, times, (png, index) => fs.writeFile(path.join(tempDir, `keyframe_${String(index).padStart(2, "0")}.png`), png));
    await publishPreview(tempDir, finalDir);
    console.log(`Wrote ${times.length} keyframes to ${finalDir}`);
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

async function renderLinuxPipe(options, encoder, times, temporaryOutput, isGif) {
  const args = isGif
    ? [
        "-y",
        "-f", "image2pipe",
        "-vcodec", "png",
        "-framerate", String(options.fps),
        "-i", "-",
        "-frames:v", String(options.frameCount),
        "-filter_complex", "[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5",
        "-loop", "0",
        temporaryOutput,
      ]
    : options.audio
      ? [
          "-y",
          "-f", "image2pipe",
          "-vcodec", "png",
          "-framerate", String(options.fps),
          "-i", "-",
          "-i", options.audio,
          "-map", "0:v:0",
          "-map", "1:a:0",
          "-frames:v", String(options.frameCount),
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "128k",
          "-af", `apad=whole_dur=${options.duration}`,
          "-t", String(options.duration),
          "-movflags", "+faststart",
          "-r", String(options.fps),
          temporaryOutput,
        ]
      : [
          "-y",
          "-f", "image2pipe",
          "-vcodec", "png",
          "-framerate", String(options.fps),
          "-i", "-",
          "-frames:v", String(options.frameCount),
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart",
          "-r", String(options.fps),
          temporaryOutput,
        ];

  const child = spawn(encoder.command, args, { stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.on("error", () => {});

  const done = new Promise((resolve, reject) => {
    child.on("error", () => reject(new Error(`${encoder.command} is required for encoding.`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${encoder.command} exited with status ${code}.`));
    });
  });

  try {
    await captureTimes(options, times, async (png) => {
      if (!child.stdin.write(png)) {
        await new Promise((resolve) => child.stdin.once("drain", resolve));
      }
    });
  } finally {
    child.stdin.end();
  }
  await done;
}

async function renderVideo(options, encoder) {
  const isGif = path.extname(options.output).toLowerCase() === ".gif";
  const runDir = await fs.mkdtemp(path.join(path.dirname(options.output), `.${path.basename(options.output)}.run-`));
  const framesDir = path.join(runDir, "frames");
  const temporaryOutput = path.join(runDir, isGif ? "video.gif" : "video.mp4");
  try {
    const times = Array.from({ length: options.frameCount }, (_, index) => index / options.fps);
    if (encoder.kind === "ffmpeg") {
      await renderLinuxPipe(options, encoder, times, temporaryOutput, isGif);
    } else {
      await fs.mkdir(framesDir);
      await captureTimes(options, times, (png, index) => fs.writeFile(path.join(framesDir, `frame_${String(index).padStart(6, "0")}.png`), png));
      await validateFrames(framesDir, options.frameCount);
      const scriptName = isGif ? "../scripts/encode-gif.swift" : "../scripts/encode.swift";
      const args = [
        fileURLToPath(new URL(scriptName, import.meta.url)),
        framesDir,
        temporaryOutput,
        String(options.frameCount),
        String(options.width),
        String(options.height),
        String(options.fps),
        ...(!isGif && options.audio ? [options.audio] : []),
      ];
      await runProcess(encoder.command, args);
    }

    if ((await fs.stat(temporaryOutput)).size === 0) throw new Error("Encoder produced no output.");
    if (encoder.kind === "ffmpeg" && !isGif) await publishFfmpegOutput(runProcess, encoder.probe, temporaryOutput, options.output, options);
    else await fs.rename(temporaryOutput, options.output);
    console.log(`Wrote ${options.output}`);
  } finally {
    await fs.rm(runDir, { recursive: true, force: true });
  }
}

export async function runVideoJob(rawOptions) {
  const duration = Number(rawOptions.duration);
  const fps = Number(rawOptions.fps);
  const width = Number(rawOptions.width);
  const height = Number(rawOptions.height);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("--duration must be a positive number.");
  if (!Number.isInteger(fps) || fps <= 0) throw new Error("--fps must be a positive integer.");
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error("--width and --height must be positive integers.");
  const frameCount = duration * fps;
  if (!Number.isInteger(frameCount)) throw new Error("--duration multiplied by --fps must be a whole number of frames.");
  const scene = path.resolve(rawOptions.scene);
  const output = path.resolve(rawOptions.output);
  if (scene === output) throw new Error("--scene and --output must be different files.");
  const ext = path.extname(output).toLowerCase();
  if (ext !== ".mp4" && ext !== ".gif") throw new Error("--output must end in .mp4 or .gif.");

  let audio;
  if (rawOptions.audio !== undefined && rawOptions.audio !== null && rawOptions.audio !== "") {
    if (ext === ".gif") throw new Error("--audio is only supported for .mp4 output (GIF does not support audio).");
    audio = path.resolve(String(rawOptions.audio));
    const audioStat = await fs.stat(audio).catch((err) => {
      if (err.code === "ENOENT") throw new Error(`Audio file does not exist: ${audio}`);
      throw err;
    });
    if (!audioStat.isFile()) throw new Error(`Audio path is not a file: ${audio}`);
    const audioExt = path.extname(audio).toLowerCase();
    if (![".wav", ".mp3", ".m4a", ".aac", ".caf", ".aiff", ".flac", ".ogg"].includes(audioExt)) {
      throw new Error(`Unsupported --audio format (${audioExt || "none"}). Expected .wav, .mp3, .m4a, or .aac.`);
    }
  }

  const parent = await fs.stat(path.dirname(output)).catch((err) => {
    if (err.code === "ENOENT") throw new Error(`Output directory does not exist: ${path.dirname(output)}`);
    throw err;
  });
  if (!parent.isDirectory()) throw new Error(`Output directory does not exist: ${path.dirname(output)}`);

  const browserPath = rawOptions.browserPath ?? findBrowser();
  const options = { scene, duration, fps, width, height, frameCount, output, audio, preview: Boolean(rawOptions.preview), browserPath };
  if (options.preview) {
    await renderPreview(options);
  } else {
    if (ext === ".mp4") validateDimensions(process.platform, options.width, options.height);
    await renderVideo(options, resolveEncoder());
  }
}
