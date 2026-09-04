import assert from "node:assert/strict";
import { parseFigmaUrl, resolveFigmaLink } from "../dist/index.js";

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
  // 1. URL parser tests
  const parsedExact = parseFigmaUrl("https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat?node-id=16219-5858");
  assert.equal(parsedExact.fileKey, "tVN4mWwBlUlzWNUZGfaavK");
  assert.equal(parsedExact.nodeId, "16219:5858");

  const parsedGeneric = parseFigmaUrl("https://www.figma.com/file/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat");
  assert.equal(parsedGeneric.fileKey, "tVN4mWwBlUlzWNUZGfaavK");
  assert.equal(parsedGeneric.nodeId, undefined);

  // 2. Auth missing
  const noAuthRes = await resolveFigmaLink("https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat?node-id=16219-5858", "");
  assert.equal(noAuthRes.status, "AUTH_REQUIRED");

  // 3. Status mappings
  const mock401 = makeMockFetch({ "/v1/files/": { status: 401 } });
  const res401 = await resolveFigmaLink("https://www.figma.com/design/KEY/Title?node-id=1-2", "token", mock401);
  assert.equal(res401.status, "AUTH_REJECTED");
  assert.equal(res401.normalizedStatus, "TOKEN_INVALID");

  const mock403 = makeMockFetch({ "/v1/files/": { status: 403 } });
  const res403 = await resolveFigmaLink("https://www.figma.com/design/KEY/Title?node-id=1-2", "token", mock403);
  assert.equal(res403.status, "ACCESS_DENIED");

  const mock404 = makeMockFetch({ "/v1/files/": { status: 404 } });
  const res404 = await resolveFigmaLink("https://www.figma.com/design/KEY/Title?node-id=1-2", "token", mock404);
  assert.equal(res404.status, "DESIGN_NOT_FOUND");
  assert.equal(res404.normalizedStatus, "NODE_NOT_FOUND");

  const mock429 = makeMockFetch({ "/v1/files/": { status: 429 } });
  const res429 = await resolveFigmaLink("https://www.figma.com/design/KEY/Title?node-id=1-2", "token", mock429);
  assert.equal(res429.status, "RATE_LIMITED");

  // 4. Success case
  const mock200 = makeMockFetch({
    "/v1/files/KEY/nodes": {
      status: 200,
      json: {
        name: "File Title",
        nodes: {
          "1:2": {
            document: {
              name: "Checkout Frame",
              absoluteBoundingBox: { width: 360, height: 640 },
              fills: [{ color: { r: 0.2, g: 0.4, b: 0.8 } }],
              children: [
                {
                  name: "Header",
                  style: { fontFamily: "Inter", fontSize: 16 },
                },
              ],
            },
          },
        },
      },
    },
  });

  const res200 = await resolveFigmaLink("https://www.figma.com/design/KEY/Title?node-id=1-2", "token", mock200);
  assert.equal(res200.status, "SUCCESS");
  assert.equal(res200.normalizedStatus, "SUCCESS");
  assert.equal(res200.name, "Checkout Frame");
  assert.equal(res200.fileKey, "KEY");
  assert.equal(res200.nodeId, "1:2");
  assert.equal(res200.extract.layout.width, 360);
  assert.equal(res200.extract.typography[0].fontFamily, "Inter");


  console.log("nodesign figma test ok");
} catch (err) {
  console.error("nodesign figma test failed:", err);
  process.exit(1);
}
