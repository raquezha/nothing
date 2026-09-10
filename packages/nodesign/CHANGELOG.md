# @raquezha/nodesign

## 0.1.12

### Patch Changes

- 6d926fa: Clarify when to use nodesign versus native Figma or Zeplin MCP integrations.

## 0.1.11

### Patch Changes

- 306c0b2: Prettify auth login/logout/status output, validate tokens before saving, show account identity, and reject invalid tokens upfront.

## 0.1.10

### Patch Changes

- e07a3a2: Show direct Figma and Zeplin token creation URLs during `nodesign auth login`.

## 0.1.9

### Patch Changes

- defa764: Add human-readable error descriptions for vague Figma and Zeplin auth, access, not found, rate limit, and API failures.

## 0.1.8

### Patch Changes

- 523e979: Explain Zeplin DESIGN_NOT_FOUND results with a clear human-readable error description.

## 0.1.7

### Patch Changes

- 6a4de04: Beautify plain `nodesign extract` terminal output with a compact Clack-inspired status card.

## 0.1.6

### Patch Changes

- 87fd2d7: Suggest active candidate screens from accessible Zeplin projects when a Zeplin screen ID returns 404.

## 0.1.5

### Patch Changes

- 74c7f06: Add automatic project fallback and project screen resolution for Zeplin URLs with stale/deleted screen IDs.
- 87fd2d7: Suggest active candidate screens from accessible Zeplin projects when a Zeplin screen ID returns 404.

## 0.1.4

### Patch Changes

- 80f808e: Redesign `nodesign auth login` TUI with `@clack/prompts`-inspired layout, clean step indicators, and interactive radio selector.
- 16a9405: Clean raw quotes and Bearer prefixes from PAT tokens and pass dual Zeplin-Access-Token and Authorization headers.
- 8768ed8: Add zero-dependency interactive TUI arrow selection menu and boxed guidance cards for `nodesign auth login`.

## 0.1.3

### Patch Changes

- 80f148b: Synchronize `.env` and `~/.pi-secrets/.env` credential entries on `nodesign auth login` and `logout` to prevent stale `.env` files from shadowing new stored tokens.
- 0f5a72c: Support positional provider and token arguments for `nodesign auth login` (e.g. `nodesign auth login zeplin <token>`).
- 6e5f8be: Disambiguate Zeplin 404 screen responses by validating token identity against /v1/users/me, returning AUTH_REJECTED (TOKEN_INVALID) when credentials are invalid.
- 67d1c22: Support Zeplin project dashboard URLs (app.zeplin.io/project/<projectId>/dashboard) and fallback project screens extraction in nodesign.
- 0cbc30f: Resolve Zeplin shortlinks (zpl.io/<code) to canonical screenId via HTTP redirect resolution, preventing false 404 DESIGN_NOT_FOUND errors.

## 0.1.2

### Patch Changes

- 3789998: Document private file authentication flow and credential resolution for npx execution in nodesign README.
- d6269d1: Add explicit Installation section to nodesign README with npx and global npm options.

## 0.1.1

### Patch Changes

- 4b81a23: Add standalone auth login and status flows for nodesign, with credential source resolution from cwd .env, pi-secrets, OS keychain, and config-file fallback.

  Connect norpiv planning preflight to nodesign as a package dependency, with documented npx fallback.

## 0.1.0

### Minor Changes

- 5fdcdea: Consume NoDesign preflight before planning UI-sensitive work and expand non-Jira design link resolution.

  Refs #100

- 89c0333: add Figma prototype evidence preflight resolution and structured Jira link scanning

### Patch Changes

- df8357f: Add Figma prototype evidence preflight and resolution support in NoDesign.
- 6afd9a9: Add Jira task context inspector and Zeplin design link extraction.
- ebc8e25: Scaffold nodesign package with CLI binary, type definitions, and dual-format brief formatter.
- 8b0b5a7: Add exact Android UI property verification reporting and formatting helper in NoDesign.
