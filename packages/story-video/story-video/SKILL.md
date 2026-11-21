---
name: story-video
description: Create and review deterministic local story videos with the story-video CLI. Use when a task needs a short article video, video preview, or render-quality review.
---

# Story Video

Use the shared CLI instead of copying a renderer or encoder into a project.

```bash
story-video --help
story-video render --scene scene.html --duration 12 --fps 60 --width 1280 --height 720 --output video.mp4
```

Keep scene assets local. Use `renderAt(seconds)` for deterministic scenes. Use `--preview` before full rendering. Inspect keyframes and the final encoded clip before approval.

macOS requires installed Google Chrome and Swift/AVFoundation. Linux requires system Chrome or Chromium plus `ffmpeg`, `ffprobe`, and `libx264`. Set `STORY_VIDEO_CHROME` to select a browser. The renderer does not use Playwright-cache FFmpeg or add `--no-sandbox`.

It fails without required dependencies and does not replace an existing export after a failed render.

See [style and review defaults](references/style-and-review.md) before approving a video.
