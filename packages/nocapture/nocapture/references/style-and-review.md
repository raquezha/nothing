# Style and review defaults

`nocapture` is completely style agnostic: any local HTML, CSS, SVG, Canvas, or WebGL scene works, whether it is a brutalist poster, a 3D shader experiment, a data visualization, or an editorial card.

Separate universal craft (sections 1 to 4 below) from optional house style defaults (section 5).

## 1. Scene composition

- One claim per figure: Every scene answers a single question ("This shows X so the reader understands Y"). Split multi point comparisons into side by side panels (`Before` vs `After`) rather than crowding one frame.
- Real evidence over recreation: For past bugs, product UI, or historical states, compose real cropped screenshots inside clean HTML/CSS frames. Label any reconstructed state honestly.
- Mobile legibility: Never shrink dense desktop UI to fit mobile width; crop closer to the focal region or simplify the layout.

## 2. Doodles and annotations

- Ink consistency: Pair crisp UI captures with `#2a2a28` round cap hand-drawn SVG strokes (`stroke-linecap="round"`, `stroke-linejoin="round"`).
- Restraint: Use callouts, arrows, and highlights only where the eye needs guidance. Avoid decorative clutter.

## 3. Motion and video pacing

- Zoom framing: Compute CSS `transform-origin` from element bounds and target inset margins (for example, `48px` top and left) so zoomed views never leave dead gaps.
- Readable beats: Pause briefly before typing, type at a human readable cadence, show real progress and frame counters for CLI demos, and hold the final state long enough to read.
- Cursor accuracy: Measure real DOM button bounds for click rings instead of guessing coordinates.

## 4. Human review checklist

- Inspect a peak zoom still frame (or `--preview` keyframes) in macOS Preview before running full 24fps GIF or 60fps MP4 encodes.
- Watch the encoded clip at normal speed and verify playback, duration, dimensions, and zero decode errors.
- Treat smoothness and visual approval as human review; frame rate alone is not proof.
