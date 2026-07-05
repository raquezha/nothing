import assert from "node:assert";
import { __test__ } from "./dist/index.js";
import { applyCompressionResult, buildCompressionPayload } from "./dist/bridge.js";
import { loadHeadroomConfig } from "./dist/config.js";

const { handleContextCompression, generateFingerprint } = __test__;

// --- Mocking ---

class MockClient {
  constructor(savingFactor = 0.5) {
    this.savingFactor = savingFactor;
    this.calls = 0;
  }
  async compress(messages, model, signal) {
    this.calls++;
    const compressed = messages.map(m => {
      if (m.role === 'tool') {
        const len = m.content.length;
        return { ...m, content: m.content.substring(0, Math.floor(len * this.savingFactor)) };
      }
      return m;
    });
    
    // Simulate headroom metadata
    const tokensBefore = 1000; // dummy
    const tokensAfter = Math.floor(tokensBefore * this.savingFactor);
    
    return {
      compressed: true,
      messages: compressed,
      tokensBefore,
      tokensAfter,
      tokensSaved: tokensBefore - tokensAfter,
      compressionRatio: tokensAfter / tokensBefore,
      transformsApplied: ['mock'],
      ccrHashes: []
    };
  }
}

const mockPi = {
  on: () => {},
  registerCommand: () => {},
  registerMessageRenderer: () => {},
  appendEntry: () => {},
  sendMessage: () => {}
};

const mockConfig = {
  enabled: true,
  baseUrl: 'http://localhost',
  minContextTokens: 0,
  minMessageChars: 1,
  timeoutMs: 1000
};

const createMockCtx = (messages) => ({
  model: { id: 'gpt-4' },
  signal: new AbortController().signal,
  getContextUsage: () => ({ tokens: 1000 }),
  ui: {
    notify: () => {},
    setStatus: () => {},
    theme: { fg: (c, t) => t }
  },
  hasUI: true
});

// --- Test Suite ---

async function testLoopPrevention() {
  console.log("Testing Loop Prevention...");
  
  const client = new MockClient();
  const runtime = {
    pi: mockPi,
    config: mockConfig,
    client: client,
    state: {
      enabled: true,
      proxyOnline: true,
      processing: false,
      lastInputFingerprint: null,
      lastOutputFingerprint: null,
      lastCompressionTime: 0,
      stats: { attempts: 0, applied: 0, guardSkips: 0, tokensSaved: 0 }
    },
    refreshStatus: () => {}
  };

  const initialMessages = [
    { role: "user", content: "hello" },
    { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "read", arguments: "{}" } }] },
    { role: "toolResult", toolCallId: "c1", toolName: "read", content: "A".repeat(5000) }
  ];

  // Pass 1: Initial compression
  console.log(" - Pass 1: Initial compression...");
  const event1 = { messages: initialMessages };
  const res1 = await handleContextCompression(runtime, event1, createMockCtx(initialMessages));
  
  assert(res1 !== undefined, "Should compress on first pass");
  assert(client.calls === 1, "Should call headroom once");
  const outputFingerprint = generateFingerprint(res1.messages);
  
  // Pass 2: Recursion (Pi gives back the compressed messages)
  console.log(" - Pass 2: Simulated recursion (input == previous output)...");
  const event2 = { messages: res1.messages };
  const res2 = await handleContextCompression(runtime, event2, createMockCtx(res1.messages));
  
  assert(res2 === undefined, "Should BLOCK recursion if input matches previous output");
  assert(client.calls === 1, "Should NOT call headroom on recursion");

  // Pass 3: New user turn with unchanged toolResult should not waste another proxy call.
  console.log(" - Pass 3: New turn, same candidate content...");
  const newMessages = [...initialMessages, { role: "user", content: "new question" }];
  runtime.state.lastCompressionTime = 0;
  const event3 = { messages: newMessages };
  const res3 = await handleContextCompression(runtime, event3, createMockCtx(newMessages));
  
  assert(res3 === undefined, "Should skip when only surrounding conversation changes");
  assert(client.calls === 1, "Should not call headroom for unchanged candidate content");

  // Pass 4: Actually changed toolResult content should still compress.
  console.log(" - Pass 4: Candidate content changed...");
  const changedMessages = [
    { role: "user", content: "hello" },
    { role: "assistant", content: null, tool_calls: [{ id: "c2", type: "function", function: { name: "read", arguments: "{}" } }] },
    { role: "toolResult", toolCallId: "c2", toolName: "read", content: "B".repeat(5000) }
  ];
  runtime.state.lastCompressionTime = 0;
  const res4 = await handleContextCompression(runtime, { messages: changedMessages }, createMockCtx(changedMessages));
  assert(res4 !== undefined, "Should compress when candidate content actually changes");
  assert(client.calls === 2, "Should call headroom for changed candidate content");

  console.log("✓ Loop prevention test passed\n");
}

