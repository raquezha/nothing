# @raquezha/nodesign

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
