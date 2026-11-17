# Antigravity (antigravity extension)

Independent native Pi provider for Google Antigravity-compatible model access.

The extension folder is `antigravity`, and the provider registered inside Pi is `antigravity`.

## Usage

```bash
# From this checkout
pi --extension ./packages/antigravity

# Or via nothing
pi --antigravity
```

Inside Pi:

```text
/login antigravity
/model antigravity/gemini-3.8-flash
/antigravity.doctor
```

The extension uses a native `streamSimple` transport. It does **not** shell out to the official `agy` CLI.

## NPM

```bash
npm install -g @raquezha/antigravity
```

## Provider

- Provider id: `antigravity`
- Public model ids:
  - `gemini-3.8-flash`
  - `gemini-3.5-flash`
  - `gemini-3.1-pro`
  - `gemini-4-argon`
  - `gemini-4-hydrogen`
  - `claude-sonnet-5-5`
  - `claude-opus-5-5`
  - `gpt-oss-120b`
- Runtime routing examples:
  - `gemini-3.8-flash` -> `gemini-3.8-flash-tiered`
  - Flash 3.8 thinking is server-managed (the single `high` selector maps to automatic thinking), not separate low/medium/high runtime IDs.
  - `gemini-3.5-flash` -> routes internally by reasoning level (`off`/`low`/`medium`/`high`) to Antigravity runtime IDs such as `gemini-3.5-flash-low`, `gemini-3.5-flash-medium`, or `gemini-3.5-flash-high`
  - `gemini-3.1-pro` -> routes internally to `gemini-3.1-pro-low` or `gemini-pro-agent`
  - `gemini-4-argon` -> routes internally by reasoning level to `gemini-4-argon-low`, `gemini-4-argon-medium`, or `gemini-4-argon-high` (falls back to unified `gemini-4-argon`)
  - `gemini-4-hydrogen` -> routes internally by reasoning level to `gemini-4-hydrogen-low`, `gemini-4-hydrogen-medium`, `gemini-4-hydrogen-high`, or `gemini-4-hydrogen-xhigh` (falls back to unified `gemini-4-hydrogen`; default effort is `high`)
  - `claude-sonnet-5-5` -> routes internally by reasoning level to `claude-sonnet-5-5-low`, `claude-sonnet-5-5-medium`, or `claude-sonnet-5-5-high`
  - `claude-opus-5-5` -> routes internally by reasoning level to `claude-opus-5-5-low`, `claude-opus-5-5-medium`, or `claude-opus-5-5-high`
  - `gpt-oss-120b` -> routes to `gpt-oss-120b-medium`
- Default endpoint: `https://daily-cloudcode-pa.googleapis.com` (fallbacks: `https://cloudcode-pa.googleapis.com`, then `https://daily-cloudcode-pa.sandbox.googleapis.com`)

Catalog map keys are runtime IDs; nested `MODEL_PLACEHOLDER_*` values are not. Discovery uses exact keys first, then matching display names for renamed routes. Catalog presence does not guarantee quota or entitlement: a 429 requires waiting for the reported reset or checking your subscription, not another model alias.

After updating this checkout, run `/reload` in Pi to load the extension changes.

## Diagnostics

`/antigravity.doctor` prints sanitized routing information from a disk-backed diagnostics snapshot (`~/.pi/agent/antigravity-diagnostics.json`), including unlabeled catalog IDs, with no stale match from a previous request. It must not print OAuth tokens, refresh tokens, authorization headers, prompts, or credential files.

Do not inject Google DeepMind / official Antigravity persona text into `systemInstruction`. Free-tier Cloud Code Assist rejects that branding with `RESOURCE_EXHAUSTED`.

Claude uses the backend's legacy tool-schema field; literal `const` constraints are converted to single-value enums. Request-format errors retain the backend's rejected-field message for diagnosis.

Run offline regression checks with `npm test -w @raquezha/antigravity`.

## Optional overrides

Prefer the `ANTIGRAVITY_*` names for environment alignment. The older
`NOAGY_*` names remain accepted as backwards-compatible aliases.

- `ANTIGRAVITY_BASE_URL` — override the Cloud Code/Antigravity endpoint for experiments.
- `ANTIGRAVITY_PROJECT_ID` — fallback project id if project discovery does not return one.
- `ANTIGRAVITY_CALLBACK_HOST` — OAuth callback bind host, default `127.0.0.1`.
- `ANTIGRAVITY_USER_AGENT` — override user agent for endpoint compatibility experiments.
- `ANTIGRAVITY_RUNTIME_MODEL` — force a runtime model id for endpoint experiments.
- `ANTIGRAVITY_CLIENT_ID` / `ANTIGRAVITY_CLIENT_SECRET` — advanced OAuth app overrides; normally not needed.
