// Pure functional timeline runtime for nocapture.
// Operates on any DOM document or root element.
// Deterministic: applyTimeline(root, seconds) produces identical DOM state for the same timestamp.

function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function applyTimeline(root, seconds) {
  const doc = root.ownerDocument || root;
  const elements = root.querySelectorAll ? root.querySelectorAll("[data-start], [data-camera-cues], [data-camera]") : [];

  for (const el of elements) {
    // 1. Camera interpolation
    const cameraCuesAttr = el.getAttribute("data-camera-cues");
    if (cameraCuesAttr) {
      try {
        const cues = JSON.parse(cameraCuesAttr);
        if (Array.isArray(cues) && cues.length > 0) {
          let s = cues[0].s ?? 1;
          let x = cues[0].x ?? 0;
          let y = cues[0].y ?? 0;

          if (seconds <= cues[0].t) {
            s = cues[0].s ?? 1;
            x = cues[0].x ?? 0;
            y = cues[0].y ?? 0;
          } else if (seconds >= cues[cues.length - 1].t) {
            const last = cues[cues.length - 1];
            s = last.s ?? 1;
            x = last.x ?? 0;
            y = last.y ?? 0;
          } else {
            for (let i = 0; i < cues.length - 1; i++) {
              const c1 = cues[i];
              const c2 = cues[i + 1];
              if (seconds >= c1.t && seconds <= c2.t) {
                const span = c2.t - c1.t;
                const rawProgress = span > 0 ? (seconds - c1.t) / span : 1;
                const p = smoothstep(rawProgress);
                s = (c1.s ?? 1) + ((c2.s ?? 1) - (c1.s ?? 1)) * p;
                x = (c1.x ?? 0) + ((c2.x ?? 0) - (c1.x ?? 0)) * p;
                y = (c1.y ?? 0) + ((c2.y ?? 0) - (c1.y ?? 0)) * p;
                break;
              }
            }
          }
          el.style.transform = `scale(${s.toFixed(4)}) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        }
      } catch {
        // invalid JSON ignored
      }
    }

    // 2. Timeline cues (data-start, data-duration)
    const startAttr = el.getAttribute("data-start");
    if (startAttr === null) continue;

    const start = parseFloat(startAttr) || 0;
    const hasDuration = el.hasAttribute("data-duration");
    const duration = hasDuration ? parseFloat(el.getAttribute("data-duration")) : Infinity;
    const persist = el.hasAttribute("data-persist");
    const end = start + duration;

    // Visibility window
    if (seconds < start) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      continue;
    }

    if (seconds > end && !persist) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      continue;
    }

    // Active or persisting
    el.style.pointerEvents = "auto";
    const activeSec = seconds - start;
    const enterDuration = Math.min(0.3, hasDuration ? duration / 2 : 0.3);
    const exitDuration = Math.min(0.3, hasDuration ? duration / 2 : 0.3);

    // Transitions: enter and exit
    const enterType = el.getAttribute("data-enter");
    const exitType = el.getAttribute("data-exit");

    let opacity = 1;
    let transform = "";

    if (enterType && activeSec < enterDuration && enterDuration > 0) {
      const p = smoothstep(activeSec / enterDuration);
      if (enterType === "fade") {
        opacity = p;
      } else if (enterType === "slide-up") {
        opacity = p;
        const translateY = (1 - p) * 16;
        transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`;
      } else if (enterType === "slide-down") {
        opacity = p;
        const translateY = (1 - p) * -16;
        transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`;
      } else if (enterType === "zoom") {
        opacity = p;
        const scale = 0.8 + 0.2 * p;
        transform = `scale(${scale.toFixed(4)})`;
      }
    } else if (exitType && hasDuration && !persist && seconds > end - exitDuration && exitDuration > 0) {
      const p = smoothstep((end - seconds) / exitDuration); // 1 at exit start, 0 at end
      if (exitType === "fade") {
        opacity = p;
      } else if (exitType === "slide-up") {
        opacity = p;
        const translateY = (1 - p) * -16;
        transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`;
      } else if (exitType === "slide-down") {
        opacity = p;
        const translateY = (1 - p) * 16;
        transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`;
      } else if (exitType === "zoom") {
        opacity = p;
        const scale = 0.8 + 0.2 * p;
        transform = `scale(${scale.toFixed(4)})`;
      }
    }

    el.style.opacity = opacity.toFixed(4);
    if (transform) {
      el.style.transform = transform;
    } else if (!cameraCuesAttr) {
      el.style.transform = "";
    }

    // 3. Typing effect: data-type="code or text to type"
    const textToType = el.getAttribute("data-type");
    if (textToType !== null) {
      const typeDuration = parseFloat(el.getAttribute("data-type-duration")) || (hasDuration ? duration : Math.max(0.5, textToType.length * 0.04));
      const typeProgress = clamp(activeSec / typeDuration, 0, 1);
      const charCount = Math.floor(typeProgress * textToType.length);
      const typed = textToType.slice(0, charCount);
      const isTyping = typeProgress < 1;
      const cursor = isTyping ? '<span class="nc-cursor" style="opacity:1;display:inline-block;animation:none;">▍</span>' : '';
      el.innerHTML = typed + cursor;
    }

    // 4. Number counter: data-count-to="100"
    const countToAttr = el.getAttribute("data-count-to");
    if (countToAttr !== null) {
      const targetNum = parseFloat(countToAttr) || 0;
      const startNum = parseFloat(el.getAttribute("data-count-from")) || 0;
      const countDuration = parseFloat(el.getAttribute("data-count-duration")) || (hasDuration ? duration : 1.0);
      const countProgress = smoothstep(activeSec / countDuration);
      const currentNum = startNum + (targetNum - startNum) * countProgress;
      const decimals = countToAttr.includes(".") ? countToAttr.split(".")[1].length : 0;
      el.textContent = currentNum.toFixed(decimals);
    }
  }
}

// Standalone inlined script string for plain-HTML templates
export const TIMELINE_INLINE_SCRIPT = `
function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}
function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
function applyTimeline(root, seconds) {
  const elements = root.querySelectorAll ? root.querySelectorAll("[data-start], [data-camera-cues], [data-camera]") : [];
  for (const el of elements) {
    const cameraCuesAttr = el.getAttribute("data-camera-cues");
    if (cameraCuesAttr) {
      try {
        const cues = JSON.parse(cameraCuesAttr);
        if (Array.isArray(cues) && cues.length > 0) {
          let s = cues[0].s ?? 1, x = cues[0].x ?? 0, y = cues[0].y ?? 0;
          if (seconds <= cues[0].t) {
            s = cues[0].s ?? 1; x = cues[0].x ?? 0; y = cues[0].y ?? 0;
          } else if (seconds >= cues[cues.length - 1].t) {
            const last = cues[cues.length - 1];
            s = last.s ?? 1; x = last.x ?? 0; y = last.y ?? 0;
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
          el.style.transform = "scale(" + s.toFixed(4) + ") translate3d(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px, 0)";
        }
      } catch {}
    }

    const startAttr = el.getAttribute("data-start");
    if (startAttr === null) continue;
    const start = parseFloat(startAttr) || 0;
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
    const enterDuration = Math.min(0.3, hasDuration ? duration / 2 : 0.3);
    const exitDuration = Math.min(0.3, hasDuration ? duration / 2 : 0.3);
    const enterType = el.getAttribute("data-enter");
    const exitType = el.getAttribute("data-exit");

    let opacity = 1;
    let transform = "";

    if (enterType && activeSec < enterDuration && enterDuration > 0) {
      const p = smoothstep(activeSec / enterDuration);
      if (enterType === "fade") opacity = p;
      else if (enterType === "slide-up") { opacity = p; transform = "translate3d(0, " + ((1 - p) * 16).toFixed(2) + "px, 0)"; }
      else if (enterType === "slide-down") { opacity = p; transform = "translate3d(0, " + ((1 - p) * -16).toFixed(2) + "px, 0)"; }
      else if (enterType === "zoom") { opacity = p; transform = "scale(" + (0.8 + 0.2 * p).toFixed(4) + ")"; }
    } else if (exitType && hasDuration && !persist && seconds > end - exitDuration && exitDuration > 0) {
      const p = smoothstep((end - seconds) / exitDuration);
      if (exitType === "fade") opacity = p;
      else if (exitType === "slide-up") { opacity = p; transform = "translate3d(0, " + ((1 - p) * -16).toFixed(2) + "px, 0)"; }
      else if (exitType === "slide-down") { opacity = p; transform = "translate3d(0, " + ((1 - p) * 16).toFixed(2) + "px, 0)"; }
      else if (exitType === "zoom") { opacity = p; transform = "scale(" + (0.8 + 0.2 * p).toFixed(4) + ")"; }
    }

    el.style.opacity = opacity.toFixed(4);
    if (transform) el.style.transform = transform;
    else if (!cameraCuesAttr) el.style.transform = "";

    const textToType = el.getAttribute("data-type");
    if (textToType !== null) {
      const typeDuration = parseFloat(el.getAttribute("data-type-duration")) || (hasDuration ? duration : Math.max(0.5, textToType.length * 0.04));
      const typeProgress = clamp(activeSec / typeDuration, 0, 1);
      const charCount = Math.floor(typeProgress * textToType.length);
      const isTyping = typeProgress < 1;
      el.innerHTML = textToType.slice(0, charCount) + (isTyping ? '<span class="nc-cursor" style="opacity:1;display:inline-block;">▍</span>' : '');
    }

    const countToAttr = el.getAttribute("data-count-to");
    if (countToAttr !== null) {
      const targetNum = parseFloat(countToAttr) || 0;
      const startNum = parseFloat(el.getAttribute("data-count-from")) || 0;
      const countDuration = parseFloat(el.getAttribute("data-count-duration")) || (hasDuration ? duration : 1.0);
      const countProgress = smoothstep(activeSec / countDuration);
      const currentNum = startNum + (targetNum - startNum) * countProgress;
      const decimals = countToAttr.includes(".") ? countToAttr.split(".")[1].length : 0;
      el.textContent = currentNum.toFixed(decimals);
    }
  }
}
window.renderAt = function(seconds) {
  applyTimeline(document.body, seconds);
};
`;
