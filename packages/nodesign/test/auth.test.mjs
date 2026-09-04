import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveCredential, storeCredential, validateCredential } from "../dist/index.js";

function makeMockFetch(responses) {
  return async function mockFetch(url) {
    const matchedKey = Object.keys(responses).find((key) => String(url).includes(key));
    const res = matchedKey ? responses[matchedKey] : { status: 404, statusText: "Not Found" };
    return {
      status: res.status || 200,
      ok: (res.status || 200) >= 200 && (res.status || 200) < 300,
      statusText: res.statusText || "OK",
      json: async () => res.json || {},
      text: async () => res.text || "",
    };
  };
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "nodesign-auth-"));
const tempCwd = path.join(tempRoot, "cwd");
const tempHome = path.join(tempRoot, "home");
const oldHome = process.env.HOME;
const oldFigma = process.env.FIGMA_TOKEN;
const oldZeplin = process.env.ZEPLIN_TOKEN;
const oldCwd = process.cwd();

try {
  mkdirSync(tempCwd, { recursive: true });
  mkdirSync(tempHome, { recursive: true });
  process.chdir(tempCwd);
  process.env.HOME = tempHome;
  delete process.env.FIGMA_TOKEN;
  delete process.env.ZEPLIN_TOKEN;

  writeFileSync(path.join(tempCwd, ".env"), "FIGMA_TOKEN=figd_cwd\n", "utf8");

  const figma = resolveCredential("figma");
  assert.equal(figma.token, "figd_cwd");
  assert.equal(figma.source, "cwd .env");

  const stored = storeCredential("zeplin", "zpl_config", { preferFile: true });
  assert.equal(stored.ok, true);
  assert.equal(stored.source, "config file");
  assert(stored.location);
  assert.equal(existsSync(stored.location), true);
  const config = JSON.parse(readFileSync(stored.location, "utf8"));
  assert.equal(config.zeplinToken, "zpl_config");

  const validFigma = await validateCredential("figma", "figd_cwd", makeMockFetch({ "/v1/me": { status: 200 } }));
  assert.equal(validFigma, "valid");

  const invalidZeplin = await validateCredential("zeplin", "bad", makeMockFetch({ "/v1/users/me": { status: 401 } }));
  assert.equal(invalidZeplin, "invalid");

  console.log("nodesign auth test ok");
} finally {
  process.chdir(oldCwd);
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  if (oldFigma === undefined) delete process.env.FIGMA_TOKEN;
  else process.env.FIGMA_TOKEN = oldFigma;
  if (oldZeplin === undefined) delete process.env.ZEPLIN_TOKEN;
  else process.env.ZEPLIN_TOKEN = oldZeplin;
  rmSync(tempRoot, { recursive: true, force: true });
}
