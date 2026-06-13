import assert from "node:assert";
import { __test__ } from "./dist/index.js";

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

async function runAll() {
  try {
    await testLoopPrevention();
    await testThrottle();
    await testZeroSavings();
    console.log("ALL LOGIC VERIFIED ✓");
  } catch (e) {
    console.error("TEST FAILED ✗");
    console.error(e);
    process.exit(1);
  }
}

runAll();
