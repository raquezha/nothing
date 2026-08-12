# nodesign

Deterministic design preflight CLI for RPIV and Android UI work.

`nodesign` is a small standalone package that answers one question before UI implementation starts:

- what UI stack does this repo appear to use?
- are there reusable UI components already in the codebase?
- can we emit a stable machine-readable and human-readable preflight result without guessing?

Current scope is intentionally narrow:
- Android Compose / XML Views / mixed / KMP Compose Multiplatform / ambiguous / n/a detection
- reusable `ui/components` file discovery
- deterministic CLI behavior suitable for automation

Not in scope yet:
- live Figma API calls
- live Zeplin API calls
- credential storage implementation
- asset export
- code generation

## What bootstrap does

`./bootstrap.sh` will build this workspace locally when it installs workspace dependencies and runs workspace builds.

That means this always works from this checkout:

```bash
cd /Users/raquezha/RQZ/personal/nothing
node packages/nodesign/bin/nodesign.js --help
```

If you run bootstrap in published-package install mode, it also installs `@raquezha/nodesign` globally the same way it installs the other published `@raquezha/*` packages.

So after publish, bootstrap can make `nodesign` available everywhere on your machine.

If you want `nodesign` available everywhere manually, use one of these after publish:

```bash
npx @raquezha/nodesign --help
npm install -g @raquezha/nodesign
```

Or for local dev only, from this repo:

```bash
cd packages/nodesign
npm install
npm run build
node bin/nodesign.js --help
```

## Usage

### Show help

```bash
node packages/nodesign/bin/nodesign.js --help
```

### Run preflight on the current repo

```bash
node packages/nodesign/bin/nodesign.js preflight --json --path . --task github:101
```

### Run preflight on another repo

```bash
node packages/nodesign/bin/nodesign.js preflight --json --path ~/src/android-app --task local:smoke
```

### Version

```bash
node packages/nodesign/bin/nodesign.js --version
```

## Commands

### `preflight`

Inspect a target directory and emit a design preflight result.

Options:
- `--json` output JSON instead of human-readable text
- `--path <dir>` target directory to inspect
- `--task <id>` task identifier included in output

Examples:

```bash
node packages/nodesign/bin/nodesign.js preflight --path .
node packages/nodesign/bin/nodesign.js preflight --json --path . --task github:101
```

### `extract`

Reserved for later design-source extraction work.

Current behavior:
- stub command
- requires `--url <design-url>`
- exits non-zero on malformed usage

### `auth login`

Reserved for later credential storage work.

Current behavior:
- stub command
- only `auth login` is accepted
- exits non-zero for other auth subcommands

## Output

### Human-readable

Example:

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

Example shape:

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

## Detection rules

`androidUIStack` currently reports one of:
- `compose`
- `views`
- `mixed`
- `kmp`
- `ambiguous`
- `n/a`

High-level rules:
- `compose`: Android Compose signals in Gradle
- `views`: Android `res/layout` or qualified `layout-*` XML directories
- `mixed`: both Compose and Views signals present
- `kmp`: Compose Multiplatform signals, not just any `commonMain`
- `ambiguous`: Android project signals exist, but stack is unclear
- `n/a`: no Android/KMP UI signals found

Guardrails built in:
- ignores generated dirs like `build/` and `.gradle/`
- invalid commands fail non-zero
- invalid `--path` fails non-zero
- missing option values fail non-zero
- plain JVM Gradle repos should stay `n/a`
- plain KMP shared-logic repos should stay `n/a`

## Reusable component scanning

`nodesign` currently scans for files under:

```text
ui/components/
```

Recognized component file types:
- `.kt`
- `.kts`
- `.xml`
- `.tsx`
- `.ts`
- `.jsx`
- `.js`

The scanner reports file paths only. It does not yet parse component signatures or rank reuse quality.

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

## Limitations

Current limitations are deliberate:
- no real Android repo smoke test is baked into the package
- no live design provider integrations yet
- no auth backend yet
- detection is heuristic, not a full Gradle model parser
- component discovery is path-based, not semantic

## Recommended rollout for teammates

### From this repo

Use this when working inside the monorepo before npm publish:

```bash
cd /Users/raquezha/RQZ/personal/nothing
node packages/nodesign/bin/nodesign.js preflight --json --path .
```

### After publish

Use this when you want `nodesign` everywhere:

```bash
npx @raquezha/nodesign preflight --json --path ~/src/android-app
# or
npm install -g @raquezha/nodesign
nodesign preflight --json --path ~/src/android-app
```

### Bootstrap note

Global bootstrap install depends on the package being published to npm first.
If `@raquezha/nodesign` is not published yet, bootstrap can still build the local workspace copy, but the global `npm install -g @raquezha/nodesign` step will not succeed.

## Package metadata

- package: `@raquezha/nodesign`
- binary: `nodesign`
- source: `packages/nodesign/`
