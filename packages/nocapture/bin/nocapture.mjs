#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { runBatch } from "../lib/batch.mjs";
import { renderImage } from "../lib/image.mjs";
import { findBrowser } from "../lib/platform.mjs";
import { checkSvg, previewSvg } from "../lib/svg.mjs";
import { listTemplates, scaffoldTemplate } from "../lib/templates.mjs";
import { runVideoJob } from "../lib/video.mjs";

const usage = `Usage:
  nocapture init [--template <name>] [--output <file.html>] [--list] [--force]
  nocapture image --scene <file> --width <px> --height <px> --output <file.png> [--scale <n>] [--selector <css>] [--allow-overflow]
  nocapture svg --input <file.svg> [--check] [--preview <file.png>] [--scale <n>]
  nocapture video --scene <file> --duration <seconds> --fps <fps> --width <px> --height <px> --output <file.mp4|file.gif> [--audio <file>] [--preview]
  nocapture batch --manifest <file.json>

Commands:
  init    Scaffold a standalone HTML template (comparison, mobile, terminal, tutorial).
  image   Deterministic 2x PNG capture with SHA-256 repeatability and overflow checks.
  svg     Validate SVG dimensions, external URLs, and embedded WOFF2 fonts (optional PNG preview).
  video   Render window.renderAt(seconds) scenes to MP4 or GIF (optional --audio muxing and --preview keyframes).
  batch   Execute a JSON array of image, svg, and video jobs.`;

function fail(message) {
  throw new Error(`${message}\n\n${usage}`);
}

function parseFlags(args, allowedValueFlags, allowedBoolFlags = []) {
  const values = {};
  for (const b of allowedBoolFlags) values[b] = false;
  while (args.length) {
    const flag = args.shift();
    if (!flag.startsWith("--")) fail(`Unexpected argument: ${flag}`);
    const name = flag.slice(2);
    if (allowedBoolFlags.includes(name)) {
      values[name] = true;
      continue;
    }
    if (!allowedValueFlags.includes(name) || args.length === 0) {
      fail(`Invalid argument: ${flag}`);
    }
    values[name] = args.shift();
  }
  return values;
}

async function ensureOutputDir(outputPath) {
  const dir = path.dirname(path.resolve(outputPath));
  const stat = await fs.stat(dir).catch((error) => {
    if (error.code === "ENOENT") fail(`Output directory does not exist: ${dir}`);
    throw error;
  });
  if (!stat.isDirectory()) fail(`Output directory does not exist: ${dir}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return console.log(usage);
  }
  const command = args.shift();

  if (command === "init") {
    const values = parseFlags(args, ["template", "output"], ["list", "force"]);
    if (values.list) {
      console.log("Available templates:\n");
      for (const t of listTemplates()) {
        console.log(`  ${t.name.padEnd(12)} ${t.width}x${t.height}  ${t.description}`);
      }
      return;
    }
    const template = values.template || "comparison";
    const result = await scaffoldTemplate({
      template,
      output: values.output,
      force: values.force,
    });
    console.log(`Scaffolded ${result.template} template to ${result.output} (${result.width}x${result.height})`);
    return;
  }

  if (command === "image") {
    const values = parseFlags(args, ["scene", "width", "height", "output", "scale", "selector"], ["allow-overflow"]);
    for (const key of ["scene", "width", "height", "output"]) {
      if (!values[key]) fail(`Missing --${key}.`);
    }
    await ensureOutputDir(values.output);
    const width = Number(values.width);
    const height = Number(values.height);
    const scale = values.scale ? Number(values.scale) : 2;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) fail("--width and --height must be positive integers.");
    if (!Number.isFinite(scale) || scale <= 0) fail("--scale must be a positive number.");
    const browserPath = findBrowser();
    console.log(`Using browser: ${browserPath}`);
    const result = await renderImage({
      scene: values.scene,
      output: values.output,
      width,
      height,
      scale,
      selector: values.selector ?? "#capture",
      allowOverflow: values["allow-overflow"],
      browserPath,
    });
    console.log(`Wrote ${result.output} (${result.width}x${result.height}, sha256=${result.sha256.slice(0, 12)})`);
    return;
  }

  if (command === "svg") {
    const values = parseFlags(args, ["input", "preview", "scale"], ["check"]);
    if (!values.input) fail("Missing --input.");
    const info = await checkSvg(values.input);
    console.log(`SVG ok: ${info.file} (${info.width}x${info.height}, viewBox="${info.viewBox}")`);
    if (values.preview) {
      await ensureOutputDir(values.preview);
      const scale = values.scale ? Number(values.scale) : 2;
      const browserPath = findBrowser();
      console.log(`Using browser: ${browserPath}`);
      const preview = await previewSvg({ input: info.file, output: values.preview, scale, browserPath });
      console.log(`Wrote ${preview.output} (${preview.width}x${preview.height})`);
    }
    return;
  }

  if (command === "video" || command === "render") {
    const values = parseFlags(args, ["scene", "duration", "fps", "width", "height", "output", "audio"], ["preview"]);
    for (const key of ["scene", "duration", "fps", "width", "height", "output"]) {
      if (!values[key]) fail(`Missing --${key}.`);
    }
    const browserPath = findBrowser();
    console.log(`Using browser: ${browserPath}`);
    await runVideoJob({ ...values, browserPath });
    return;
  }

  if (command === "batch") {
    const values = parseFlags(args, ["manifest"]);
    if (!values.manifest) fail("Missing --manifest.");
    const browserPath = findBrowser();
    console.log(`Using browser: ${browserPath}`);
    const results = await runBatch(values.manifest, { renderVideoJob: runVideoJob, browserPath });
    console.log(`Batch completed: ${results.length} item(s).`);
    return;
  }

  fail(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`nocapture: ${error.message}`);
  process.exit(1);
});
