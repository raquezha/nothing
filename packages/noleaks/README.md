# noleaks

Senior-grade credentials guard and Data Loss Prevention (DLP) shield for the Pi Coding Agent. It intercepts tool calls to block unauthorized access to sensitive files and redacts secrets from tool outputs.

> **Security model:** `noleaks` is a powerful defense-in-depth "seatbelt," not an airtight sandbox. It prevents accidental leaks and stops common AI exfiltration techniques. For untrusted code or unattended automation, always use a real sandbox like Docker or a Micro-VM.

## Key Features

- **3-Tier Security Modes**: Switch between `max`, `basic`, and `off` using the `/noleaks` command.
- **Output Scrubbing (DLP)**: Automatically redacts tokens, keys, and secret assignments from any tool's `stdout` before the agent sees it.
- **Symlink Guard**: Resolves paths to their "real" location on disk, preventing bypasses using symbolic links.
- **Obfuscation Detection**: Normalized Unicode (NFKC) and character-stripping to detect homoglyph attacks and command obfuscation.
- **Universal Word Scanning**: Scans every word in a bash command to catch dangerous utilities hidden as arguments (e.g., `sudo chmod`).

## Commands

| Command | Description |
|---|---|
| `/noleaks` | Show session statistics (blocked calls, redacted secrets). |
| `/noleaks mode max` | **(Default)** Blocks sensitive paths AND redacts secrets from output. |
| `/noleaks mode basic` | Allows reading sensitive paths but **still redacts secrets** from the output (Safe Debugging). |
| `/noleaks mode off` | Disables all path blocking and redaction (Status icon: 🔓). |

## What it blocks (in MAX mode)

| Category | Examples |
|---|---|
| Environment files | `.env`, `.env.local`, `.env.production` |
| Private keys | `id_rsa`, `id_ed25519`, `.pem`, `.key`, `.p12`, `.pfx`, `.keystore` |
| Credential stores | `auth.json`, `.npmrc`, `.netrc`, `.pypirc`, `.pi-secrets/`, `~/.ssh/` |
| Cloud / platform config | `~/.aws/`, `~/.azure/`, `~/.config/gcloud/`, `~/.docker/`, `~/.kube/`, `~/.gnupg/` |
| Discovery Tools | `nmap`, `tcpdump`, `wireshark` (when combined with secrets) |

## Usage

```bash
# Load directly
pi --extension ./packages/noleaks

# Via nothing mindset (meta)
pi --meta
```

## Settings

Settings are persisted to `~/.pi/agent/noleaks.json`. You can also enable it globally by setting `"noleaks": true` in your main `settings.json`.
