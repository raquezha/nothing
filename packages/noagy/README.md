# Antigravity (noagy extension)

Independent native Pi provider for Google Antigravity-compatible model access.

The extension folder is `noagy`, but the provider registered inside Pi is `antigravity`.

## Usage

```bash
# From this checkout
pi --extension ./packages/noagy

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
npm install -g @raquezha/noagy
```

## Provider

- Provider id: `antigravity`
- Model ids:
  - `gemini-3.5-flash-low` -> upstream `gemini-3.5-flash-extra-low`
  - `gemini-3.5-flash` -> upstream `gemini-3.5-flash-low` (medium/default)
  - `gemini-3.5-flash-high` -> upstream `gemini-3-flash-agent`
  - `gemini-3.1-pro-low` -> upstream `gemini-3.1-pro-low`
  - `gemini-3.1-pro-high` -> upstream `gemini-pro-agent`
  - `claude-sonnet-4-6-thinking` -> upstream `claude-sonnet-4-6`
  - `claude-opus-4-6-thinking` -> upstream `claude-opus-4-6-thinking`
  - `gpt-oss-120b-medium` -> upstream `gpt-oss-120b-medium`
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
