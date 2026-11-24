# @raquezha/article-media

## 0.2.0

### Minor Changes

- Upgrade `@raquezha/story-video` to `@raquezha/article-media` with deterministic `image` (2x PNG with SHA-256 repeatability), `svg` (embedded WOFF2 font checks and Chrome preview), `video` (MP4 and GIF), and `batch` manifest workflows.
- Keep `story-video` CLI alias (`story-video render` forwards to `article-media video`).
- Add `examples/` (`terminal-zoom-typing.html`, `comparison-card.html`, `mobile-figma-canvas.html`), rendered `assets/` showcase media, and the updated `article-media` Agent Skill.

## 0.1.1

### Patch Changes

- 6ff04d2: Add the initial portable story-video package, deterministic cross-platform rendering CLI, and Agent Skill.
