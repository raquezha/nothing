import assert from "node:assert/strict";
import { ANTIGRAVITY_MODELS, getAntigravityRequestModelId } from "../dist/antigravity/models.js";
import * as oauth from "../dist/antigravity/oauth.js";
import { streamAntigravity } from "../dist/antigravity/cloud-code-assist.js";

const catalog = { models: {
  "gemini-3.5-flash-extra-low": { displayName: "Gemini 3.5 Flash (Low)", model: "MODEL_PLACEHOLDER_M187" },
  "claude-opus-4-6-thinking": { displayName: "Claude Opus 4.6 (Thinking)", model: "MODEL_PLACEHOLDER_M26" },
  "claude-sonnet-4-6": { displayName: "Claude Sonnet 4.6 (Thinking)", model: "MODEL_PLACEHOLDER_M35" },
  "gemini-3.7-flash-tiered": { model: "MODEL_PLACEHOLDER_M301" },
  "gemini-3.8-flash-tiered": { model: "MODEL_PLACEHOLDER_M322" },
} };
for (const id of Object.keys(catalog.models)) assert.equal(oauth.findDynamicModel(catalog, id)?.id, id);
assert.equal(oauth.findDynamicModel(catalog, "gemini-3.5-flash-low")?.id, "gemini-3.5-flash-extra-low");
assert.equal(oauth.findDynamicModel(catalog, "missing"), undefined);
assert.equal(oauth.lastMatchedModelDebug, undefined, "no stale Gemini match on later requests");
assert.match(oauth.lastAvailableModels, /gemini-3\.8-flash-tiered/, "include unlabeled catalog keys");
for (const version of ["3.7", "3.8"]) {
  for (const effort of [undefined, "off", "low", "medium", "high", "xhigh"]) {
    assert.equal(getAntigravityRequestModelId(`gemini-${version}-flash`, effort), `gemini-${version}-flash-tiered`);
  }
}

const parameters = { type: "object", properties: {
  const: { type: "string", const: "ok" },
  choices: { type: "array", items: { anyOf: [
    { type: "string", const: "yes", $comment: "metadata" },
    { type: "string", const: "no" },
  ] } },
}, required: ["const"] };
const original = structuredClone(parameters);
const context = { messages: [{ role: "user", content: "OK" }], tools: [{ name: "check", parameters }] };
const options = { apiKey: JSON.stringify({ token: "test", projectId: "test" }) };
const originalFetch = globalThis.fetch;
let sent;
let rejectRequest = false;
globalThis.fetch = async (url, init) => {
  if (url.includes("loadCodeAssist")) return Response.json({ project: "test" });
  if (url.includes("fetchAvailableModels")) return Response.json(catalog);
  assert.ok(url.includes("streamGenerateContent"));
  sent = JSON.parse(init.body);
  if (rejectRequest) return Response.json({ error: { message: 'Invalid JSON payload. Unknown name "unsupported"' } }, { status: 400 });
  return new Response('data: {"response":{"candidates":[{"content":{"parts":[{"text":"OK"}]},"finishReason":"STOP"}]}}\n\n');
};
try {
  for (const id of ["claude-sonnet-4-6", "claude-opus-4-6"]) {
    const result = await streamAntigravity(ANTIGRAVITY_MODELS.find(m => m.id === id), context, options).result();
    assert.equal(result.stopReason, "stop");
    assert.equal(sent.model, getAntigravityRequestModelId(id));
    const schema = sent.request.tools[0].functionDeclarations[0].parameters;
    assert.deepEqual(schema.properties.const, { type: "STRING", enum: ["ok"] });
    assert.deepEqual(schema.properties.choices.items.anyOf[0], { type: "STRING", enum: ["yes"] });
    assert.match(oauth.lastMatchedModelDebug, /Claude/);
  }
  for (const id of ["gemini-3.7-flash", "gemini-3.8-flash", "gemini-3.5-flash"]) {
    await streamAntigravity(ANTIGRAVITY_MODELS.find(m => m.id === id), context, options).result();
    assert.equal(sent.model, id === "gemini-3.5-flash" ? "gemini-3.5-flash-extra-low" : `${id}-tiered`);
    assert.equal(sent.request.tools[0].functionDeclarations[0].parametersJsonSchema.properties.const.const, "ok");
  }
  rejectRequest = true;
  const result = await streamAntigravity(ANTIGRAVITY_MODELS[0], context, options).result();
  assert.equal(result.stopReason, "error");
  assert.match(result.errorMessage, /Unknown name "unsupported"/);
  assert.deepEqual(parameters, original, "conversion does not mutate caller schemas");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("Antigravity routing, schema and diagnostics checks passed");
