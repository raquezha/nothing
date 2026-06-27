import { __test__ } from "./dist/index.js";

const { handleContextCompression } = __test__;

class MockClient {
  calls = 0;
  async compress(messages) {
    this.calls++;
    return {
      compressed: true,
      messages: messages.map((m) => (m.role === "tool" ? { ...m, content: `[compressed:${this.calls}] ${m.content.slice(0, 80)}` } : m)),
      tokensBefore: 1000,
      tokensAfter: 100,
      tokensSaved: 900,
      compressionRatio: 0.1,
      transformsApplied: ["mock"],
      ccrHashes: [],
    };
  }
}

const scenarios = [
  {
    name: "generic file reread",
    prompt: "read file",
    content: "function important() { return 42; }\n".repeat(200),
  },
  {
    name: "Android Kotlin reread",
    prompt: "read Android ViewModel Kotlin file",
    content: `package com.example.app.feature.checkout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class CheckoutUiState(
    val loading: Boolean = false,
    val selectedPaymentMethod: String? = null,
    val errorMessage: String? = null,
)

class CheckoutViewModel(
    private val repository: CheckoutRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(CheckoutUiState())
    val state: StateFlow<CheckoutUiState> = _state

    fun submitOrder(cartId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            runCatching { repository.submit(cartId) }
                .onSuccess { _state.value = _state.value.copy(loading = false) }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        loading = false,
                        errorMessage = error.message ?: "Unable to submit order",
                    )
                }
        }
    }
}
`.repeat(45),
  },
  {
    name: "Android login crash experiment reread",
    prompt: "read login crash evidence for fake credentials bug",
    content: `Experiment: sample Android app login crash with fake credentials
Stack: Android app, emulator repro, logcat first, then source inspection
User action: enter fake credentials and tap Login
Expected: show invalid credentials error
Actual: app crashes before rendering error state

--------- beginning of crash
E/AndroidRuntime: FATAL EXCEPTION: main
E/AndroidRuntime: Process: com.example.delivery, PID: 18432
E/AndroidRuntime: java.lang.IllegalStateException: Required value was null.
E/AndroidRuntime:     at com.example.delivery.auth.LoginViewModel.onLoginResult(LoginViewModel.kt:87)
E/AndroidRuntime:     at com.example.delivery.auth.LoginViewModel.access$onLoginResult(LoginViewModel.kt:22)
E/AndroidRuntime:     at com.example.delivery.auth.LoginViewModel$login$1.invokeSuspend(LoginViewModel.kt:61)
E/AndroidRuntime:     at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:33)
E/AndroidRuntime:     at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:104)
E/AndroidRuntime:     at android.os.Handler.handleCallback(Handler.java:958)
E/AndroidRuntime: Caused by: retrofit2.HttpException: HTTP 401 Unauthorized
E/AndroidRuntime:     at retrofit2.KotlinExtensions$await$2$2.onResponse(KotlinExtensions.kt:53)

package com.example.delivery.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface LoginState {
    data object Idle : LoginState
    data object Loading : LoginState
    data class Success(val driverId: String) : LoginState
    data class Error(val message: String) : LoginState
}

class LoginViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _state = MutableStateFlow<LoginState>(LoginState.Idle)
    val state: StateFlow<LoginState> = _state

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _state.value = LoginState.Loading
            try {
                val response = authRepository.login(username, password)
                onLoginResult(response)
            } catch (error: Throwable) {
                _state.value = LoginState.Error(error.message ?: "Login failed")
            }
        }
    }

    private fun onLoginResult(response: LoginResponse) {
        val driverId = response.driver!!.id
        _state.value = LoginState.Success(driverId)
    }
}

data class LoginResponse(
    val token: String?,
    val driver: Driver?,
    val error: String?,
)

data class Driver(val id: String, val name: String)
`.repeat(22),
  },
  {
    name: "Ruby on Rails reread",
    prompt: "read Rails controller and model code",
    content: `class OrdersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_order, only: [:show, :update, :cancel]

  def create
    order = current_user.orders.build(order_params)
    if order.save
      OrderFulfillmentJob.perform_later(order.id)
      render json: OrderSerializer.new(order).serializable_hash, status: :created
    else
      render json: { errors: order.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @order.update(order_params)
      render json: OrderSerializer.new(@order).serializable_hash
    else
      render json: { errors: @order.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_order
    @order = current_user.orders.find(params[:id])
  end

  def order_params
    params.require(:order).permit(:delivery_address, :payment_method_id, line_items: [:sku, :quantity])
  end
end

class Order < ApplicationRecord
  belongs_to :user
  has_many :line_items, dependent: :destroy

  validates :delivery_address, presence: true
  validates :payment_method_id, presence: true

  enum status: { draft: 0, submitted: 1, fulfilled: 2, cancelled: 3 }
end
`.repeat(40),
  },
];

const mockConfig = {
  enabled: true,
  baseUrl: "http://localhost",
  minContextTokens: 0,
  minMessageChars: 1,
  timeoutMs: 1000,
  mode: "silent",
};

function createRuntime() {
  return {
    pi: { appendEntry: () => {} },
    config: mockConfig,
    client: new MockClient(),
    state: {
      enabled: true,
      proxyOnline: true,
      processing: false,
      lastInputFingerprint: null,
      lastOutputFingerprint: null,
      lastGuardSkipCandidateFingerprint: null,
      seenCandidateContentFingerprints: new Set(),
      seenCandidateContentOrder: [],
      lastCompressionTime: 0,
      stats: { attempts: 0, applied: 0, guardSkips: 0, tokensSaved: 0 },
    },
    refreshStatus: () => {},
  };
}

