import assert from "node:assert/strict";
import { checkUpdateNotice } from "../dist/index.js";

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

try {
  const mockFetchNew = makeMockFetch({
    "/@raquezha/nodesign/latest": {
      status: 200,
      json: { version: "9.9.9" },
    },
  });

  const resNew = await checkUpdateNotice("0.1.0", mockFetchNew, { forceCheck: true });
  assert.equal(resNew.hasUpdate, true);
  assert.equal(resNew.latestVersion, "9.9.9");
  assert(resNew.notice);
  assert(resNew.notice.includes("npm install -g @raquezha/nodesign"));

  const mockFetchSame = makeMockFetch({
    "/@raquezha/nodesign/latest": {
      status: 200,
      json: { version: "0.1.0" },
    },
  });

  const resSame = await checkUpdateNotice("0.1.0", mockFetchSame, { forceCheck: true });
  assert.equal(resSame.hasUpdate, false);

  console.log("nodesign update test ok");
} catch (err) {
  console.error("nodesign update test failed:", err);
  process.exit(1);
}
