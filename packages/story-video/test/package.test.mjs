import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.deepEqual(pkg.pi?.skills, ["story-video"]);
assert.equal(pkg.bin?.["story-video"], "bin/story-video.mjs");
assert.ok(fs.existsSync(path.join(root, "story-video", "SKILL.md")));

const help = execFileSync(process.execPath, [path.join(root, "bin", "story-video.mjs"), "--help"], { encoding: "utf8" });
for (const flag of ["--scene", "--duration", "--fps", "--width", "--height", "--output", "--preview"]) {
  assert.ok(help.includes(flag), `help must document ${flag}`);
}

console.log("story-video package contract ok");
