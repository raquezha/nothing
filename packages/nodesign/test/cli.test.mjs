import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = mkdtempSync(path.join(tmpdir(), "nodesign-cli-"));
mkdirSync(path.join(root, "empty"), { recursive: true });

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args) {
  return spawnSync("node", ["bin/nodesign.js", ...args], {
    cwd: packageDir,
    encoding: "utf8",
  });
}

try {
  let result = run(["bogus"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown command/);

  result = run(["auth", "logout"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /auth login/);

  result = run(["preflight", "--path"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --path/);

  result = run(["preflight", "--path", path.join(root, "missing")]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Path does not exist/);

  result = run(["extract"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --url/);

  result = run(["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "0.0.1");

  result = run(["preflight", "--json", "--path", path.join(root, "empty")]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /"androidUIStack": "n\/a"/);

  console.log("nodesign cli test ok");
} finally {
  rmSync(root, { recursive: true, force: true });
}
