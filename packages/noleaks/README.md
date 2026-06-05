# noleaks

Security credentials protector shield for the Pi Coding Agent. Intercepts all tool calls and blocks the LLM from reading, writing, grepping, or listing sensitive files — `.env`, private keys, SSH keys, credential stores, and the `~/.pi-secrets` directory.

## What it blocks

| Category | Examples |
|---|---|
| Environment files | `.env`, `.env.local`, `.env.production` |
| Private keys | `id_rsa`, `id_ed25519`, `.pem`, `.key`, `.p12`, `.pfx`, `.keystore` |
| Credential stores | `auth.json`, `.pi-secrets/`, `~/.ssh/` |
| Protected directories | `.secrets/`, `.pi-secrets/`, `.ssh/` |

## Blocked operations

- `read` / `write` / `edit` on protected paths
- `bash` commands that reference protected directories or attempt to read sensitive files via `cat`, `grep`, `rg`, `sed`, `awk`, `base64`, etc.
- `ls`, `find`, `grep` on protected paths

Safe operations (e.g. `source ~/.pi-secrets/.env` in your own setup scripts) run outside Pi and are unaffected.

## Usage

```bash
# Load directly
pi --extension ./packages/noleaks

# Via nothing mindset (meta)
pi --meta
```

## NPM

```bash
npm install -g @raquezha/noleaks
```

## Settings shorthand

Setting `"noleaks": true` in `settings.json` enables this extension globally without specifying it per mindset.
