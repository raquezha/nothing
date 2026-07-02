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
/model antigravity/gemini-3.5-flash
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
  - `gemini-3.5-flash`
  - `gemini-3.1-pro`
  - `claude-sonnet-4-6`
  - `claude-opus-4-6`
  - `gpt-oss-120b`
  - plus additional Gemini / Claude catalog entries exposed by the package
- Runtime routing examples:
  - `gemini-3.5-flash` -> routes internally by reasoning level (`off`/`low`/`high`) to Antigravity runtime IDs such as `gemini-3.5-flash-extra-low`, `gemini-3.5-flash-low`, or `gemini-3-flash-agent`
  - `gemini-3.1-pro` -> routes internally to `gemini-3.1-pro-low` or `gemini-pro-agent`
  - `claude-sonnet-4-6` -> routes to `claude-sonnet-4-6`
  - `claude-opus-4-6` -> routes to `claude-opus-4-6-thinking`
  - `gpt-oss-120b` -> routes to `gpt-oss-120b-medium`
- Migration note:
  - old public ids like `gemini-3.5-flash-high`, `gemini-3.5-flash-low`, `gemini-3.1-pro-low`, `gemini-3.1-pro-high`, `claude-sonnet-4-6-thinking`, and `gpt-oss-120b-medium` were replaced by cleaner public ids plus internal routing.
- Default endpoint: `https://daily-cloudcode-pa.googleapis.com`

## Diagnostics

`/antigravity.doctor` prints sanitized routing information only. It must not print OAuth tokens, refresh tokens, authorization headers, prompts, or credential files.

## Optional overrides

Prefer the `ANTIGRAVITY_*` names for environment alignment. The older
`NOAGY_*` names remain accepted as backwards-compatible aliases.

- `ANTIGRAVITY_BASE_URL` — override the Cloud Code/Antigravity endpoint for experiments.
- `ANTIGRAVITY_PROJECT_ID` — fallback project id if project discovery does not return one.
- `ANTIGRAVITY_CALLBACK_HOST` — OAuth callback bind host, default `127.0.0.1`.
- `ANTIGRAVITY_USER_AGENT` — override user agent for endpoint compatibility experiments.
- `ANTIGRAVITY_RUNTIME_MODEL` — force a runtime model id for endpoint experiments.
- `ANTIGRAVITY_CLIENT_ID` / `ANTIGRAVITY_CLIENT_SECRET` — advanced OAuth app overrides; normally not needed.
