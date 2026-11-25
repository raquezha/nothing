import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatesDir = path.join(root, "templates");
const fontsCss = fs.readFileSync(path.join(templatesDir, "fonts.css"), "utf8");
const goodiesSvg = fs.readFileSync(path.join(templatesDir, "goodies.svg"), "utf8");

// Shared Timeline Runtime Script (Pure functional seekability)
const runtimeScript = `
function clamp(val, min = 0, max = 1) { return Math.max(min, Math.min(max, val)); }
function smoothstep(t) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
function applyTimeline(root, seconds) {
  const stage = root.querySelector("#stage");
  if (stage) {
    const cuesAttr = stage.getAttribute("data-camera-cues");
    if (cuesAttr) {
      try {
        const cues = JSON.parse(cuesAttr);
        if (Array.isArray(cues) && cues.length > 0) {
          let s = cues[0].s ?? 1, x = cues[0].x ?? 0, y = cues[0].y ?? 0;
          if (seconds <= cues[0].t) {
            s = cues[0].s ?? 1; x = cues[0].x ?? 0; y = cues[0].y ?? 0;
          } else if (seconds >= cues[cues.length - 1].t) {
            const last = cues[cues.length - 1];
            s = last.s ?? 1; x = last.y ?? 0; y = last.y ?? 0;
          } else {
            for (let i = 0; i < cues.length - 1; i++) {
              const c1 = cues[i], c2 = cues[i + 1];
              if (seconds >= c1.t && seconds <= c2.t) {
                const span = c2.t - c1.t;
                const p = smoothstep(span > 0 ? (seconds - c1.t) / span : 1);
                s = (c1.s ?? 1) + ((c2.s ?? 1) - (c1.s ?? 1)) * p;
                x = (c1.x ?? 0) + ((c2.x ?? 0) - (c1.x ?? 0)) * p;
                y = (c1.y ?? 0) + ((c2.y ?? 0) - (c1.y ?? 0)) * p;
                break;
              }
            }
          }
          stage.style.transform = "scale(" + s.toFixed(4) + ") translate3d(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px, 0)";
        }
      } catch {}
    }
  }

  const elements = root.querySelectorAll ? root.querySelectorAll("[data-start]") : [];
  for (const el of elements) {
    const start = parseFloat(el.getAttribute("data-start")) || 0;
    const hasDuration = el.hasAttribute("data-duration");
    const duration = hasDuration ? parseFloat(el.getAttribute("data-duration")) : Infinity;
    const persist = el.hasAttribute("data-persist");
    const end = start + duration;

    if (seconds < start || (seconds > end && !persist)) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      continue;
    }

    el.style.pointerEvents = "auto";
    const activeSec = seconds - start;
    const enterDuration = Math.min(0.35, hasDuration ? duration / 2 : 0.35);
    const enterType = el.getAttribute("data-enter");

    let opacity = 1;
    let transform = "";

    if (enterType && activeSec < enterDuration && enterDuration > 0) {
      const p = smoothstep(activeSec / enterDuration);
      opacity = p;
      if (enterType === "slide-up") transform = "translate3d(0, " + ((1 - p) * 16).toFixed(2) + "px, 0)";
      else if (enterType === "slide-down") transform = "translate3d(0, " + ((1 - p) * -16).toFixed(2) + "px, 0)";
      else if (enterType === "zoom") transform = "scale(" + (0.85 + 0.15 * p).toFixed(4) + ")";
    }

    el.style.opacity = opacity.toFixed(4);
    if (transform) el.style.transform = transform;
    else if (!el.hasAttribute("data-camera-cues")) el.style.transform = "";

    const textToType = el.getAttribute("data-type");
    if (textToType !== null) {
      const typeDuration = parseFloat(el.getAttribute("data-type-duration")) || (hasDuration ? duration : 1.5);
      const p = clamp(activeSec / typeDuration, 0, 1);
      const charCount = Math.floor(p * textToType.length);
      const isTyping = p < 1;
      el.textContent = textToType.slice(0, charCount);
      const cursor = el.nextElementSibling;
      if (cursor && cursor.classList.contains("nc-cursor")) {
        cursor.style.opacity = isTyping ? "1" : "0";
      }
    }
  }
}
window.renderAt = function(seconds) {
  applyTimeline(document.body, seconds);
};
`;

