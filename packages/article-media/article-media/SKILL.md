---
name: article-media
description: Create, validate, and review deterministic local article media (PNG, SVG, MP4) with the article-media CLI. Use whenever an article needs a diagram, comparison image, video loop, or media verification.
---

# Article Media

Use the shared `@raquezha/article-media` CLI instead of writing one-off capture or encoding scripts inside a project.

```bash
article-media --help
article-media image --scene scene.html --width 1200 --height 675 --output out.png
article-media svg --input diagram.svg --check --preview preview.png
article-media video --scene scene.html --duration 5.5 --fps 60 --width 1280 --height 720 --output out.mp4 --preview
article-media batch --manifest media.json
```

## 5-Step Repeatable Workflow

1. **Brief and format pick:** Write a one-sentence claim ("This shows X so the reader understands Y"). Pick **SVG** for diagrams and inline doodles, **PNG** (`image`) for comparisons and annotated UI captures, and **MP4 / GIF** (`video`) for state loops. Never fabricate a historical product screenshot from memory.
2. **Self-contained scene:** Use local assets and local fonts only. PNG scenes require a fixed-size `#capture` element; video scenes require `window.renderAt(seconds)`; diagram SVGs using `Caveat` or `Inter` require explicit `viewBox`/`width`/`height` and base64 WOFF2 `@font-face` rules for every used weight.
3. **Deterministic render:** Run `article-media` so Chromium blocks external network calls, waits for `document.fonts.ready`, flushes `requestAnimationFrame`, and verifies SHA-256 repeatability (`image`) or dimension/frame integrity (`video`).
4. **Visual proof:** Always open rendered PNGs (and `--preview` keyframes) in macOS Preview (`open <abs-path>`) to inspect legibility and alignment with human eyes. Never approve from terminal output alone.
5. **Publish and mirror:** Copy published assets to `public/` (or `public/images/` with explicit `!public/images/<asset>` in `.gitignore`) and mirror byte-identically to the matching Obsidian `assets/` folder.

## Video & Zoom Scene Rules

- **Compute zoom origin from target margins:** Derive CSS `transform-origin` from the element bounds and desired inset margins (for example, `48px` top and left) so zoomed frames avoid awkward top/left gaps or empty bottom space.
- **Check a peak-zoom still frame first:** Inspect a single frame at the maximum zoom timestamp (or run `--preview`) in macOS Preview before committing to a full 24fps GIF or 60fps MP4 encode.
- **Pace typing and progress:** Hold a brief pause before typing begins, type at a readable speed, and render live progress indicators (percentage and frame counts) when demonstrating CLI or render workflows.
- **Measure click targets:** Compute cursor click coordinates from real DOM element bounds rather than hardcoded guesses.

## Platform Requirements

macOS requires Google Chrome and Swift/AVFoundation. Linux requires system Chrome or Chromium plus `ffmpeg` (`libx264`) and `ffprobe`. Set `ARTICLE_MEDIA_CHROME` to select a browser. Failed renders never overwrite an existing export.
