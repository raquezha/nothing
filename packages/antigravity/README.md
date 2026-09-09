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
  - `gemini-3.7-flash`
  - `gemini-3.6-flash`
  - `gemini-3.5-flash`
  - `gemini-3.1-pro`
  - `claude-sonnet-4-6`
  - `claude-opus-4-6`
  - `gpt-oss-120b`
- Runtime routing examples:
  - `gemini-3.8-flash` -> `gemini-3.8-flash-tiered`
  - `gemini-3.7-flash` -> `gemini-3.7-flash-tiered`
  - Flash 3.7/3.8 thinking is server-managed (the single `high` selector maps to automatic thinking), not separate low/medium/high runtime IDs.
  - `gemini-3.5-flash` -> routes internally by reasoning level (`off`/`low`/`medium`/`high`) to Antigravity runtime IDs such as `gemini-3.5-flash-low`, `gemini-3.5-flash-medium`, or `gemini-3.5-flash-high`
  - `gemini-3.1-pro` -> routes internally to `gemini-3.1-pro-low` or `gemini-pro-agent`
  - `claude-sonnet-4-6` -> routes to `claude-sonnet-4-6` (always-on thinking)
  - `claude-opus-4-6` -> routes to `claude-opus-4-6-thinking`
  - `gpt-oss-120b` -> routes to `gpt-oss-120b-medium`
- Migration note:
  - old public ids like `gemini-3.5-flash-high`, `gemini-3.5-flash-low`, `gemini-3.1-pro-low`, `gemini-3.1-pro-high`, `claude-sonnet-4-6-thinking`, and `gpt-oss-120b-medium` were replaced by cleaner public ids plus internal routing.
- Default endpoint: `https://cloudcode-pa.googleapis.com` (fallback: `https://daily-cloudcode-pa.sandbox.googleapis.com`)

Catalog map keys are runtime IDs; nested `MODEL_PLACEHOLDER_*` values are not. Discovery uses exact keys first, then matching display names for renamed routes. Catalog presence does not guarantee quota or entitlement: a 429 requires waiting for the reported reset or checking your subscription, not another model alias.

After updating this checkout, run `/reload` in Pi to load the extension changes.

## Diagnostics

`/antigravity.doctor` prints sanitized routing information, including unlabeled catalog IDs, with no stale match from a previous request. It must not print OAuth tokens, refresh tokens, authorization headers, prompts, or credential files.

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
