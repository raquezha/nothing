import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser, resolveEncoder, validateDimensions } from "../lib/platform.mjs";
import { publishPreview } from "../lib/publish.mjs";
import { captureTimes } from "../lib/render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "story-video.mjs");
const fixture = path.join(root, "test", "fixture.html");
const encoder = path.join(root, "scripts", "encode.swift");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", ...options });
}

function renderArgs(output, extra = []) {
  return ["render", "--scene", fixture, "--duration", "0.2", "--fps", "10", "--width", "64", "--height", "64", "--output", output, ...extra];
}

assert.deepEqual(pkg.pi?.skills, ["story-video"]);
assert.equal(pkg.bin?.["story-video"], "bin/story-video.mjs");
assert.ok(fs.existsSync(path.join(root, "story-video", "SKILL.md")));
assert.equal(findBrowser({ platform: "linux", exists: (candidate) => candidate === "/usr/bin/chromium" }), "/usr/bin/chromium");
assert.equal(findBrowser({ platform: "linux", environment: { STORY_VIDEO_CHROME: "/custom/chrome" }, exists: (candidate) => candidate === "/custom/chrome" }), "/custom/chrome");
assert.throws(() => findBrowser({ platform: "linux", exists: () => false }), /Browser dependency missing/);
const ffmpegRun = (command) => command === "ffmpeg" ? { status: 0, stdout: " V.... libx264", stderr: "" } : { status: 0, stdout: "", stderr: "" };
assert.deepEqual(resolveEncoder({ platform: "linux", run: ffmpegRun }), { kind: "ffmpeg", command: "ffmpeg" });
assert.throws(() => resolveEncoder({ platform: "linux", run: () => ({ status: 0, stdout: "", stderr: "" }) }), /libx264/);
assert.throws(() => resolveEncoder({ platform: "linux", run: () => ({ error: { code: "ENOENT" } }) }), /ffmpeg/);
assert.throws(() => validateDimensions("linux", 63, 64), /even/);

const help = run(["--help"]);
assert.equal(help.status, 0, help.stderr);
for (const flag of ["--scene", "--duration", "--fps", "--width", "--height", "--output", "--preview"]) {
  assert.ok(help.stdout.includes(flag), `help must document ${flag}`);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "story-video-test-"));
try {
  const options = { scene: fixture, width: 64, height: 64 };
  const direct = await captureTimes(options, [0, 0.1]);
  const sequential = await captureTimes(options, [0, 0.1]);
  const outOfOrder = await captureTimes(options, [0.1, 0]);
  assert.deepEqual(direct.get(0), sequential.get(0));
  assert.deepEqual(direct.get(0.1), sequential.get(0.1));
  assert.deepEqual(direct.get(0), outOfOrder.get(0));
  assert.deepEqual(direct.get(0.1), outOfOrder.get(0.1));

  const output = path.join(temp, "video.mp4");
  const rendered = run(renderArgs(output));
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.ok(fs.statSync(output).size > 0, "full render writes an MP4");

  const previewOutput = path.join(temp, "preview.mp4");
  const preview = run(renderArgs(previewOutput, ["--preview"]));
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(fs.readdirSync(`${previewOutput}.preview`).length, 3, "preview writes three keyframes");

  const oldPreview = path.join(temp, "old.preview");
  const stagedPreview = path.join(temp, "staged.preview");
  fs.mkdirSync(oldPreview);
  fs.mkdirSync(stagedPreview);
  fs.writeFileSync(path.join(oldPreview, "state"), "old");
  await assert.rejects(
    publishPreview(stagedPreview, oldPreview, {
      ...fsPromises,
      rename: async (from, to) => {
        if (from === stagedPreview) throw new Error("simulated rename failure");
        return fsPromises.rename(from, to);
      },
    })
  );
  assert.equal(fs.readFileSync(path.join(oldPreview, "state"), "utf8"), "old", "failed preview publish restores the prior preview");

  const invalid = run(renderArgs(path.join(temp, "bad.mp4")).map((arg) => arg === "64" ? "0" : arg));
  assert.notEqual(invalid.status, 0, "invalid dimensions fail");
  assert.notEqual(run([...renderArgs(path.join(temp, "unknown.mp4")), "--unknown", "value"]).status, 0, "unknown arguments fail");
  const fixtureBefore = fs.readFileSync(fixture, "utf8");
  assert.notEqual(run(renderArgs(fixture)).status, 0, "scene cannot be overwritten");
  assert.equal(fs.readFileSync(fixture, "utf8"), fixtureBefore, "scene overwrite is prevented");

  const missingScene = path.join(temp, "missing-asset.html");
  fs.writeFileSync(missingScene, '<img src="missing.png"><script>window.renderAt=()=>{}</script>');
  const missingAsset = run(["render", "--scene", missingScene, "--duration", "0.2", "--fps", "10", "--width", "64", "--height", "64", "--output", path.join(temp, "missing.mp4"), "--preview"]);
  assert.notEqual(missingAsset.status, 0, "missing local assets fail");
  const missingCssScene = path.join(temp, "missing-css-asset.html");
  fs.writeFileSync(missingCssScene, '<div style="width:64px;height:64px;background-image:url(missing.png)"></div><script>window.renderAt=()=>{}</script>');
  const missingCssAsset = run(["render", "--scene", missingCssScene, "--duration", "0.2", "--fps", "10", "--width", "64", "--height", "64", "--output", path.join(temp, "missing-css.mp4"), "--preview"]);
  assert.notEqual(missingCssAsset.status, 0, "missing CSS assets fail");

  const priorBrowser = path.join(temp, "prior-browser.mp4");
  fs.writeFileSync(priorBrowser, "previous");
  const missingBrowser = run(renderArgs(priorBrowser), { env: { ...process.env, STORY_VIDEO_CHROME: path.join(temp, "missing-chrome") } });
  assert.notEqual(missingBrowser.status, 0, "missing browser fails");
  assert.equal(fs.readFileSync(priorBrowser, "utf8"), "previous", "missing browser preserves export");

  const priorEncode = path.join(temp, "prior-encode.mp4");
  fs.writeFileSync(priorEncode, "previous");
  const encodeFailure = run(renderArgs(priorEncode), { env: { ...process.env, PATH: "" } });
  assert.notEqual(encodeFailure.status, 0, "missing encoder fails");
  assert.equal(fs.readFileSync(priorEncode, "utf8"), "previous", "encode failure preserves export");

  const frames = path.join(temp, "truncated");
  fs.mkdirSync(frames);
  const priorFrames = path.join(temp, "prior-frames.mp4");
  fs.writeFileSync(priorFrames, "previous");
  const truncated = spawnSync("swift", [encoder, frames, priorFrames, "2", "64", "64", "10"], { encoding: "utf8" });
  assert.notEqual(truncated.status, 0, "truncated frame input fails");
  assert.equal(fs.readFileSync(priorFrames, "utf8"), "previous", "truncated frames preserve export");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log("story-video package contract ok");
