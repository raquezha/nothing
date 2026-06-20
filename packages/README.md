# Packages

This folder contains the local package and skill bundles that make up the `nothing` Pi coding-agent setup. Most packages are published under the `@raquezha/*` npm scope; `nometa` is currently local-only.

## Current state

| Folder | Package | Type | Status | What it provides |
|---|---|---|---|---|
| `antigravity/` | `@raquezha/antigravity` | Pi extension | Experimental | Google Antigravity-compatible provider with OAuth login and `/antigravity.doctor`. |
| `nofooter/` | `@raquezha/nofooter` | Pi extension | Usable | Powerline-style Pi footer/theme with token, cost, context, model, provider, and Git branch status. |
| `noleaks/` | `@raquezha/noleaks` | Pi extension | Usable defense-in-depth | Credentials guard and DLP shield that blocks sensitive files and redacts secret-looking output. |
| `nometa/` | Local skill bundle | Skills | Local-first | Meta/setup skills for maintaining `nothing`, creating skills, bootstrapping repos, and converting content to HTML. |
| `norpiv/` | `@raquezha/norpiv` | Skill bundle | Usable workflow | RPIV task lifecycle skills: triage, frame, grill-with-docs, plan, implement, verify, sync, update-docs, and post-merge-prune. |
| `nosearch/` | `@raquezha/nosearch` | Pi extension + skills | Usable | Brave Search and Firecrawl subagent wrapper plus bundled `brave-search` and `firecrawl` skills. |
| `notrace/` | `@raquezha/notrace` | Pi extension | Phase 0 / POC | Local-first interactive HTML trace reports for Pi sessions. Treat generated reports as sensitive. |

## Development notes

- Use npm workspaces from the repository root.
- TypeScript extensions build to `dist/`; generated outputs should not be committed.
- Extension source entrypoints live under each package's `extensions/<name>/` directory for Pi auto-discovery.
- Root `package-lock.json` owns workspace dependencies; do not add nested lockfiles.
- When changing package behavior, entrypoints, dependencies, or published contents, add a Changeset.

## Common commands

```bash
npm install
npm run build --workspaces --if-present
npm test
npm run verify:notrace
./bootstrap.sh --dry-run
```

For package-specific usage and install details, see each package's own `README.md`.