function createCtx(messages) {
  return {
    model: { id: "mock" },
    signal: new AbortController().signal,
    getContextUsage: () => ({ tokens: 1000 }),
    ui: { notify: () => {}, setStatus: () => {}, theme: { fg: (_color, text) => text } },
    hasUI: true,
  };
}

async function runRepeatedReads({ scenario, legacy, reads }) {
  const runtime = createRuntime();
  let messages = [
    { role: "user", content: scenario.prompt },
    { role: "toolResult", toolCallId: `${scenario.name}-read-1`, toolName: "read", content: scenario.content },
  ];

  const first = await handleContextCompression(runtime, { messages }, createCtx(messages));
  if (!first?.messages) throw new Error(`${scenario.name}: first compression did not apply`);
  messages = first.messages;

  for (let read = 2; read <= reads; read++) {
    if (legacy) {
      runtime.state.seenCandidateContentFingerprints = new Set();
      runtime.state.seenCandidateContentOrder = [];
    }
    runtime.state.lastCompressionTime = 0;
    const reread = [
      ...messages,
      { role: "user", content: "read it again, previous result was incomplete" },
      { role: "toolResult", toolCallId: `${scenario.name}-read-${read}`, toolName: "read", content: scenario.content },
    ];
    const result = await handleContextCompression(runtime, { messages: reread }, createCtx(reread));
    messages = result?.messages ?? reread;
  }
  return runtime.client.calls;
}

async function runBehaviorLoop({ scenario, legacy, maxReads }) {
  const runtime = createRuntime();
  let reads = 1;
  let messages = [
    { role: "user", content: scenario.prompt },
    { role: "toolResult", toolCallId: `${scenario.name}-read-1`, toolName: "read", content: scenario.content },
  ];

  while (reads <= maxReads) {
    if (legacy) {
      runtime.state.seenCandidateContentFingerprints = new Set();
      runtime.state.seenCandidateContentOrder = [];
    }
    runtime.state.lastCompressionTime = 0;
    const result = await handleContextCompression(runtime, { messages }, createCtx(messages));
    const visibleMessages = result?.messages ?? messages;
    const latestToolResult = [...visibleMessages].reverse().find((message) => message.role === "toolResult");
    const latestText = typeof latestToolResult?.content === "string" ? latestToolResult.content : "";
    const agentRereads = latestText.startsWith("[compressed:");
    if (!agentRereads || reads === maxReads) return { reads, calls: runtime.client.calls };
    reads++;
    messages = [
      ...visibleMessages,
      { role: "user", content: "read it again, previous result was incomplete" },
      { role: "toolResult", toolCallId: `${scenario.name}-read-${reads}`, toolName: "read", content: scenario.content },
    ];
  }

  return { reads, calls: runtime.client.calls };
}

const READS = 5;
const behaviorScenario = scenarios.find((scenario) => scenario.name === "Android login crash experiment reread");
if (!behaviorScenario) throw new Error("missing behavior scenario");

const repeatedReadResults = [];
for (const scenario of scenarios) {
  const legacyCalls = await runRepeatedReads({ scenario, legacy: true, reads: READS });
  const fixedCalls = await runRepeatedReads({ scenario, legacy: false, reads: READS });
  repeatedReadResults.push({
    scenario: scenario.name,
    bytes: scenario.content.length,
    reads: READS,
    legacyCalls,
    fixedCalls,
    avoidedCalls: legacyCalls - fixedCalls,
  });
}

const behaviorLoop = {
  scenario: behaviorScenario.name,
  maxReads: READS,
  legacy: await runBehaviorLoop({ scenario: behaviorScenario, legacy: true, maxReads: READS }),
  fixed: await runBehaviorLoop({ scenario: behaviorScenario, legacy: false, maxReads: READS }),
};

console.log("# noheadroom loop hardening benchmark\n");
console.log("## Direct repeated-read scaling\n");
console.log("| Scenario | Bytes | Reads | Legacy calls | Fixed calls | Avoided duplicate calls |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const result of repeatedReadResults) {
  console.log(`| ${result.scenario} | ${result.bytes.toLocaleString()} | ${result.reads} | ${result.legacyCalls} | ${result.fixedCalls} | ${result.avoidedCalls} |`);
}
console.log("\n## Behavioral loop simulator\n");
console.log("Deterministic rule: if the latest visible tool result still starts with `[compressed:*]`, the simulated agent rereads the same content. If the latest reread remains full text, it stops.\n");
console.log("| Scenario | Max reads | Legacy reads | Fixed reads | Legacy calls | Fixed calls |");
console.log("|---|---:|---:|---:|---:|---:|");
console.log(`| ${behaviorLoop.scenario} | ${behaviorLoop.maxReads} | ${behaviorLoop.legacy.reads} | ${behaviorLoop.fixed.reads} | ${behaviorLoop.legacy.calls} | ${behaviorLoop.fixed.calls} |`);
console.log("\n```json");
console.log(JSON.stringify({ repeatedReadResults, behaviorLoop }, null, 2));
console.log("```");

if (
  repeatedReadResults.some((result) => result.legacyCalls !== READS || result.fixedCalls !== 1 || result.avoidedCalls !== READS - 1) ||
  behaviorLoop.legacy.reads !== READS ||
  behaviorLoop.fixed.reads !== 2 ||
  behaviorLoop.legacy.calls !== READS ||
  behaviorLoop.fixed.calls !== 1
) {
  process.exitCode = 1;
}
