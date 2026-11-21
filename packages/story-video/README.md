# @raquezha/story-video

Local-first tooling for deterministic article-video rendering and review.

```bash
story-video render --scene scene.html --duration 12 --fps 60 --width 1280 --height 720 --output video.mp4
story-video render --scene scene.html --duration 12 --fps 60 --width 1280 --height 720 --output video.mp4 --preview
```

Scenes must expose `window.renderAt(seconds)` and use local assets only. `--preview` writes beginning, middle, and final keyframes to `video.mp4.preview`.

macOS is the only tested platform today. It requires installed Google Chrome and Swift/AVFoundation. Linux support is implemented but remains unverified until it passes the Linux machine-proof slice. Linux requires a system Chrome or Chromium executable and `ffmpeg` with `libx264`. Set `STORY_VIDEO_CHROME` to select a browser explicitly. The CLI never uses a Playwright-cache FFmpeg binary or adds `--no-sandbox`.

The full renderer writes frames and an MP4 into an isolated sibling directory. It replaces the requested output only after encoding succeeds.

For direct local skill loading, pass `packages/story-video/story-video` to your agent's skill option.
