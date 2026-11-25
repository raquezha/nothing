import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFrames } from "../lib/frames.mjs";
import { findBrowser, resolveEncoder, validateDimensions } from "../lib/platform.mjs";
import { publishFfmpegOutput } from "../lib/probe.mjs";
import { publishPreview } from "../lib/publish.mjs";
import { captureTimes } from "../lib/render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "nocapture.mjs");
const legacyArticleMediaCli = path.join(root, "bin", "article-media.mjs");
const legacyCli = path.join(root, "bin", "story-video.mjs");
const fixture = path.join(root, "test", "fixture.html");
const encoder = path.join(root, "scripts", "encode.swift");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", ...options });
}

function renderArgs(output, extra = []) {
  return ["video", "--scene", fixture, "--duration", "0.2", "--fps", "10", "--width", "64", "--height", "64", "--output", output, ...extra];
}

assert.deepEqual(pkg.pi?.skills, ["nocapture"]);
assert.equal(pkg.bin?.nocapture, "bin/nocapture.mjs");
assert.equal(pkg.bin?.["article-media"], "bin/article-media.mjs");
assert.equal(pkg.bin?.["story-video"], "bin/story-video.mjs");
assert.ok(fs.existsSync(legacyArticleMediaCli));
assert.ok(fs.existsSync(path.join(root, "nocapture", "SKILL.md")));
assert.ok(fs.existsSync(path.join(root, "nocapture", "references", "style-and-review.md")));
assert.ok(fs.existsSync(path.join(root, "examples", "non-figma-scene.html")));
assert.ok(fs.existsSync(path.join(root, "examples", "terminal-zoom-typing.html")));
assert.ok(fs.existsSync(path.join(root, "examples", "comparison-card.html")));
assert.ok(fs.existsSync(path.join(root, "examples", "mobile-figma-canvas.html")));
assert.ok(pkg.files.includes("examples"), "package must include examples");
assert.ok(pkg.files.includes("templates"), "package must include templates");
assert.ok(fs.existsSync(path.join(root, "templates", "comparison.html")));
assert.ok(fs.existsSync(path.join(root, "templates", "mobile.html")));
assert.ok(fs.existsSync(path.join(root, "templates", "terminal.html")));
assert.ok(fs.existsSync(path.join(root, "templates", "tutorial.html")));
assert.ok(fs.existsSync(path.join(root, "templates", "goodies.svg")));
assert.equal(findBrowser({ platform: "linux", exists: (candidate) => candidate === "/usr/bin/chromium" }), "/usr/bin/chromium");
assert.equal(findBrowser({ platform: "linux", environment: { ARTICLE_MEDIA_CHROME: "/custom/chrome" }, exists: (candidate) => candidate === "/custom/chrome" }), "/custom/chrome");
assert.equal(findBrowser({ platform: "linux", environment: { STORY_VIDEO_CHROME: "/legacy/chrome" }, exists: (candidate) => candidate === "/legacy/chrome" }), "/legacy/chrome");
assert.throws(() => findBrowser({ platform: "linux", exists: () => false }), /Browser dependency missing/);
const ffmpegRun = (command) => command === "ffmpeg" ? { status: 0, stdout: " V.... libx264", stderr: "" } : { status: 0, stdout: "", stderr: "" };
assert.deepEqual(resolveEncoder({ platform: "linux", run: ffmpegRun }), { kind: "ffmpeg", command: "ffmpeg", probe: "ffprobe" });
assert.throws(() => resolveEncoder({ platform: "linux", run: () => ({ status: 0, stdout: "", stderr: "" }) }), /libx264/);
assert.throws(() => resolveEncoder({ platform: "linux", run: (command) => command === "ffmpeg" ? { status: 0, stdout: "libx264", stderr: "" } : { error: { code: "ENOENT" } } }), /ffprobe/);
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

  const priorProbe = path.join(temp, "prior-probe.mp4");
  const shortProbe = path.join(temp, "short-probe.mp4");
  fs.writeFileSync(priorProbe, "previous");
  fs.writeFileSync(shortProbe, "incomplete");
  await assert.rejects(
    publishFfmpegOutput(async () => JSON.stringify({ streams: [{ width: 64, height: 64, nb_read_frames: "1" }] }), "ffprobe", shortProbe, priorProbe, { width: 64, height: 64, frameCount: 2 }),
    /expected dimensions and frame count/
  );
  assert.equal(fs.readFileSync(priorProbe, "utf8"), "previous", "rejected FFprobe frame count preserves export");
  assert.equal(fs.readFileSync(shortProbe, "utf8"), "incomplete", "rejected FFprobe output is not published");

  const partialFrames = path.join(temp, "partial-frames");
  fs.mkdirSync(partialFrames);
  fs.writeFileSync(path.join(partialFrames, "frame_000000.png"), "frame");
  await assert.rejects(validateFrames(partialFrames, 2), /Missing frame 1/);

  const output = path.join(temp, "video.mp4");
  const rendered = run(renderArgs(output));
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.ok(fs.statSync(output).size > 0, "full render writes an MP4");

  const previewOutput = path.join(temp, "preview.mp4");
  const preview = run(renderArgs(previewOutput, ["--preview"]));
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(fs.readdirSync(`${previewOutput}.preview`).length, 3, "preview writes three keyframes");

  const boundaryScene = path.join(temp, "preview-boundary.html");
  fs.writeFileSync(boundaryScene, '<body style="margin:0"><div id="frame" style="width:100vw;height:100vh"></div><script>window.renderAt=(seconds)=>document.getElementById("frame").style.background=seconds>=0.2?"#d14":"#146"</script>');
  const boundaryOutput = path.join(temp, "preview-boundary.mp4");
  const boundaryPreview = run(["render", "--scene", boundaryScene, "--duration", "0.2", "--fps", "10", "--width", "64", "--height", "64", "--output", boundaryOutput, "--preview"]);
  assert.equal(boundaryPreview.status, 0, boundaryPreview.stderr);
  const expectedLastFrame = (await captureTimes({ scene: boundaryScene, width: 64, height: 64 }, [0.1])).get(0.1);
  assert.deepEqual(fs.readFileSync(`${boundaryOutput}.preview/keyframe_02.png`), expectedLastFrame, "preview final frame is encoded in the video");

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
  const wrongExtension = run(renderArgs(path.join(temp, "wrong.webm")));
  assert.notEqual(wrongExtension.status, 0, "unsupported video extension fails");
  assert.match(wrongExtension.stderr, /--output must end in \.mp4 or \.gif/);

  const gifOut = path.join(temp, "demo.gif");
  const gifRes = run(["video", "--scene", fixture, "--duration", "0.2", "--fps", "10", "--width", "64", "--height", "64", "--output", gifOut]);
  assert.equal(gifRes.status, 0, gifRes.stderr);
  assert.match(fs.readFileSync(gifOut).subarray(0, 6).toString("ascii"), /^GIF8[79]a$/, "GIF render writes valid GIF header");
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

  // Image mode tests
  const imgScene = path.join(temp, "img.html");
  fs.writeFileSync(imgScene, '<!doctype html><html><body style="margin:0"><div id="capture" style="width:120px;height:80px;background:#bfddf0;">ok</div></body></html>');
  const imgOut = path.join(temp, "img.png");
  const imgRes = run(["image", "--scene", imgScene, "--width", "120", "--height", "80", "--output", imgOut]);
  assert.equal(imgRes.status, 0, imgRes.stderr);
  const imgBytes = fs.readFileSync(imgOut);
  assert.equal(imgBytes.readUInt32BE(16), 240, "image width is 2x");
  assert.equal(imgBytes.readUInt32BE(20), 160, "image height is 2x");

  // SVG mode tests (valid, missing embedded weight, external URL)
  const goodSvg = path.join(temp, "good.svg");
  fs.writeFileSync(goodSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect width="100" height="50" fill="#fdfdfc"/><text x="10" y="30" font-family="sans-serif">ok</text></svg>');
  const svgPreviewOut = path.join(temp, "svg-preview.png");
  const svgOk = run(["svg", "--input", goodSvg, "--check", "--preview", svgPreviewOut]);
  assert.equal(svgOk.status, 0, svgOk.stderr);
  assert.ok(fs.statSync(svgPreviewOut).size > 0, "svg --preview writes PNG");

  const badFontSvg = path.join(temp, "bad-font.svg");
  fs.writeFileSync(badFontSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><text x="10" y="30" font-family="Inter" font-weight="700">oops</text></svg>');
  const svgBadFont = run(["svg", "--input", badFontSvg, "--check"]);
  assert.notEqual(svgBadFont.status, 0, "missing embedded WOFF2 weight fails svg --check");

  const extSvg = path.join(temp, "ext.svg");
  fs.writeFileSync(extSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><image href="https://example.com/a.png"/></svg>');
  assert.notEqual(run(["svg", "--input", extSvg, "--check"]).status, 0, "external URL fails svg --check");

  // Batch mode test
  const manifestPath = path.join(temp, "media.json");
  fs.writeFileSync(manifestPath, JSON.stringify([
    { kind: "image", scene: "img.html", width: 120, height: 80, output: "batch-img.png" },
    { kind: "svg", input: "good.svg" },
  ]));
  const batchRes = run(["batch", "--manifest", manifestPath]);
  assert.equal(batchRes.status, 0, batchRes.stderr);
  assert.ok(fs.existsSync(path.join(temp, "batch-img.png")));

  // Legacy story-video alias test
  const legacyHelp = spawnSync(process.execPath, [legacyCli, "--help"], { encoding: "utf8" });
  assert.equal(legacyHelp.status, 0, legacyHelp.stderr);

  // Template & init tests
  const listRes = run(["init", "--list"]);
  assert.equal(listRes.status, 0, listRes.stderr);
  assert.ok(listRes.stdout.includes("comparison"));
  assert.ok(listRes.stdout.includes("mobile"));
  assert.ok(listRes.stdout.includes("terminal"));
  assert.ok(listRes.stdout.includes("tutorial"));

  const scaffoldOut = path.join(temp, "my-comparison.html");
  const initRes = run(["init", "--template", "comparison", "--output", scaffoldOut]);
  assert.equal(initRes.status, 0, initRes.stderr);
  assert.ok(fs.existsSync(scaffoldOut));
  const content = fs.readFileSync(scaffoldOut, "utf8");
  assert.ok(content.includes('id="capture"'));
  assert.ok(content.includes('nc-brush'));

  const noForceRes = run(["init", "--template", "comparison", "--output", scaffoldOut]);
  assert.notEqual(noForceRes.status, 0, "must fail without --force on existing file");

  const forceRes = run(["init", "--template", "comparison", "--output", scaffoldOut, "--force"]);
  assert.equal(forceRes.status, 0, forceRes.stderr);

  // Test rendering the scaffolded template with nocapture image
  const scaffoldPng = path.join(temp, "scaffold.png");
  const renderScaffold = run(["image", "--scene", scaffoldOut, "--width", "1200", "--height", "675", "--output", scaffoldPng]);
  assert.equal(renderScaffold.status, 0, renderScaffold.stderr);
  assert.ok(fs.existsSync(scaffoldPng));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log("nocapture package contract ok");
