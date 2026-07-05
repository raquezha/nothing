# notrace template fixtures

Source of truth for notrace HTML review.

Files:
- `dashboard.sample.json` -> mock data for `.notrace/index.html`
- `session.sample.json` -> base mock data for `.notrace/sessions/<id>/notrace.html`
- `dashboard.sample.html` -> rendered dashboard preview
- `session.sample.html` -> standalone rendered session preview
- `sessions/<id>/notrace.html` -> clone-safe session pages linked from dashboard preview
- `render-samples.mjs` -> rebuild previews from renderer
- `notrace-logo.preview.png` -> rendered logo inspection screenshot

Workflow:
1. Edit `extensions/notrace/renderer.ts`
2. Run `npm run render:samples` in `packages/notrace`
3. Open sample HTML files and comment on visual/result changes
4. Use `notrace-logo.preview.png` to inspect current combined logo lockup quickly

Rule:
- If renderer changes, refresh sample HTML in same change.
- Dashboard preview links must resolve inside cloned repo with no local runtime state.
- Sample JSON should stay stable unless new UI state needs coverage.
- Quick-look hover panels are intentionally deferred; homepage remains scan-first plus one-click open.
