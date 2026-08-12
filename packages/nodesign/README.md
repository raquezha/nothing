# nodesign

Deterministic design preflight CLI for Android UI work.

`nodesign` inspects a repository and answers a few practical questions before implementation starts:

- does this look like Compose, Views, mixed, KMP Compose, ambiguous, or non-UI?
- are there reusable files under `ui/components/`?
- can we emit stable text or JSON output for humans and automation?

It is intentionally small and deterministic.

## Install

Use without installing:

```bash
npx @raquezha/nodesign --help
```

Install globally:

```bash
npm install -g @raquezha/nodesign
nodesign --help
```

## Quick start

Inspect the current repo:

```bash
nodesign preflight --path .
```

Get JSON for automation:

```bash
nodesign preflight --json --path . --task github:101
```

Inspect another repo:

```bash
nodesign preflight --json --path ~/src/android-app --task local:smoke
```

Show version:

```bash
nodesign --version
```

## Commands

### `preflight`

Inspect a target directory and emit a design preflight result.

Options:
- `--json` output JSON instead of text
- `--path <dir>` directory to inspect
- `--task <id>` task identifier included in output

Examples:

```bash
nodesign preflight --path .
nodesign preflight --json --path . --task github:101
```

### `extract`

Reserved for later design-source extraction.

Current behavior:
- stub command
- requires `--url <design-url>`
- exits non-zero on malformed usage

### `auth login`

Reserved for later credential storage.

Current behavior:
- stub command
- only `auth login` is accepted
- exits non-zero for other auth subcommands

## Output

### Human-readable

```text
Design Brief: github:101
Timestamp: 2026-08-12T00:00:00.000Z

UI Sensitive: yes
Android UI Stack: compose
Evidence Status: missing

UI Components:
  - PrimaryButton (ui/components/PrimaryButton.kt)

Notes:
  - Found 1 reusable ui/components file(s)
```

### JSON

```json
{
  "taskId": "github:101",
  "timestamp": "2026-08-12T00:00:00.000Z",
  "preflight": {
    "uiSensitive": true,
    "androidUIStack": "compose",
    "evidenceStatus": "missing",
    "designLinks": [],
    "components": [
      {
        "name": "PrimaryButton",
        "path": "ui/components/PrimaryButton.kt"
      }
    ],
    "notes": [
      "Found 1 reusable ui/components file(s)"
    ]
  }
}
```

## Detection model

`androidUIStack` is one of:
- `compose`
- `views`
- `mixed`
- `kmp`
- `ambiguous`
- `n/a`

Current rules:
- `compose`: Android Compose signals in Gradle
- `views`: `res/layout` or qualified `layout-*` XML dirs
- `mixed`: both Compose and Views signals present
- `kmp`: Compose Multiplatform signals, not just any `commonMain`
- `ambiguous`: Android project signals exist, but stack is unclear
- `n/a`: no Android/KMP UI signals found

Guardrails:
- ignores generated dirs like `build/` and `.gradle/`
- invalid commands fail non-zero
- invalid `--path` fails non-zero
- missing option values fail non-zero
- plain JVM Gradle repos should stay `n/a`
- plain KMP shared-logic repos should stay `n/a`

## Reusable component scanning

`nodesign` currently scans files under:

```text
ui/components/
```

Recognized file types:
- `.kt`
- `.kts`
- `.xml`
- `.tsx`
- `.ts`
- `.jsx`
- `.js`

It reports file paths only. It does not yet parse component APIs or rank reuse quality.

## Automation behavior

`nodesign` is meant to be safe for scripts:
- unknown commands fail
- malformed auth invocations fail
- invalid paths fail
- missing option values fail
- JSON mode is stable and machine-readable

## Limitations

Deliberate limits for now:
- no live Figma API calls
- no live Zeplin API calls
- no auth backend yet
- no asset export
- no code generation
- detection is heuristic, not a full Gradle model parser
- component discovery is path-based, not semantic

## Development

```bash
cd packages/nodesign
npm install
npm test
```

Current tests cover:
- Compose detection
- Views detection
- mixed detection
- KMP Compose detection
- ambiguous Android detection
- plain KMP non-UI regression
- plain JVM Gradle regression
- generated-dir ignore regression
- component extension filtering
- CLI failure modes for invalid commands and paths

## Monorepo note

If you are working inside the `nothing` monorepo, this package also lives at:

```text
packages/nodesign/
```

Local repo usage before publish:

```bash
node packages/nodesign/bin/nodesign.js preflight --json --path .
```

The repo bootstrap can also install published `@raquezha/nodesign` globally when run in published-package install mode.
