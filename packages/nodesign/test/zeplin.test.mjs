import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseZeplinScreenId, resolveZeplinScreen, rgbToHex } from "../dist/index.js";

function makeMockFetch(responses) {
  return async function mockFetch(url, options) {
    const matchedKey = Object.keys(responses).find((key) => url.includes(key));
    if (!matchedKey) {
      return {
        status: 404,
        ok: false,
        statusText: "Not Found",
        json: async () => ({ message: "Not Found" }),
        text: async () => "Not Found",
      };
    }

    const res = responses[matchedKey];
    return {
      status: res.status || 200,
      ok: (res.status || 200) >= 200 && (res.status || 200) < 300,
      statusText: res.statusText || "OK",
      json: async () => res.json || {},
      text: async () => res.text || JSON.stringify(res.json || {}),
    };
  };
}

const tempDirs = [];

try {
  // 1. URL Parsing
  assert.equal(parseZeplinScreenId("https://zpl.io/AOGOKp6"), "AOGOKp6");
  assert.equal(parseZeplinScreenId("https://app.zeplin.io/project/123/screen/456"), "456");
  assert.equal(parseZeplinScreenId("zpl://screen/AOGOKp6"), "AOGOKp6");
  assert.equal(parseZeplinScreenId("direct-id-789"), "direct-id-789");

  // 2. RGB to HEX helper
  assert.equal(rgbToHex(255, 0, 0), "#FF0000");
  assert.equal(rgbToHex(0, 255, 0), "#00FF00");

  // 3. Missing Auth Token -> AUTH_REQUIRED (pass empty token and wipe env for test)
  const origToken = process.env.ZEPLIN_TOKEN;
  delete process.env.ZEPLIN_TOKEN;
  const authReq = await resolveZeplinScreen("AOGOKp6", "");
  assert.equal(authReq.status, "AUTH_REQUIRED");
  if (origToken) process.env.ZEPLIN_TOKEN = origToken;

  // 4. Mock HTTP Error Statuses
  const mock401 = makeMockFetch({ "/screens/AOGOKp6": { status: 401 } });
  const res401 = await resolveZeplinScreen("AOGOKp6", "dummy-token", undefined, mock401);
  assert.equal(res401.status, "AUTH_REJECTED");
  assert.equal(res401.normalizedStatus, "TOKEN_INVALID");

  const mock403 = makeMockFetch({ "/screens/AOGOKp6": { status: 403 } });
  const res403 = await resolveZeplinScreen("AOGOKp6", "dummy-token", undefined, mock403);
  assert.equal(res403.status, "ACCESS_DENIED");

  const mock404 = makeMockFetch({ "/screens/AOGOKp6": { status: 404 } });
  const res404 = await resolveZeplinScreen("AOGOKp6", "dummy-token", undefined, mock404);
  assert.equal(res404.status, "DESIGN_NOT_FOUND");

  const mock429 = makeMockFetch({ "/screens/AOGOKp6": { status: 429 } });
  const res429 = await resolveZeplinScreen("AOGOKp6", "dummy-token", undefined, mock429);
  assert.equal(res429.status, "RATE_LIMITED");

  // 5. Successful Screen Spec & Asset Export
  const outputDir = mkdtempSync(path.join(tmpdir(), "zeplin-test-assets-"));
  tempDirs.push(outputDir);

  const mock200 = makeMockFetch({
    "/screens/AOGOKp6/assets": {
      status: 200,
      json: [{ id: "ast_1", name: "ic_reports", format: "svg", url: "https://mock.cdn/ic_reports.svg" }],
    },
    "/screens/AOGOKp6": {
      status: 200,
      json: {
        id: "AOGOKp6",
        name: "Reports Screen",
        width: 360,
        height: 640,
        colors: [{ r: 40, g: 120, b: 240, a: 1, hex: "#2878F0" }],
        layers: [{ name: "Header" }, { name: "ReportList" }],
      },
    },
    "ic_reports.svg": {
      status: 200,
      text: '<svg width="24" height="24"></svg>',
    },
  });

  const res200 = await resolveZeplinScreen("AOGOKp6", "dummy-token", outputDir, mock200);
  assert.equal(res200.status, "SUCCESS");
  assert.equal(res200.normalizedStatus, "SUCCESS");
  assert.equal(res200.screen.name, "Reports Screen");
  assert.equal(res200.screen.colors[0].hex, "#2878F0");
  assert.equal(res200.assets.length, 1);
  assert.equal(res200.savedAssets.length, 1);
  assert(existsSync(res200.savedAssets[0]));
  assert.equal(readFileSync(res200.savedAssets[0], "utf8"), '<svg width="24" height="24"></svg>');

  console.log("nodesign zeplin test ok");
} finally {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
}