async function testRepeatedReadContentLoop() {
  console.log("Testing Repeated Read Content Loop...");
  const client = new MockClient();
  const runtime = {
    pi: mockPi, config: mockConfig, client,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastGuardSkipCandidateFingerprint: null, seenCandidateContentFingerprints: new Set(), lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  const fullFile = "function important() { return 42; }\n".repeat(200);
  const first = [
    { role: "user", content: "read file" },
    { role: "toolResult", toolCallId: "read-1", toolName:"read", content: fullFile }
  ];

  const compressed = await handleContextCompression(runtime, { messages: first }, createMockCtx(first));
  assert(compressed !== undefined, "Should compress first read");
  assert(client.calls === 1, "Should call Headroom for first read");

  runtime.state.lastCompressionTime = 0;
  const reread = [
    ...compressed.messages,
    { role: "user", content: "read it again, previous result was incomplete" },
    { role: "toolResult", toolCallId: "read-2", toolName:"read", content: fullFile }
  ];
  const skipped = await handleContextCompression(runtime, { messages: reread }, createMockCtx(reread));
  assert(skipped === undefined, "Should skip duplicate same-content reread");
  assert(client.calls === 1, "Should NOT call Headroom again for same content under new toolCallId");

  runtime.state.lastCompressionTime = 0;
  const changed = [
    ...compressed.messages,
    { role: "user", content: "read changed file" },
    { role: "toolResult", toolCallId: "read-3", toolName:"read", content: fullFile.replace("42", "43") }
  ];
  await handleContextCompression(runtime, { messages: changed }, createMockCtx(changed));
  assert(client.calls === 2, "Should still call Headroom when content actually changes");

  console.log("✓ Repeated read content loop test passed\n");
}

async function testSeenCandidateMemoryCap() {
  console.log("Testing Seen Candidate Memory Cap...");
  const client = new MockClient();
  const runtime = {
    pi: mockPi, config: mockConfig, client,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastGuardSkipCandidateFingerprint: null, seenCandidateContentFingerprints: new Set(), seenCandidateContentOrder: [], lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  for (let i = 0; i < 270; i++) {
    const messages = [
      { role: "user", content: `read file ${i}` },
      { role: "toolResult", toolCallId: `read-${i}`, toolName:"read", content: `unique-${i}-`.repeat(500) }
    ];
    runtime.state.lastCompressionTime = 0;
    await handleContextCompression(runtime, { messages }, createMockCtx(messages));
  }

  assert(runtime.state.seenCandidateContentFingerprints.size <= 512, "Seen content fingerprint set should be capped");
  assert(runtime.state.seenCandidateContentOrder.length <= 512, "Seen content FIFO order should be capped");
  console.log("✓ Seen candidate memory cap test passed\n");
}

async function testFingerprintIncludesContent() {
  console.log("Testing Fingerprint Content Hash...");
  const client = new MockClient();
  const runtime = {
    pi: mockPi, config: mockConfig, client,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastGuardSkipCandidateFingerprint: null, lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  const makeMessages = (ch) => [
    { role: "user", content: "same prompt" },
    { role: "toolResult", toolCallId: "c", toolName:"read", content: ch.repeat(5000) }
  ];
  const first = makeMessages("A");
  const second = makeMessages("B");

  assert.notEqual(generateFingerprint(first), generateFingerprint(second), "Same-length different content needs a different fingerprint");

  await handleContextCompression(runtime, { messages: first }, createMockCtx(first));
  runtime.state.lastCompressionTime = 0;
  await handleContextCompression(runtime, { messages: second }, createMockCtx(second));

  assert(client.calls === 2, "Should compress again when same-length content changes");
  console.log("✓ Fingerprint content hash test passed\n");
}

async function testThrottle() {
  console.log("Testing Throttle...");
  const client = new MockClient();
  const runtime = {
    pi: mockPi, config: mockConfig, client,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  const msgs = [{ role: "user", content: "hi" }, { role: "toolResult", toolCallId: "c", toolName:"t", content: "X".repeat(5000) }];
  
  await handleContextCompression(runtime, { messages: msgs }, createMockCtx(msgs));
  assert(client.calls === 1);
  
  // Instant retry with slightly different content (to bypass fingerprint)
  const msgs2 = [...msgs, { role: "user", content: "y" }];
  const res2 = await handleContextCompression(runtime, { messages: msgs2 }, createMockCtx(msgs2));
  
  assert(res2 === undefined, "Should throttle fast repeats even if content changes");
  assert(client.calls === 1, "Should not call headroom during throttle period");

  console.log("✓ Throttle test passed\n");
}

async function testZeroSavings() {
  console.log("Testing Zero Savings (No savings possible)...");
  const client = new MockClient(1.0); // 1.0 = no compression
  const runtime = {
    pi: mockPi, config: mockConfig, client,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastGuardSkipCandidateFingerprint: null, lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  const msgs = [{ role: "user", content: "hi" }, { role: "toolResult", toolCallId: "c", toolName:"t", content: "stable text" }];
  
  const res1 = await handleContextCompression(runtime, { messages: msgs }, createMockCtx(msgs));
  assert(res1 === undefined, "Should return undefined if no tokens saved");
  assert(runtime.state.stats.last === undefined, "stats.last must be cleared on 0-savings turn");
  assert(client.calls === 1);
  assert(runtime.state.lastInputFingerprint !== null, "Should record input fingerprint even if no savings");

  // Immediate retry with same content (after clearing time)
  runtime.state.lastCompressionTime = 0;
  const res2 = await handleContextCompression(runtime, { messages: msgs }, createMockCtx(msgs));
  assert(res2 === undefined, "Should skip second attempt if input fingerprint matches");
  assert(client.calls === 1, "Should NOT call client again");

  // New conversational turn with unchanged candidate must not call Headroom again.
  runtime.state.lastCompressionTime = 0;
  const msgsNewTurn = [...msgs, { role: "user", content: "new question" }];
  const res3 = await handleContextCompression(runtime, { messages: msgsNewTurn }, createMockCtx(msgsNewTurn));
  assert(res3 === undefined, "Should skip if only surrounding conversation changed");
  assert(client.calls === 1, "Should NOT call client when candidate fingerprint is unchanged");

  // Same length but different toolResult content must call Headroom again.
  runtime.state.lastCompressionTime = 0;
  const msgsSameLengthDifferentContent = [
    { role: "user", content: "hi" },
    { role: "toolResult", toolCallId: "c", toolName:"t", content: "changed txt" },
    { role: "user", content: "new question" }
  ];
  assert(msgsSameLengthDifferentContent[1].content.length === msgs[1].content.length, "Fixture must keep same length");
  const res4 = await handleContextCompression(runtime, { messages: msgsSameLengthDifferentContent }, createMockCtx(msgsSameLengthDifferentContent));
  assert(res4 === undefined, "Still no savings, but should have attempted because content hash changed");
  assert(client.calls === 2, "Should call client when same-length candidate content changes");

  console.log("✓ Zero savings test passed\n");
}

function testAssistantToolCallPreservation() {
  console.log("Testing Assistant Tool Call Protection (New Policy)...");

  const messages = [
    { role: "user", content: "summarize this" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "I will update the plan and write the change." },
        { type: "toolCall", id: "call_123", name: "edit", arguments: { path: "WORK.md", edits: [] } }
      ]
    },
    { role: "toolResult", toolCallId: "call_123", toolName: "edit", content: "Successfully replaced 1 block. ".repeat(100) },
    { role: "user", content: "what changed?" }
  ];

  const payload = buildCompressionPayload(messages, 1);
  const assistantMappingIndex = payload.mappings.findIndex((m) => m.sourceIndex === 1);
  const toolResultMappingIndex = payload.mappings.findIndex((m) => m.sourceIndex === 2);
  
  assert(assistantMappingIndex >= 0, "Assistant tool-call message should be mapped");
  assert(payload.mappings[assistantMappingIndex].applyTo === null, "Assistant message should NOT be a candidate for mutation");

  const compressedMessages = payload.mappings.map((mapping, index) => {
    if (index === assistantMappingIndex) {
      // Headroom aggressively modifies both text AND tool calls of the assistant message!
      return {
        role: "assistant",
        content: "Shorter plan update summary.",
        // Oh no, Headroom stripped the tool calls entirely!
        tool_calls: undefined 
      };
    }
    if (index === toolResultMappingIndex) {
      // Headroom successfully compresses the toolResult
      return {
        ...mapping.message,
        content: "Replaced."
      };
    }
    return mapping.message;
  });

  const applied = applyCompressionResult(messages, payload.mappings, compressedMessages, { minMessageChars: 1 });
  assert(applied.ok === true, "Compression result should apply cleanly despite Headroom mangling the assistant message");
  assert(applied.appliedMessages === 1, "Should only apply 1 message (the toolResult)");

  const assistant = applied.messages[1];
  assert(Array.isArray(assistant.content), "Assistant content should remain unchanged (block array)");
  assert(assistant.content.some((part) => part.type === "toolCall" && part.id === "call_123"), "Assistant toolCall must be preserved");
  assert(assistant.content.some((part) => part.type === "text" && part.text === "I will update the plan and write the change."), "Assistant text MUST NOT be updated because it's a non-candidate");

  console.log("✓ Assistant tool-call protection passed\n");
}

async function testEdgeCases() {
  console.log("Testing Edge Cases...");
  const client = new MockClient();
  const runtime = {
    pi: mockPi, config: mockConfig, client,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  // Case 1: Empty tool result
  console.log(" - Case 1: Empty tool result...");
  const msgEmpty = [{ role: "user", content: "hi" }, { role: "toolResult", toolCallId: "c", toolName:"t", content: "" }];
  const resEmpty = await handleContextCompression(runtime, { messages: msgEmpty }, createMockCtx(msgEmpty));
  assert(resEmpty === undefined, "Should skip empty content (no savings possible)");

  // Case 2: Special characters
  console.log(" - Case 2: Special characters...");
  const msgSpec = [{ role: "user", content: "hi" }, { role: "toolResult", toolCallId: "c", toolName:"t", content: " Binary \x00 content \u1234".repeat(1000) }];
  runtime.state.lastCompressionTime = 0; // reset throttle
  const resSpec = await handleContextCompression(runtime, { messages: msgSpec }, createMockCtx(msgSpec));
  assert(resSpec !== undefined, "Should handle special characters");

  // Case 3: Mixed content blocks (Pi specific)
  console.log(" - Case 3: Mixed content blocks (Text + Image)...");
  const msgMixed = [
    { role: "user", content: "what is this?" },
    { role: "toolResult", toolCallId: "c", toolName:"t", content: [
      { type: "text", text: "A".repeat(5000) },
      { type: "image", data: "base64...", mimeType: "image/png" }
    ]}
  ];
  runtime.state.lastCompressionTime = 0;
  const resMixed = await handleContextCompression(runtime, { messages: msgMixed }, createMockCtx(msgMixed));
  assert(resMixed !== undefined, "Should handle mixed content blocks");
  assert(Array.isArray(resMixed.messages[1].content), "Should preserve content block array structure");
  assert(resMixed.messages[1].content.some(c => c.type === 'image'), "Should NOT lose the image block");

  // Case 4: No compressible messages (System only)
  console.log(" - Case 4: System only (no candidates)...");
  const msgSystem = [{ role: "system", content: "You are an AI" }];
  runtime.state.lastCompressionTime = 0;
  const resSystem = await handleContextCompression(runtime, { messages: msgSystem }, createMockCtx(msgSystem));
  assert(resSystem === undefined, "Should bail out if no messages are compressible");

  // Case 5: Tool ID mismatch (Headroom renames a tool ID)
  console.log(" - Case 5: Tool ID mismatch (Guard should catch it)...");
  const msgMismatch = [
    { role: "assistant", content: null, tool_calls: [{ id: "correct_id", type: "function", function: { name: "t", arguments: "{}" } }] },
    { role: "toolResult", toolCallId: "correct_id", toolName: "t", content: "A".repeat(5000) }
  ];
  const maliciousClient = {
    async compress(messages) {
      return { 
        compressed: true, 
        messages: messages.map(m => m.role === 'tool' ? { ...m, tool_call_id: 'HACKED_ID' } : m),
        tokensBefore: 1000, tokensAfter: 500, tokensSaved: 500, compressionRatio: 0.5, transformsApplied: [], ccrHashes: []
      };
    }
  };
  const runtimeMalicious = { 
    ...runtime, client: maliciousClient,
    state: { ...runtime.state, lastCompressionTime: 0 }
  };
  const resMismatch = await handleContextCompression(runtimeMalicious, { messages: msgMismatch }, createMockCtx(msgMismatch));
  assert(resMismatch === undefined, "Guard should BLOCK Headroom if it modifies tool_call_id");

  console.log("✓ Edge cases passed\n");
}

function testConfigMode() {
  console.log("Testing Config Mode Parsing...");
  
  // env tests
  assert(loadHeadroomConfig({ PI_HEADROOM_MODE: "quiet" }, {}).mode === "quiet", "PI_HEADROOM_MODE=quiet should parse to mode: quiet");
  assert(loadHeadroomConfig({ PI_HEADROOM_MODE: "silent" }, {}).mode === "silent", "PI_HEADROOM_MODE=silent should parse to mode: silent");
  assert(loadHeadroomConfig({ PI_HEADROOM_MODE: "normal" }, {}).mode === "normal", "PI_HEADROOM_MODE=normal should parse to mode: normal");
  
  // settings tests
  assert(loadHeadroomConfig({}, { mode: "quiet" }).mode === "quiet", "settings.mode=quiet should parse to mode: quiet");
  assert(loadHeadroomConfig({}, { mode: "silent" }).mode === "silent", "settings.mode=silent should parse to mode: silent");
  
  // backwards compat test
  assert(loadHeadroomConfig({}, { silent: true }).mode === "silent", "settings.silent=true should map to mode: silent");
  assert(loadHeadroomConfig({}, { silent: false }).mode === "normal", "settings.silent=false should map to mode: normal");

  console.log("✓ Config mode parsing passed\n");
}

async function testOutputModes() {
  console.log("Testing Output Modes...");
  
  const client = new MockClient();
  const msg = [
    { role: "user", content: "hi" },
    { role: "toolResult", toolCallId: "c", toolName:"t", content: "A".repeat(5000) }
  ];

  let notifies = 0;
  const mockCtx = createMockCtx(msg);
  mockCtx.ui.notify = () => { notifies++; };

  // Normal mode
  const runtimeNormal = {
    pi: mockPi, config: { ...mockConfig, mode: "normal" }, client,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };
  await handleContextCompression(runtimeNormal, { messages: msg }, mockCtx);
  assert(notifies === 1, "Normal mode should emit success notices");

  // Quiet mode
  notifies = 0;
  runtimeNormal.state.lastCompressionTime = 0;
  runtimeNormal.config.mode = "quiet";
  await handleContextCompression(runtimeNormal, { messages: msg }, mockCtx);
  assert(notifies === 0, "Quiet mode should suppress success notices");

  // Silent mode
  notifies = 0;
  runtimeNormal.state.lastCompressionTime = 0;
  runtimeNormal.config.mode = "silent";
  await handleContextCompression(runtimeNormal, { messages: msg }, mockCtx);
  assert(notifies === 0, "Silent mode should suppress success notices");

  // Guard skip notices
  const msgGuard = [
    { role: "user", content: "hi" },
    { role: "toolResult", toolCallId: "c", toolName:"t", content: "A".repeat(5000) }
  ];
  const clientMalicious = {
    async compress(messages) {
      return { 
        compressed: true, 
        // Malicious client renames the tool call ID, causing guard skip
        messages: messages.map(m => m.role === 'tool' ? { ...m, tool_call_id: "HACKED_ID" } : m),
        tokensBefore: 1000, tokensAfter: 500, tokensSaved: 500, compressionRatio: 0.5, transformsApplied: [], ccrHashes: []
      };
    }
  };
  
  const runtimeGuard = {
    pi: mockPi, config: { ...mockConfig, mode: "quiet" }, client: clientMalicious,
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  // quiet emits guard-skip
  notifies = 0;
  await handleContextCompression(runtimeGuard, { messages: msgGuard }, mockCtx);
  assert(notifies === 1, "Quiet mode should emit guard-skip notices");

  // silent suppresses guard-skip
  notifies = 0;
  runtimeGuard.config.mode = "silent";
  runtimeGuard.state.lastCompressionTime = 0;
  await handleContextCompression(runtimeGuard, { messages: msgGuard }, mockCtx);
  assert(notifies === 0, "Silent mode should suppress guard-skip notices");

  console.log("✓ Output modes passed\n");
}

async function runAll() {
  try {
    testConfigMode();
    await testOutputModes();
    await testLoopPrevention();
    await testRepeatedReadContentLoop();
    await testSeenCandidateMemoryCap();
    await testFingerprintIncludesContent();
    await testThrottle();
    await testZeroSavings();
    testAssistantToolCallPreservation();
    await testEdgeCases();
    console.log("ALL LOGIC VERIFIED ✓");
  } catch (e) {
    console.error("TEST FAILED ✗");
    console.error(e);
    process.exit(1);
  }
}

runAll();
