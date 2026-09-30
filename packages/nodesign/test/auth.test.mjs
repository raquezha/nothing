import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveCredential, storeCredential, validateCredential, validateCredentialWithInfo } from "../dist/index.js";

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
const otherCwd = path.join(tempRoot, "other-cwd");
const oldHome = process.env.HOME;
const oldFigma = process.env.FIGMA_TOKEN;
const oldZeplin = process.env.ZEPLIN_TOKEN;
const oldCwd = process.cwd();

try {
  mkdirSync(tempCwd, { recursive: true });
  mkdirSync(tempHome, { recursive: true });
  mkdirSync(otherCwd, { recursive: true });
  process.chdir(tempCwd);
  process.env.HOME = tempHome;
  delete process.env.FIGMA_TOKEN;
  delete process.env.ZEPLIN_TOKEN;

  writeFileSync(path.join(tempCwd, ".env"), "FIGMA_TOKEN=figd_cwd # my token comment\n", "utf8");

  // Cwd is last resort when no durable home token exists yet.
  const figma = resolveCredential("figma");
  assert.equal(figma.token, "figd_cwd");
  assert.equal(figma.source, "cwd .env");

  // `export KEY=` lines (shell-sourced secrets) must resolve under KEY.
  mkdirSync(path.join(tempHome, ".pi-secrets"), { recursive: true });
  writeFileSync(
    path.join(tempHome, ".pi-secrets", ".env"),
    'export FIGMA_TOKEN="figd_export_prefixed"\n',
    "utf8"
  );
  const fromExport = resolveCredential("figma");
  assert.equal(fromExport.token, "figd_export_prefixed");
  assert.equal(fromExport.source, "~/.pi-secrets/.env");

  // Stale cwd `.env` must not shadow a durable home token.
  writeFileSync(path.join(tempCwd, ".env"), "FIGMA_TOKEN=figd_stale_cwd\n", "utf8");
  const notShadowed = resolveCredential("figma");
  assert.equal(notShadowed.token, "figd_export_prefixed");
  assert.equal(notShadowed.source, "~/.pi-secrets/.env");

  const stored = storeCredential("zeplin", "zpl_config", { preferFile: true });
  assert.equal(stored.ok, true);
  assert.ok(
    stored.source === "config file" ||
      stored.source === "~/.pi-secrets/.env" ||
      stored.source === "~/.config/nodesign/.env"
  );
  assert(stored.location || stored.source === "config file");

  const configPath = path.join(tempHome, ".config", "nodesign", "config.json");
  assert.equal(existsSync(configPath), true);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.zeplinToken, "zpl_config");

  const piSecrets = readFileSync(path.join(tempHome, ".pi-secrets", ".env"), "utf8");
  assert.match(piSecrets, /ZEPLIN_TOKEN="zpl_config"/);
  // Updating an export-prefixed line must verify under the bare KEY.
  assert.match(piSecrets, /FIGMA_TOKEN=/);
  const nodesignEnv = readFileSync(
    path.join(tempHome, ".config", "nodesign", ".env"),
    "utf8"
  );
  assert.match(nodesignEnv, /ZEPLIN_TOKEN="zpl_config"/);

  // Long JWT-like tokens must persist to durable stores (Zeplin PATs).
  const longToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"a".repeat(300)}.sig`;
  const longStored = storeCredential("zeplin", longToken, {
    preferFile: true,
    mirrorCwd: false,
  });
  assert.equal(longStored.ok, true);
  const longConfig = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(longConfig.zeplinToken, longToken);

  // Leaving the project directory must still resolve the durable token.
  process.chdir(otherCwd);
  delete process.env.ZEPLIN_TOKEN;
  const fromOtherCwd = resolveCredential("zeplin");
  assert.equal(fromOtherCwd.token, longToken);
  assert.notEqual(fromOtherCwd.source, "cwd .env");
  assert.notEqual(fromOtherCwd.source, "missing");

  // Durable homes retain the token even if a project .env is absent.
  assert.equal(existsSync(path.join(otherCwd, ".env")), false);
  assert.equal(
    JSON.parse(readFileSync(configPath, "utf8")).zeplinToken,
    longToken
  );

  // File-backed success must hold even when keychain is disabled (reboot/lock simulation).
  process.chdir(tempCwd);
  process.env.NODESIGN_DISABLE_KEYCHAIN = "1";
  const fileOnlyToken = "zpl_file_backed_only";
  const fileOnly = storeCredential("zeplin", fileOnlyToken, { mirrorCwd: false });
  assert.equal(fileOnly.ok, true);
  assert.notEqual(fileOnly.source, "OS keychain");
  assert.ok(
    fileOnly.source === "config file" ||
      fileOnly.source === "~/.pi-secrets/.env" ||
      fileOnly.source === "~/.config/nodesign/.env"
  );
  process.chdir(otherCwd);
  const afterKeychainDisabled = resolveCredential("zeplin");
  assert.equal(afterKeychainDisabled.token, fileOnlyToken);
  assert.notEqual(afterKeychainDisabled.source, "OS keychain");
  assert.notEqual(afterKeychainDisabled.source, "missing");
  delete process.env.NODESIGN_DISABLE_KEYCHAIN;

  const validFigma = await validateCredential("figma", "figd_cwd", makeMockFetch({ "/v1/me": { status: 200, json: { handle: "testuser", email: "test@example.com" } } }));
  assert.equal(validFigma, "valid");

  const validFigmaInfo = await validateCredentialWithInfo("figma", "figd_cwd", makeMockFetch({ "/v1/me": { status: 200, json: { handle: "testuser", email: "test@example.com" } } }));
  assert.equal(validFigmaInfo.status, "valid");
  assert.equal(validFigmaInfo.user, "testuser");
  assert.equal(validFigmaInfo.email, "test@example.com");

  assert.equal(await validateCredential("figma", "file-only", makeMockFetch({ "/v1/me": { status: 403 } })), "unreachable");
  assert.equal(await validateCredential("figma", "bad", makeMockFetch({ "/v1/me": { status: 401 } })), "invalid");

  const invalidZeplin = await validateCredential("zeplin", "bad", makeMockFetch({ "/v1/users/me": { status: 401 } }));
  assert.equal(invalidZeplin, "invalid");

  const invalidZeplinInfo = await validateCredentialWithInfo("zeplin", "bad", makeMockFetch({ "/v1/users/me": { status: 401 } }));
  assert.equal(invalidZeplinInfo.status, "invalid");
  assert.equal(invalidZeplinInfo.user, undefined);

  console.log("nodesign auth test ok");
} finally {
  process.chdir(oldCwd);
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  if (oldFigma === undefined) delete process.env.FIGMA_TOKEN;
  else process.env.FIGMA_TOKEN = oldFigma;
  if (oldZeplin === undefined) delete process.env.ZEPLIN_TOKEN;
  else process.env.ZEPLIN_TOKEN = oldZeplin;
  delete process.env.NODESIGN_DISABLE_KEYCHAIN;
  rmSync(tempRoot, { recursive: true, force: true });
}
