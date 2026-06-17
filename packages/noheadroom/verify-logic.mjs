import assert from "node:assert";
import { __test__ } from "./dist/index.js";
import { applyCompressionResult, buildCompressionPayload } from "./dist/bridge.js";

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

  // Pass 3: Real new turn (content changed)
  console.log(" - Pass 3: New turn (content changed)...");
  const newMessages = [...initialMessages, { role: "user", content: "new question" }];
  // Reset time to avoid throttle
  runtime.state.lastCompressionTime = 0;
  const event3 = { messages: newMessages };
  const res3 = await handleContextCompression(runtime, event3, createMockCtx(newMessages));
  
  assert(res3 !== undefined, "Should compress when content actually changes");
  assert(client.calls === 2, "Should call headroom for new content");

  console.log("✓ Loop prevention test passed\n");
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
    state: { enabled: true, proxyOnline: true, processing: false, lastInputFingerprint: null, lastOutputFingerprint: null, lastCompressionTime: 0, stats: { attempts:0, applied:0, guardSkips:0, tokensSaved:0 } },
    refreshStatus: () => {}
  };

  const msgs = [{ role: "user", content: "hi" }, { role: "toolResult", toolCallId: "c", toolName:"t", content: "stable text" }];
  
  const res1 = await handleContextCompression(runtime, { messages: msgs }, createMockCtx(msgs));
  assert(res1 === undefined, "Should return undefined if no tokens saved");
  assert(client.calls === 1);
  assert(runtime.state.lastInputFingerprint !== null, "Should record input fingerprint even if no savings");

  // Immediate retry with same content (after clearing time)
  runtime.state.lastCompressionTime = 0;
  const res2 = await handleContextCompression(runtime, { messages: msgs }, createMockCtx(msgs));
  assert(res2 === undefined, "Should skip second attempt if input fingerprint matches");
  assert(client.calls === 1, "Should NOT call client again");

  console.log("✓ Zero savings test passed\n");
}

function testAssistantToolCallPreservation() {
  console.log("Testing Assistant Tool Call Preservation...");

  const messages = [
    { role: "user", content: "summarize this" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "I will update the plan and write the change." },
        { type: "toolCall", id: "call_123", name: "edit", arguments: { path: "WORK.md", edits: [] } }
      ]
    },
    { role: "toolResult", toolCallId: "call_123", toolName: "edit", content: "Successfully replaced 1 block." },
    { role: "user", content: "what changed?" }
  ];

  const payload = buildCompressionPayload(messages, 1);
  const assistantMappingIndex = payload.mappings.findIndex((m) => m.sourceIndex === 1);
  assert(assistantMappingIndex >= 0, "Assistant tool-call message should be mapped");

  const compressedMessages = payload.mappings.map((mapping, index) => {
    if (index !== assistantMappingIndex) return mapping.message;
    return {
      ...mapping.message,
      content: "Shorter plan update summary.",
      tool_calls: mapping.message.role === "assistant" ? mapping.message.tool_calls : undefined
    };
  });

  const applied = applyCompressionResult(messages, payload.mappings, compressedMessages, { minMessageChars: 1 });
  assert(applied.ok === true, "Compression result should apply cleanly");

  const assistant = applied.messages[1];
  assert(Array.isArray(assistant.content), "Assistant content should remain a block array");
  assert(assistant.content.some((part) => part.type === "toolCall" && part.id === "call_123"), "Assistant toolCall block must be preserved");
  assert(assistant.content.some((part) => part.type === "text" && part.text === "Shorter plan update summary."), "Assistant text block should be updated");

  console.log("✓ Assistant tool-call preservation passed\n");
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

async function runAll() {
  try {
    await testLoopPrevention();
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