// 1. COMPARISON TEMPLATE (Editorial 3-tier layout, zero dead space)
const comparisonHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Comparison Template</title>
  <style>
    ${fontsCss}

    :root {
      --nc-bg: #fdfdfc;
      --nc-surface: #ffffff;
      --nc-dark-surface: #141414;
      --nc-ink: #2a2a28;
      --nc-muted: #727271;
      --nc-border: #dededb;
      --nc-coral: #f5cdbf;
      --nc-mint: #bde8cf;
      --nc-sky: #bfddf0;
      --nc-amber: #febc2e;
      --nc-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --nc-font-hand: "Caveat", cursive;
      --nc-font-mono: ui-monospace, "SF Mono", Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1200px;
      height: 675px;
      overflow: hidden;
      background: var(--nc-bg);
      font-family: var(--nc-font-sans);
      color: var(--nc-ink);
      -webkit-font-smoothing: antialiased;
    }

    #capture {
      width: 1200px;
      height: 675px;
      padding: 28px 44px;
      background-color: var(--nc-bg);
      background-image: radial-gradient(#d8d8d2 1px, transparent 1px);
      background-size: 18px 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    /* Top Grid Header */
    .header-row {
      display: grid;
      grid-template-columns: 1fr 100px 1fr;
      align-items: center;
      margin-bottom: 14px;
    }

    .badge-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pill-badge {
      display: inline-block;
      padding: 5px 16px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.02em;
      border: 1.5px solid var(--nc-ink);
      box-shadow: 2px 2px 0 var(--nc-ink);
    }
    .pill-badge.before { background: var(--nc-coral); }
    .pill-badge.after { background: var(--nc-mint); }

    .hand-caption {
      font-family: var(--nc-font-hand);
      font-size: 22px;
      color: var(--nc-muted);
      line-height: 1;
    }

    /* Comparison Columns */
    .grid-body {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 100px 1fr;
      align-items: stretch;
      gap: 0;
      position: relative;
    }

    .column {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
      position: relative;
    }

    .divider-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .divider-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 0;
      border-right: 1.5px dashed var(--nc-border);
    }

    /* Mini macOS window card */
    .window-card {
      background: var(--nc-surface);
      border: 1.4px solid var(--nc-ink);
      border-radius: 10px;
      box-shadow: 2px 3px 0 rgba(42, 42, 40, 0.1);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.2s ease;
    }

    .window-card.dark {
      background: var(--nc-dark-surface);
      border-color: #2e2e2c;
      color: #fdfdfc;
    }

    .chrome {
      height: 34px;
      padding: 0 12px;
      background: #f7f7f5;
      border-bottom: 1.2px solid var(--nc-border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dark .chrome {
      background: #1c1c1a;
      border-bottom-color: #2a2a28;
    }

    .dots { display: flex; gap: 6px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .dot.r { background: #ff5f57; }
    .dot.y { background: #febc2e; }
    .dot.g { background: #28c840; }

    .win-title {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--nc-ink);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .dark .win-title { color: #a8a8a3; }
    .win-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .win-status {
      margin-left: auto;
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .status-warn { background: #fee2e2; color: #991b1b; }
    .status-ok { background: #dcfce7; color: #166534; }
    .status-dim { background: #f4f4f1; color: #727271; }
    .dark .status-ok { background: #1f3a2c; color: #4ade80; }

    .card-content {
      padding: 13px 16px;
      font-family: var(--nc-font-mono);
      font-size: 13px;
      line-height: 1.55;
      color: var(--nc-ink);
      white-space: pre-wrap;
    }
    .dark .card-content {
      color: #e8e8e3;
    }

    /* Hand annotations (outside overflow:hidden so they never clip!) */
    .hand-note {
      position: absolute;
      font-family: var(--nc-font-hand);
      font-size: 21px;
      color: #9a5b4a;
      pointer-events: none;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .middle-badge {
      z-index: 5;
      background: var(--nc-surface);
      border: 1.4px solid var(--nc-ink);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 2px 2px 0 var(--nc-ink);
    }

    .bottom-bar {
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--nc-font-hand);
      font-size: 21px;
      color: var(--nc-muted);
    }
    .shapes-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  </style>
</head>
<body>
  ${goodiesSvg}

  <div id="capture">
    <!-- Header row -->
    <div class="header-row">
      <div class="badge-wrap" data-start="0" data-persist>
        <span class="pill-badge before">Before</span>
        <span class="hand-caption">weekly copy paste hell</span>
        <svg width="24" height="24" viewBox="0 0 24 24"><use href="#nc-spiral"/></svg>
      </div>
      <div></div>
      <div class="badge-wrap" data-start="0" data-persist>
        <span class="pill-badge after">After</span>
        <span class="hand-caption">company email & wiki, boom</span>
        <svg width="24" height="24" viewBox="0 0 24 24"><use href="#nc-sparkle"/></svg>
      </div>
    </div>

    <!-- Main comparison grid with 3 balanced tiers -->
    <div class="grid-body">
      <!-- Unclipped hand-drawn annotation pointing to Laptop card -->
      <div class="hand-note" style="top: 6px; left: 370px; transform: rotate(3deg);" data-start="0.3" data-persist>
        <span>where is the doc?!</span>
        <svg width="32" height="20" viewBox="0 0 84 34"><use href="#nc-arrow"/></svg>
      </div>

      <!-- Left: Before stack (3 tiers) -->
      <div class="column">
        <!-- Card 1: Laptop -->
        <div class="window-card" style="transform: rotate(-1deg);" data-start="0.1" data-enter="slide-up" data-persist>
          <div class="chrome">
            <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
            <span class="win-title">
              <svg class="win-logo" width="14" height="14" viewBox="0 0 24 24"><use href="#nc-logo-laptop"/></svg>
              My Laptop — ~/docs
            </span>
            <span class="win-status status-warn">forgot to share</span>
          </div>
          <div class="card-content">meeting-notes-final.md              local only
deck-sprint-review.pdf              out of date</div>
        </div>

        <!-- Card 2: Telegram Ping Pong -->
        <div class="window-card" style="transform: rotate(1deg);" data-start="0.3" data-enter="slide-up" data-persist>
          <div class="chrome">
            <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
            <span class="win-title">
              <svg class="win-logo" width="14" height="14" viewBox="0 0 24 24"><use href="#nc-logo-telegram"/></svg>
              Telegram Ping Pong
            </span>
            <span class="win-status status-warn">stale copy</span>
          </div>
          <div class="card-content">"hey can you resend last week's notes?"
notes_v3_final.docx · sop.md · deck.pdf</div>
        </div>

        <!-- Card 3: GitLab + MS Loop -->
        <div class="window-card" style="transform: rotate(-0.5deg);" data-start="0.5" data-enter="slide-up" data-persist>
          <div class="chrome">
            <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
            <span class="win-title">
              <svg class="win-logo" width="14" height="14" viewBox="0 0 24 24"><use href="#nc-logo-gitlab"/></svg>
              GitLab + MS Loop
            </span>
            <span class="win-status status-dim">out of date</span>
          </div>
          <div class="card-content">stale repo docs, clunky UX
permissions fragmented across 4 logins</div>
        </div>
      </div>

      <!-- Center divider & middle badge with connecting arrows -->
      <div class="divider-col">
        <div class="divider-line"></div>
        <div data-start="0.4" data-persist style="z-index:3; margin-bottom: 24px;">
          <svg width="44" height="24" viewBox="0 0 84 34"><use href="#nc-arrow"/></svg>
        </div>
        <div class="middle-badge" data-start="0.6" data-enter="zoom" data-persist>
          <svg width="15" height="15" viewBox="0 0 24 24"><use href="#nc-logo-docker"/></svg>
          <span>docker up</span>
        </div>
        <div data-start="0.8" data-persist style="z-index:3; margin-top: 24px;">
          <svg width="44" height="24" viewBox="0 0 84 34" style="transform: rotate(180deg) scaleX(-1);"><use href="#nc-arrow"/></svg>
        </div>
      </div>

      <!-- Right: After stack (3 tiers) -->
      <div class="column">
        <!-- Card 1: Outlook / SSO -->
        <div class="window-card" style="transform: rotate(0.8deg);" data-start="0.2" data-enter="slide-up" data-persist>
          <div class="chrome">
            <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
            <span class="win-title">
              <svg class="win-logo" width="14" height="14" viewBox="0 0 24 24"><use href="#nc-logo-mail"/></svg>
              Outlook — Company Email
            </span>
            <span class="win-status status-ok">GitLab SSO</span>
          </div>
          <div class="card-content">OIDC SSO: you@company.com
Zero new passwords · One click access</div>
        </div>

        <!-- Card 2: Outline Wiki Hub -->
        <div class="window-card" style="transform: rotate(-0.8deg);" data-start="0.4" data-enter="slide-up" data-persist>
          <div class="chrome">
            <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
            <span class="win-title">
              <svg class="win-logo" width="14" height="14" viewBox="0 0 24 24"><use href="#nc-logo-outline"/></svg>
              Outline Wiki — docs.company.internal
            </span>
            <span class="win-status status-ok">synced</span>
          </div>
          <div class="card-content"># 2026-11-25 Weekly Meeting
Android · Cloud · iOS · QA
own server · team permissions · local disk</div>
        </div>

        <!-- Card 3: Claude & ChatGPT MCP Client (High-contrast obsidian card) -->
        <div class="window-card dark" style="transform: rotate(1.2deg);" data-start="0.6" data-enter="slide-up" data-persist>
          <div class="chrome">
            <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
            <span class="win-title">
              <svg class="win-logo" width="14" height="14" viewBox="0 0 24 24"><use href="#nc-logo-claude"/></svg>
              Claude &amp; ChatGPT — MCP Client
            </span>
            <span class="win-status status-ok">MCP API</span>
          </div>
          <div class="card-content">&gt; outline.update_doc("weekly-2026-11-25")
✓ Verified deterministic SHA-256 output</div>
        </div>
      </div>
    </div>

    <!-- Bottom footer with doodles -->
    <div class="bottom-bar">
      <div class="shapes-row">
        <svg width="22" height="22" viewBox="0 0 24 24"><use href="#nc-coffee"/></svg>
        <span>docs scattered everywhere</span>
        <svg width="22" height="22" viewBox="0 0 24 24"><use href="#nc-heart"/></svg>
        <svg width="22" height="22" viewBox="0 0 24 24"><use href="#nc-diamond"/></svg>
        <svg width="22" height="22" viewBox="0 0 24 24"><use href="#nc-circle"/></svg>
      </div>

      <div class="shapes-row">
        <span>try it!</span>
        <svg width="26" height="22" viewBox="0 0 26 24"><use href="#nc-cat"/></svg>
      </div>
    </div>
  </div>

  <script>
    ${runtimeScript}
  </script>
</body>
</html>
`;

// 2. MOBILE TEMPLATE
const mobileHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Mobile Template</title>
  <style>
    ${fontsCss}

    :root {
      --nc-bg: #ececea;
      --nc-window-bg: #f5f5f3;
      --nc-surface: #ffffff;
      --nc-ink: #2a2a28;
      --nc-muted: #73736f;
      --nc-border: #dededb;
      --nc-accent: #0d99ff;
      --nc-mint: #bde8cf;
      --nc-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --nc-font-hand: "Caveat", cursive;
      --nc-font-mono: ui-monospace, "SF Mono", Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1200px;
      height: 675px;
      overflow: hidden;
      background: var(--nc-bg);
      font-family: var(--nc-font-sans);
      color: var(--nc-ink);
      -webkit-font-smoothing: antialiased;
    }

    #capture {
      width: 1200px;
      height: 675px;
      padding: 32px;
      background: var(--nc-bg);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .window {
      width: 100%;
      height: 100%;
      background: var(--nc-window-bg);
      border: 1.5px solid var(--nc-border);
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(42, 42, 40, 0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .chrome {
      height: 44px;
      padding: 0 18px;
      background: var(--nc-surface);
      border-bottom: 1px solid var(--nc-border);
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 0 0 auto;
    }
    .dots { display: flex; gap: 8px; }
    .dot { width: 11px; height: 11px; border-radius: 50%; }
    .red { background: #ff5f57; }
    .yellow { background: #febc2e; }
    .green { background: #28c840; }
    .win-title { font-size: 13px; font-weight: 600; }
    .win-meta { margin-left: auto; font-size: 12px; color: var(--nc-muted); }

    .workspace {
      flex: 1 1 auto;
      display: grid;
      grid-template-columns: 220px 1fr 250px;
      min-height: 0;
    }

    .sidebar, .inspector {
      background: var(--nc-surface);
      padding: 16px 14px;
      font-size: 12px;
    }
    .sidebar { border-right: 1px solid var(--nc-border); }
    .inspector { border-left: 1px solid var(--nc-border); }

    .panel-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--nc-muted);
      margin-bottom: 10px;
    }

    .tree-item {
      padding: 6px 8px;
      border-radius: 6px;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--nc-ink);
    }
    .tree-item.active {
      background: #e8f4ff;
      color: #0969da;
      font-weight: 600;
    }

    .canvas {
      position: relative;
      background-color: #f3f3f0;
      background-image: radial-gradient(#d8d8d2 1px, transparent 1px);
      background-size: 16px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .frame-tag {
      position: absolute;
      top: 24px;
      left: 170px;
      font-size: 11px;
      font-weight: 600;
      color: var(--nc-accent);
      font-family: var(--nc-font-hand);
      font-size: 18px;
    }

    .phone {
      width: 266px;
      background: #fdfdfc;
      border: 2px solid var(--nc-accent);
      border-radius: 26px;
      padding: 14px;
      box-shadow: 0 14px 36px rgba(42, 42, 40, 0.1);
      position: relative;
    }
    .handle {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #ffffff;
      border: 1.5px solid var(--nc-accent);
    }
    .h-tl { top: -5px; left: -5px; }
    .h-tr { top: -5px; right: -5px; }
    .h-bl { bottom: -5px; left: -5px; }
    .h-br { bottom: -5px; right: -5px; }

    .status-bar {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 14px;
      padding: 0 4px;
    }
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .app-title { font-size: 17px; font-weight: 700; }
    .badge {
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--nc-mint);
      color: #1f4d34;
    }

    .metric-card {
      background: #ffffff;
      border: 1px solid #e6e6e2;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .metric-card.selected {
      outline: 1.5px solid var(--nc-accent);
      outline-offset: 2px;
    }
    .m-label { font-size: 11px; color: var(--nc-muted); margin-bottom: 4px; }
    .m-value { font-size: 18px; font-weight: 700; }
    .m-bar {
      margin-top: 8px;
      height: 6px;
      border-radius: 999px;
      background: #ececea;
      overflow: hidden;
    }
    .m-fill { height: 100%; width: 78%; background: var(--nc-accent); border-radius: 999px; }

    .btn {
      margin-top: 8px;
      width: 100%;
      padding: 10px;
      border-radius: 10px;
      background: var(--nc-ink);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
    }

    .spec-pill {
      position: absolute;
      right: 50px;
      top: 220px;
      background: var(--nc-accent);
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
    }

    .token-row {
      padding: 8px 10px;
      border: 1px solid #ececea;
      border-radius: 8px;
      margin-bottom: 8px;
      background: #fdfdfc;
    }
    .token-name { font-family: var(--nc-font-mono); font-size: 11px; font-weight: 600; }
    .token-val { font-size: 11px; color: var(--nc-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
    .swatch { width: 10px; height: 10px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.15); display: inline-block; }

    .hand-annotation {
      position: absolute;
      bottom: 24px;
      left: 24px;
      font-family: var(--nc-font-hand);
      font-size: 20px;
      color: var(--nc-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }
  </style>
</head>
<body>
  ${goodiesSvg}

  <div id="capture">
    <section class="window" aria-label="Mobile Frame Template">
      <header class="chrome">
        <span class="dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></span>
        <svg width="14" height="20" viewBox="0 0 38 57" fill="none" aria-hidden="true">
          <path d="M19 28.5A9.5 9.5 0 1 1 28.5 19 9.5 9.5 0 0 1 19 28.5Z" fill="#1ABCFE"/>
          <path d="M9.5 47.5A9.5 9.5 0 0 1 19 38v9.5a9.5 9.5 0 0 1-9.5 0Z" fill="#0ACF83"/>
          <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262"/>
          <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E"/>
          <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF"/>
        </svg>
        <span class="win-title">Figma: Spaces / Mobile Screens</span>
        <span class="win-meta">390 x 844 · Tokenized</span>
      </header>

      <div class="workspace">
        <aside class="sidebar" data-start="0" data-persist>
          <div class="panel-label">Layers</div>
          <div class="tree-item"><span>StatusBar</span><span>390x44</span></div>
          <div class="tree-item"><span>Header / Title</span><span>auto</span></div>
          <div class="tree-item active"><span>Card / WeeklySync</span><span>selected</span></div>
          <div class="tree-item"><span>Card / TokenParity</span><span>24/24</span></div>
          <div class="tree-item"><span>Button / Primary</span><span>44px</span></div>
        </aside>

        <div class="canvas">
          <span class="frame-tag" data-start="0" data-persist>Spaces · Mobile (390px)</span>

          <div class="phone" data-start="0.1" data-enter="zoom" data-persist>
            <span class="handle h-tl"></span><span class="handle h-tr"></span>
            <span class="handle h-bl"></span><span class="handle h-br"></span>
            <div class="status-bar"><span>9:41</span><span>5G 100%</span></div>
            <div class="app-header">
              <span class="app-title">Spaces</span>
              <span class="badge">Synced</span>
            </div>
            <div class="metric-card selected">
              <div class="m-label">Weekly Report</div>
              <div class="m-value">19 Screens</div>
              <div class="m-bar"><div class="m-fill"></div></div>
            </div>
            <div class="metric-card">
              <div class="m-label">Design Tokens</div>
              <div class="m-value">146 Bound</div>
            </div>
            <div class="btn">Export to Compose + SwiftUI</div>
          </div>

          <span class="spec-pill" data-start="0.4" data-enter="slide-up" data-persist>pad 12px · r 12px</span>

          <div class="hand-annotation" data-start="0.6" data-persist>
            <span>tight mobile viewport</span>
            <svg width="24" height="24" viewBox="0 0 26 24"><use href="#nc-cat"/></svg>
          </div>
        </div>

        <aside class="inspector" data-start="0" data-persist>
          <div class="panel-label">Bound Tokens</div>
          <div class="token-row">
            <div class="token-name">surface/background</div>
            <div class="token-val"><span class="swatch" style="background:#fdfdfc;"></span>#FDFDFC</div>
          </div>
          <div class="token-row">
            <div class="token-name">content/primary</div>
            <div class="token-val"><span class="swatch" style="background:#2a2a28;"></span>#2A2A28</div>
          </div>
          <div class="token-row">
            <div class="token-name">accent/selection</div>
            <div class="token-val"><span class="swatch" style="background:#0d99ff;"></span>#0D99FF</div>
          </div>
          <div class="token-row">
            <div class="token-name">layout/radius/card</div>
            <div class="token-val">12px (bound)</div>
          </div>
        </aside>
      </div>
    </section>
  </div>

  <script>
    ${runtimeScript}
  </script>
</body>
</html>
`;

// 3. TERMINAL TEMPLATE
const terminalHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Terminal Template</title>
  <style>
    ${fontsCss}

    :root {
      --nc-bg: #ececea;
      --nc-term-bg: #141414;
      --nc-chrome-bg: #1c1c1a;
      --nc-border: #2a2a28;
      --nc-text: #e8e8e3;
      --nc-muted: #8c8c86;
      --nc-green: #28c840;
      --nc-mint: #bde8cf;
      --nc-accent: #bfddf0;
      --nc-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --nc-font-hand: "Caveat", cursive;
      --nc-font-mono: ui-monospace, "SF Mono", Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1280px;
      height: 720px;
      overflow: hidden;
      background: var(--nc-bg);
      font-family: var(--nc-font-sans);
      color: var(--nc-text);
      -webkit-font-smoothing: antialiased;
    }

    #capture {
      width: 1280px;
      height: 720px;
      padding: 56px 72px;
      background: var(--nc-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .stage {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
    }

    .window {
      width: 920px;
      background: var(--nc-term-bg);
      border: 1.5px solid var(--nc-border);
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(20, 20, 18, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .chrome {
      height: 44px;
      padding: 0 18px;
      background: var(--nc-chrome-bg);
      border-bottom: 1px solid var(--nc-border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .dots { display: flex; gap: 8px; }
    .dot { width: 11px; height: 11px; border-radius: 50%; }
    .dot.r { background: #ff5f57; }
    .dot.y { background: #febc2e; }
    .dot.g { background: #28c840; }

    .win-title {
      font-size: 13px;
      color: var(--nc-muted);
      font-weight: 500;
    }

    .tabs {
      margin-left: auto;
      display: flex;
      gap: 6px;
    }
    .tab {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--nc-muted);
      border: 1px solid transparent;
    }
    .tab.active {
      background: #1f2d3d;
      color: #bfddf0;
      border-color: #2e4863;
    }

    .term-body {
      padding: 36px 40px;
      font-family: var(--nc-font-mono);
      font-size: 18px;
      line-height: 1.85;
      min-height: 340px;
    }

    .line { white-space: pre; min-height: 34px; display: flex; align-items: center; }
    .prompt { color: var(--nc-green); font-weight: 600; margin-right: 8px; }
    .cmd { color: #fdfdfc; }
    .nc-cursor {
      display: inline-block;
      width: 10px;
      height: 20px;
      background: #fdfdfc;
      vertical-align: -3px;
      margin-left: 2px;
    }
    .meta-line { color: var(--nc-muted); font-size: 16px; }
    .progress-line { color: var(--nc-mint); font-size: 16px; }
    .ok { color: var(--nc-mint); }
    .accent { color: var(--nc-accent); }

    .corner-doodle {
      position: absolute;
      top: 36px;
      right: 56px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--nc-font-hand);
      font-size: 22px;
      color: #727271;
    }
  </style>
</head>
<body>
  ${goodiesSvg}

  <div id="capture">
    <div class="corner-doodle" data-start="0" data-persist>
      <span>deterministic video frame</span>
      <svg width="28" height="24" viewBox="0 0 26 24"><use href="#nc-cat"/></svg>
    </div>

    <div id="stage" class="stage" data-camera-cues='[{"t":0,"s":1,"x":0,"y":0},{"t":1.5,"s":1.12,"x":-30,"y":-15}]'>
      <div class="window">
        <header class="chrome">
          <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
          <span class="win-title">zsh — nocapture</span>
          <div class="tabs">
            <span class="tab active">1. CLI</span>
            <span class="tab">2. Figma UI</span>
            <span class="tab">3. Outputs</span>
          </div>
        </header>

        <div class="term-body">
          <!-- Command Prompt line with static text for image mode -->
          <div class="line" data-start="0" data-persist>
            <span class="prompt">raquezha@macmini:~/site$</span>
            <span class="cmd" data-start="0.3" data-type="nocapture batch -m media.json" data-type-duration="1.6" data-persist>nocapture batch -m media.json</span><span class="nc-cursor"></span>
          </div>

          <div class="line meta-line" data-start="2.1" data-enter="fade" data-persist>Rendering 240 frames @24fps (10.0s) — batch media.json</div>

          <div class="line progress-line" data-start="2.4" data-enter="fade" data-persist>  100%  240/240 [████████████████████████] 1.8s</div>

          <div class="line ok" data-start="2.8" data-enter="fade" data-persist>  ✓ figma-mobile.png (2400x1350 · 0.4s)</div>
          <div class="line accent" data-start="3.0" data-enter="fade" data-persist>  ✓ flow.svg (Caveat + Inter WOFF2 · 0.1s)</div>
          <div class="line ok" data-start="3.2" data-enter="fade" data-persist>  ✓ showcase.mp4 + showcase.gif (240/240 · 1.8s)</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    ${runtimeScript}
  </script>
</body>
</html>
`;

// 4. TUTORIAL TEMPLATE
const tutorialHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tutorial Template</title>
  <style>
    ${fontsCss}

    :root {
      --nc-bg: #ececea;
      --nc-surface: #ffffff;
      --nc-ink: #2a2a28;
      --nc-muted: #73736f;
      --nc-border: #dededb;
      --nc-accent: #0d99ff;
      --nc-sticky-bg: #fef08a;
      --nc-sticky-ink: #713f12;
      --nc-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --nc-font-hand: "Caveat", cursive;
      --nc-font-mono: ui-monospace, "SF Mono", Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1280px;
      height: 720px;
      overflow: hidden;
      background: var(--nc-bg);
      font-family: var(--nc-font-sans);
      color: var(--nc-ink);
      -webkit-font-smoothing: antialiased;
    }

    #capture {
      width: 1280px;
      height: 720px;
      padding: 48px 64px;
      background: var(--nc-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .stage {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transform-origin: center center;
    }

    .window {
      width: 1040px;
      background: var(--nc-surface);
      border: 1.5px solid var(--nc-border);
      border-radius: 14px;
      box-shadow: 0 18px 40px rgba(20, 20, 18, 0.12);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .chrome {
      height: 44px;
      padding: 0 18px;
      background: #f7f7f5;
      border-bottom: 1px solid var(--nc-border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .dots { display: flex; gap: 8px; }
    .dot { width: 11px; height: 11px; border-radius: 50%; }
    .dot.r { background: #ff5f57; }
    .dot.y { background: #febc2e; }
    .dot.g { background: #28c840; }

    .win-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--nc-ink);
    }

    .tabs {
      margin-left: auto;
      display: flex;
      gap: 6px;
    }
    .tab {
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--nc-muted);
      border: 1px solid transparent;
    }
    .tab.active {
      background: #e8f4ff;
      color: #0969da;
      border-color: #bfddf0;
    }

    .tutorial-body {
      padding: 32px 36px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .step-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .step-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      background: #bfddf0;
      color: #1a4971;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .step-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--nc-ink);
    }

    .code-box {
      background: #141414;
      color: #fdfdfc;
      border-radius: 10px;
      padding: 20px 24px;
      font-family: var(--nc-font-mono);
      font-size: 15px;
      line-height: 1.7;
      white-space: pre;
    }
    .code-box .kw { color: #f5cdbf; font-weight: 600; }
    .code-box .str { color: #bde8cf; }
    .code-box .cmt { color: #8c8c86; font-style: italic; }

    /* Hand-drawn sticky callout */
    .sticky-callout {
      position: absolute;
      right: 48px;
      bottom: 24px;
      background: var(--nc-sticky-bg);
      color: var(--nc-sticky-ink);
      border: 1.5px solid rgba(42, 42, 40, 0.2);
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 2px 6px 16px rgba(0, 0, 0, 0.08);
      font-family: var(--nc-font-hand);
      font-size: 22px;
      line-height: 1.3;
      transform: rotate(-2deg);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 10;
    }
  </style>
</head>
<body>
  ${goodiesSvg}

  <div id="capture">
    <div id="stage" class="stage" data-camera-cues='[{"t":0,"s":1,"x":0,"y":0},{"t":1.5,"s":1.08,"x":-20,"y":-10}]'>
      <div class="window">
        <header class="chrome">
          <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
          <span class="win-title">Tutorial — nocapture walkthrough</span>
          <div class="tabs">
            <span class="tab active">Step 1: Scaffold</span>
            <span class="tab">Step 2: Edit Scene</span>
            <span class="tab">Step 3: Render</span>
          </div>
        </header>

        <div class="tutorial-body">
          <div class="step-header">
            <h2 class="step-title">Scaffold with nocapture</h2>
            <span class="step-badge">Step 1 of 3</span>
          </div>

          <div class="code-box" data-start="0.2" data-persist>
<span class="cmt">// 1. Scaffold from editorial templates</span>
$ <span class="kw">nocapture</span> init <span class="str">--template comparison</span> <span class="str">--output scene.html</span>
<span class="cmt">// 2. Render deterministic 2x retina PNG</span>
$ <span class="kw">nocapture</span> image <span class="str">--scene scene.html</span> <span class="str">--width 1200</span> <span class="str">--height 675</span> <span class="str">--output card.png</span>
<span class="cmt">✓ SHA-256 verified identical across runs</span></div>
        </div>

        <div class="sticky-callout" data-start="0.8" data-enter="zoom" data-persist>
          <span>Zero configuration · Pure code media!</span>
          <svg width="24" height="24" viewBox="0 0 24 24"><use href="#nc-sparkle"/></svg>
        </div>
      </div>
    </div>
  </div>

  <script>
    ${runtimeScript}
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(templatesDir, "comparison.html"), comparisonHtml, "utf8");
fs.writeFileSync(path.join(templatesDir, "mobile.html"), mobileHtml, "utf8");
fs.writeFileSync(path.join(templatesDir, "terminal.html"), terminalHtml, "utf8");
fs.writeFileSync(path.join(templatesDir, "tutorial.html"), tutorialHtml, "utf8");
console.log("Rebuilt all 4 templates with 3-tier balanced layout successfully!");
