import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run as runCli } from "../dist/index.js";

const root = mkdtempSync(path.join(tmpdir(), "nodesign-cli-"));
mkdirSync(path.join(root, "empty"), { recursive: true });

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args) {
  return spawnSync("node", ["bin/nodesign.js", ...args], {
    cwd: packageDir,
    encoding: "utf8",
  });
}

function makeMockFetch(responses) {
  return async function mockFetch(url) {
    const matchedKey = Object.keys(responses).find((key) => String(url).includes(key));
    const res = matchedKey ? responses[matchedKey] : { status: 404, statusText: "Not Found", json: {}, text: "Not Found" };
    return {
      status: res.status || 200,
      ok: (res.status || 200) >= 200 && (res.status || 200) < 300,
      statusText: res.statusText || "OK",
      json: async () => res.json || {},
      text: async () => res.text || JSON.stringify(res.json || {}),
    };
  };
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

  const repoRoot = mkdtempSync(path.join(tmpdir(), "nodesign-repo-"));
  mkdirSync(path.join(repoRoot, ".workflow", "tasks", "github-99", "evidence"), { recursive: true });
  writeFileSync(
    path.join(repoRoot, ".workflow", "tasks", "github-99", "WORK.md"),
    "# WORK\n\nDesign link: https://zpl.io/AOGOKp6\n",
  );
  writeFileSync(
    path.join(repoRoot, ".workflow", "active.json"),
    JSON.stringify({ taskPath: ".workflow/tasks/github-99" }),
  );
  mkdirSync(path.join(repoRoot, "app"), { recursive: true });

  const oldCwd = process.cwd();
  const oldLog = console.log;
  const oldError = console.error;
  const logs = [];
  const errors = [];
  console.log = (...args) => logs.push(args.join(" "));
  console.error = (...args) => errors.push(args.join(" "));
  process.chdir(repoRoot);

  const oldZeplinToken = process.env.ZEPLIN_TOKEN;
  process.env.ZEPLIN_TOKEN = "dummy-token";

  runCli(
    ["node", "nodesign", "preflight", "--json", "--path", path.join(repoRoot, "app")],
    {
      fetchFn: makeMockFetch({
        "/screens/AOGOKp6/assets": { status: 200, json: [] },
        "/screens/AOGOKp6": {
          status: 200,
          json: {
            id: "AOGOKp6",
            name: "Reports Screen",
            width: 360,
            height: 640,
            colors: [{ r: 40, g: 120, b: 240, a: 1, hex: "#2878F0" }],
            layers: [{ name: "Header" }],
          },
        },
      }),
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  console.log = oldLog;
  console.error = oldError;
  process.chdir(oldCwd);
  if (oldZeplinToken === undefined) delete process.env.ZEPLIN_TOKEN;
  else process.env.ZEPLIN_TOKEN = oldZeplinToken;
  rmSync(repoRoot, { recursive: true, force: true });

  assert.equal(errors.length, 0);
  assert.match(logs.join("\n"), /"resolvedScreens":/);
  assert.match(logs.join("\n"), /"name": "Reports Screen"/);

  console.log("nodesign cli test ok");
} finally {
  rmSync(root, { recursive: true, force: true });
}
