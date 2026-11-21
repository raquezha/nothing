# @raquezha/story-video

Local-first tooling for deterministic article-video rendering and review.

```bash
story-video render --scene scene.html --duration 12 --fps 60 --width 1280 --height 720 --output video.mp4
story-video render --scene scene.html --duration 12 --fps 60 --width 1280 --height 720 --output video.mp4 --preview
```

Scenes must expose `window.renderAt(seconds)` and use local assets only. The package uses installed Google Chrome and macOS Swift/AVFoundation. `--preview` writes beginning, middle, and final keyframes to `video.mp4.preview`.

The full renderer writes frames and an MP4 into an isolated sibling directory. It replaces the requested output only after encoding succeeds.

For direct local skill loading, pass `packages/story-video/story-video` to your agent's skill option.
