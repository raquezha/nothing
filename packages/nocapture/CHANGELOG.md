# @raquezha/nocapture

## 0.5.0

### Minor Changes

- Add deterministic `--audio <file>` MP4 muxing (`AVFoundation` AAC on macOS, `ffmpeg` AAC on Linux) plus refined `comparison` template spacing and vector product logos.

## 0.4.0

### Minor Changes

- Add `nocapture init` command to scaffold plain HTML templates (`comparison`, `mobile`, `terminal`, and `tutorial`).
- Add inline vector goodies sprite with hand-drawn cat mascot, brush underlines, sparkles, arrows, and badge pills.
- Add pure deterministic timeline runtime in `lib/timeline.mjs` supporting camera cues, typing animations, number counters, and enter or exit transitions.
- Deduplicate CLI shims so `article-media` and `story-video` point cleanly to `nocapture`.

## 0.3.0

### Minor Changes

- Rename `@raquezha/article-media` to `@raquezha/nocapture` (`nocapture` CLI + `nocapture` Agent Skill) while keeping `article-media` and `story-video` as backwards-compatible `bin` aliases.
- Document alternatives (`OpenScreen`, `Screen Studio`, `shot-scraper`) and team distribution across Claude, ChatGPT, and coding agents.

## 0.2.1

### Patch Changes

- Clarify style-agnostic creative scope in `README.md` and `style-and-review.md`.

## 0.2.0

### Minor Changes

- Upgrade `@raquezha/story-video` to `@raquezha/article-media` with deterministic `image` (2x PNG with SHA-256 repeatability), `svg` (embedded WOFF2 font checks and Chrome preview), `video` (MP4 and GIF), and `batch` manifest workflows.
- Keep `story-video` CLI alias (`story-video render` forwards to `article-media video`).
- Add `examples/` (`terminal-zoom-typing.html`, `comparison-card.html`, `mobile-figma-canvas.html`), rendered `assets/` showcase media, and the updated `article-media` Agent Skill.

## 0.1.1

### Patch Changes

- 6ff04d2: Add the initial portable story-video package, deterministic cross-platform rendering CLI, and Agent Skill.
