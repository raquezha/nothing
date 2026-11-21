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

The renderer uses installed Google Chrome and macOS Swift/AVFoundation. It fails without either dependency and does not replace an existing export after a failed render.
