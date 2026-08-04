// Linear pack for the Omarchy web-app theming engine.
//
// Two layers:
//   1) cssVars — Linear's semantic tokens (--bg-*, --color-bg-*, --color-text-*,
//      --focus-*, editor/diff helpers) plus a DYNAMIC remap of StyleX atomic
//      surface vars (--sx-*). Linear paints most chrome via
//      background: var(--sx-…) with hashed slots holding baked greys, not the
//      semantic tokens. Each slot is classified by USAGE (which CSS property
//      consumes it — see linearSxRoles), then bucketed within its role into
//      the omarchy elevation/text ladders.
//   2) apply — structural !important backgrounds for places StyleX does not
//      reach: styled-components rules that hardcode lch() on <main>, headers,
//      and [data-scroll-container] review panes. Also pins html.light /
//      html.dark on EVERY apply (not only light↔dark crossings) — the engine
//      can mark the mode before this pack registers, which would skip
//      onColorMode and leave Linear on the wrong class (both classes at once
//      → white dark-mode text on light backgrounds).
//
// REQUIRED SETUP: Linear's interface theme must be "System preference"
// (Ctrl+K → "Change interface theme" → System preference). The setting is PER
// DEVICE and rehydrated from Linear's client database — flipping the
// `darkMode` localStorage key does not stick. With a pinned Light/Dark theme,
// Linear renders the opposite mode's styles as hardcoded lch() colors that no
// variable override can reach (the classic symptom: white text on a light
// omarchy theme). On System preference, the MAIN-world shim drives Linear's
// own light/dark natively and this pack only recolors.
//
// Token / behavior verified via Playwright against the live logged-in app
// (2026-08-04: shell + review/ticket views; light-mode fixed same day by
// usage-based slot classification + the System-preference requirement).

// Resolve any CSS color to {r,g,b}. Returns null for non-colors (lengths, fonts,
// shorthands).
//
// This goes through a 1x1 canvas rather than getComputedStyle, and that detail is
// the whole ballgame. Linear writes its StyleX slots as lch(), and Chromium now
// PRESERVES lch() in computed styles instead of normalising to rgb() — so the old
// getComputedStyle + hexToRgb path returned null for every lch slot, silently
// skipping the tokens that paint Linear's largest surfaces. That single parse
// failure is what made the DOM-walking fallbacks look necessary.
//
// Canvas fillStyle accepts any CSS color the browser knows (lch, oklch, color(),
// hsl, named) and the pixel readback is always plain rgba.
let linearCanvasCtx = null;
function linearResolveRgb(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v === "initial" || v === "inherit" || v === "unset" || v === "transparent") {
    return null;
  }
  if (/^[\d.]+(px|rem|em|vh|vw|%|s|ms)$/i.test(v)) return null;
  if (/^(clip|auto|none|solid|hidden|scroll|flex|block|inline)/i.test(v)) return null;
  if (/\b\d+px\b/.test(v) && !/^(#|rgb|hsl|lch|lab|color|oklch)/i.test(v)) return null;
  if (/var\(--font/i.test(v)) return null;
  // A var() chain can't be resolved by canvas — hand those to the computed-style
  // path below via a probe element.
  if (v.includes("var(")) {
    const probe = document.createElement("div");
    // The id matters: the sx-watch observer ignores omarchy-* nodes. Without it,
    // every probe append retriggers the fast repaint → rAF feedback loop.
    probe.id = "omarchy-linear-probe";
    probe.style.backgroundColor = "";
    probe.style.backgroundColor = v;
    if (!probe.style.backgroundColor) return null;
    document.documentElement.appendChild(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return linearResolveRgb(resolved);
  }

  if (!linearCanvasCtx) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    linearCanvasCtx = c.getContext("2d", { willReadFrequently: true });
  }
  if (!linearCanvasCtx) return hexToRgb(v);
  // Draw over a known pixel so a value the canvas rejects can't masquerade as a
  // real colour: fillStyle keeps its previous value on an invalid assignment.
  linearCanvasCtx.fillStyle = "#000000";
  linearCanvasCtx.fillStyle = v;
  if (linearCanvasCtx.fillStyle === "#000000" && !/^#0{3,8}$|black|rgba?\(0[,\s]/i.test(v)) {
    return null;
  }
  linearCanvasCtx.clearRect(0, 0, 1, 1);
  linearCanvasCtx.fillRect(0, 0, 1, 1);
  const d = linearCanvasCtx.getImageData(0, 0, 1, 1).data;
  if (d[3] === 0) return null; // fully transparent — not a surface colour
  return { r: d[0], g: d[1], b: d[2] };
}

function linearIsNeutralRgb(rgb) {
  if (!rgb) return false;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  // Allow a little blue bias (Linear's greys sit in hue ~282).
  return max - min <= 28;
}

// Mean channel level 0–1. Prefer this over WCAG relLuminance for bucketing
// Linear's near-black greys: WCAG-linearized they all collapse below 0.02.
function linearGreyLevel(rgb) {
  return (rgb.r + rgb.g + rgb.b) / (3 * 255);
}

function linearElevation(s) {
  // Steps are deliberately wider than Linear's own (its light greys sit inside
  // lch 94-100, which is nearly invisible once recoloured) and the upper rungs
  // pick up a little accent so panels differ in hue as well as value — a purely
  // tonal ladder on a warm background reads as one flat colour.
  return {
    bgPrimary: s.bg,
    bgSecondary: shade(s.bg, s.dir * 0.05),
    bgTertiary: mix(shade(s.bg, s.dir * 0.09), s.accent, 0.05),
    bgQuaternary: mix(shade(s.bg, s.dir * 0.13), s.accent, 0.08),
    sidebar: s.sidebarBg,
    sidebarDeep: shade(s.sidebarBg, -s.dir * 0.03),
  };
}

// StyleX reuses neutral greys for BOTH fills and text, and grey level alone
// cannot tell them apart in light mode (a near-black value is a dark fill OR
// light-mode text; near-white is a light fill OR dark-mode text). So classify
// each slot by USAGE — which CSS property consumes it — which the stylesheet
// scan gives us as ground truth, identically in both modes:
//   background*                          → surface slot
//   color / fill / stroke / caret-color  → text slot
//   border* / outline*                   → border slot
// A slot referenced only by other custom properties inherits the consumer's
// role (one propagation pass). Slots consumed as BOTH surface and text are
// ambiguous — leave them to Linear rather than guess.
//
// Hashes change between Linear builds — never hard-code --sx-* names.
// Visit every style rule in the document, descending into grouping rules.
//
// This recursion is essential, not defensive: Linear ships its StyleX atomics
// inside @layer priority1..N blocks. A CSSLayerBlockRule has no .style, so a
// flat walk over sheet.cssRules skipped every layer wholesale and only ever saw
// the :root definition rules — which is why the usage classifier found 0
// consumers and the sx remap emitted nothing at all.
function linearEachStyleRule(fn) {
  const walk = (rules) => {
    for (const rule of rules || []) {
      if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules); // @layer/@media/@supports
      if (rule.style) fn(rule);
    }
  };
  const sheets = [...document.styleSheets, ...(document.adoptedStyleSheets || [])];
  for (const sheet of sheets) {
    if (sheet.ownerNode?.id?.startsWith?.("omarchy-")) continue;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    walk(rules);
  }
}

// The pristine value of every --sx-* slot, captured on the FIRST scan and never
// refreshed. Once we start writing overrides, the live computed value of a slot is
// our own colour — reading that back would re-bucket our output and, because
// isOurs() then matches, silently stop remapping from the second apply onward.
const linearPristine = new Map();

function linearSxRoles() {
  // name -> { surface: n, text: n, border: n } — COUNTS, not flags. StyleX shares
  // atomics aggressively, so a slot painting twenty backgrounds is often also read
  // once as a text or border colour. Treating that as "ambiguous, skip" threw away
  // the dominant use and was why Linear's biggest surfaces stayed unthemed.
  const roles = {};
  const aliasEdges = []; // [definingPropName, referencedSlotName]
  // Which interaction state, if any, a selector is scoped to.
  const stateOf = (sel) => {
    if (/:hover|\[data-hover/i.test(sel)) return "hover";
    if (/selected|\bactive\b|:focus|checked|current|highlight/i.test(sel)) return "selected";
    return null;
  };
  const roleOf = (prop) => {
    if (/^background/.test(prop)) return "surface";
    if (
      prop === "color" ||
      prop === "-webkit-text-fill-color" ||
      prop === "fill" ||
      prop === "stroke" ||
      prop === "caret-color"
    )
      return "text";
    if (/^(border|outline)/.test(prop)) return "border";
    return null;
  };
  linearEachStyleRule((rule) => {
    // Parse declarations out of cssText rather than walking rule.style.
    //
    // Linear writes `background: var(--sx-…)`, a SHORTHAND holding a
    // pending-substitution value, and Chromium's CSSOM returns "" from
    // getPropertyValue("background") for those. cssText always carries the
    // literal declaration.
    const text = rule.cssText;
    if (!text || !text.includes("--sx-")) return;
    const sel = rule.selectorText || "";
    for (const m of text.matchAll(/([-a-zA-Z0-9]+)\s*:\s*([^;{}]*--sx-[^;{}]*)/g)) {
      const prop = m[1].toLowerCase();
      const refs = m[2].match(/--sx-[A-Za-z0-9-]+/g) || [];
      if (!refs.length) continue;
      if (prop.startsWith("--")) {
        for (const n of refs) aliasEdges.push([prop, n]);
        continue;
      }
      let role = roleOf(prop);
      if (!role) continue;
      // Surfaces that only ever appear under a STATE selector are highlights, not
      // elevation. Bucketing them by grey level made every hover row, selected row,
      // group header and active filter pill a flat neutral grey; routing them to the
      // accent-tinted hover/selected surfaces is what makes them read as highlights.
      if (role === "surface" && stateOf(sel)) role = stateOf(sel);
      for (const n of refs) {
        const r = (roles[n] ||= { surface: 0, text: 0, border: 0, hover: 0, selected: 0 });
        r[role]++;
      }
    }
  });
  // One propagation pass: --x: var(--sx-y) hands --x's roles to --sx-y.
  for (const [from, to] of aliasEdges) {
    const src = roles[from];
    if (!src) continue;
    const dst = (roles[to] ||= { surface: 0, text: 0, border: 0, hover: 0, selected: 0 });
    for (const k of ["surface", "text", "border", "hover", "selected"]) {
      dst[k] += src[k] || 0;
    }
  }
  return roles;
}

// Within-role bucketing is mode-agnostic:
//  - surfaces rank by distance from their nearer pole (black for dark-sheet
//    greys, white for light-sheet greys) — the same elevation rank lands on
//    the same omarchy surface whichever sheet it came from;
//  - text ranks by contrast strength (distance from mid-grey).
// Pick the role a slot is actually FOR. Requires a clear winner (at least twice
// the runner-up) so genuinely dual-purpose slots are still left alone.
function linearDominantRole(counts) {
  if (!counts) return null;
  const ranked = ["surface", "text", "border", "hover", "selected"]
    .map((k) => [k, counts[k] || 0])
    .sort((a, b) => b[1] - a[1]);
  const [top, topN] = ranked[0];
  const runnerN = ranked[1][1];
  if (topN === 0) return null;
  if (runnerN > 0 && topN < runnerN * 2) return null;
  return top;
}

// Absolute thresholds threw Linear's elevation information away: its light-mode
// surfaces all sit within lch 94-100, so every one landed on the first rung and
// the whole app collapsed to a single flat colour. Instead, rank each slot
// WITHIN the range actually observed this pass, so whatever spread Linear uses
// gets stretched across the full ladder — relative ordering preserved, contrast
// made visible. `stats` carries {min,max} of the surface levels; without it (a
// single slot, or all equal) everything sensibly stays on bgPrimary.
function linearSurfaceBucket(level, elev, stats) {
  const rank = level < 0.5 ? level : 1 - level;
  if (rank > 0.32) return null; // not a plausible chrome grey
  if (!stats || !(stats.max > stats.min)) return elev.bgPrimary;
  // 0 = closest to the page surface, 1 = furthest from it.
  const t = (stats.max - rank === 0 && stats.min === rank)
    ? 0
    : (rank - stats.min) / (stats.max - stats.min);
  if (t < 0.25) return elev.bgPrimary;
  if (t < 0.55) return elev.bgSecondary;
  if (t < 0.8) return elev.bgTertiary;
  return elev.bgQuaternary;
}

function linearTextBucket(level, text) {
  const strength = Math.abs(level - 0.5) * 2; // 1 = pure black/white
  if (strength > 0.85) return text.primary;
  if (strength > 0.55) return text.secondary;
  if (strength > 0.3) return text.tertiary;
  return text.quaternary;
}

function linearSxRemaps(s) {
  const remaps = {};
  if (!document.documentElement) return remaps;

  const elev = linearElevation(s);
  const text = {
    primary: s.fg,
    secondary: withAlpha(s.fg, s.isDark ? 0.9 : 0.78),
    tertiary: s.sidebarMuted,
    quaternary: withAlpha(s.fg, s.isDark ? 0.4 : 0.45),
  };
  const ourColors = [
    ...Object.values(elev),
    text.primary,
    text.secondary,
    text.tertiary,
    text.quaternary,
  ];
  const ourRgb = ourColors.map((c) => hexToRgb(c)).filter(Boolean);
  const isOurs = (rgb) =>
    ourRgb.some(
      (o) =>
        Math.abs(o.r - rgb.r) <= 4 &&
        Math.abs(o.g - rgb.g) <= 4 &&
        Math.abs(o.b - rgb.b) <= 4
    );

  // Prefer ORIGINAL stylesheet values so reapply doesn't re-bucket our own
  // overrides up the ladder.
  const original = {};
  const names = new Set();
  linearEachStyleRule((rule) => {
    // Read the DEFINITIONS from cssText too: getPropertyValue returns "" for
    // these declarations as well, which left `original` empty — the value lookup
    // then fell back to the computed root value, which after the first apply is
    // OUR OWN colour, and isOurs() skipped the slot. That made the remap stop
    // working from the second apply onward.
    const text = rule.cssText;
    if (!text || !text.includes("--sx-")) return;
    const sel = rule.selectorText || "";
    const modeHit = s.isDark
      ? /\.dark\b|dark-theme|color-scheme:\s*dark/i.test(sel)
      : /\.light\b|light-theme|color-scheme:\s*light/i.test(sel);
    for (const m of text.matchAll(/(--sx-[A-Za-z0-9-]+)\s*:\s*([^;{}]+)/g)) {
      const p = m[1];
      const v = m[2].trim();
      names.add(p);
      if (v && (modeHit || !original[p])) original[p] = v;
      if (v && !linearPristine.has(p)) linearPristine.set(p, v);
    }
  });
  const cs = getComputedStyle(document.documentElement);
  for (let i = 0; i < cs.length; i++) {
    if (cs[i].startsWith("--sx-")) names.add(cs[i]);
  }

  const roles = linearSxRoles();
  const borderNormal = s.borderColor;
  const borderStrong = withAlpha(s.fg, s.isDark ? 0.16 : 0.14);

  // First pass: resolve every slot once, and record the spread of the SURFACE
  // ranks so the ladder can be scaled to the range Linear actually uses.
  const resolved = [];
  const surfaceStats = { min: Infinity, max: -Infinity };
  for (const prop of names) {
    const value =
      linearPristine.get(prop) || original[prop] || cs.getPropertyValue(prop).trim();
    if (!linearPristine.has(prop) && value) linearPristine.set(prop, value);
    if (!value) continue;
    const rgb = linearResolveRgb(value);
    if (!rgb || !linearIsNeutralRgb(rgb)) continue;
    if (isOurs(rgb)) continue;
    const role = linearDominantRole(roles[prop]);
    if (!role) continue; // no consumer, or genuinely dual-purpose
    const level = linearGreyLevel(rgb);
    if (role === "surface") {
      const rank = level < 0.5 ? level : 1 - level;
      if (rank <= 0.32) {
        if (rank < surfaceStats.min) surfaceStats.min = rank;
        if (rank > surfaceStats.max) surfaceStats.max = rank;
      }
    }
    resolved.push([prop, role, level]);
  }

  for (const [prop, role, level] of resolved) {
    let bucket = null;
    if (role === "hover") bucket = s.hoverBg;
    else if (role === "selected") bucket = s.selectedBg;
    else if (role === "surface") bucket = linearSurfaceBucket(level, elev, surfaceStats);
    else if (role === "text") bucket = linearTextBucket(level, text);
    else if (role === "border")
      bucket = Math.abs(level - 0.5) * 2 > 0.5 ? borderStrong : borderNormal;
    // No known consumer → skip. Guessing unconsumed slots by grey level is
    // exactly what broke light mode.
    if (bucket) remaps[prop] = bucket;
  }
  return remaps;
}

function linearPinColorMode(isDark) {
  const h = document.documentElement;
  // Exclusive — Linear misbehaves hard if both classes are present (dark-mode
  // text tokens + light page chrome). Always pin on apply, not only on
  // light↔dark crossings: the engine may record _lastIsDark before this pack
  // registers, which would skip onColorMode entirely.
  //
  // No-op when already correct so we don't thrash MutationObserver → reapply.
  const want = isDark ? "dark" : "light";
  const hasDark = h.classList.contains("dark");
  const hasLight = h.classList.contains("light");
  if (isDark && hasDark && !hasLight) return;
  if (!isDark && hasLight && !hasDark) return;
  h.classList.remove("dark", "light");
  h.classList.add(want);
}

function linearStructuralCss(s) {
  const bg = s.bg;
  const fg = s.fg;
  return `
html body,
html body #root {
  background-color: ${bg} !important;
  color: ${fg} !important;
}
html body main,
html body main.section-to-print,
html body [class*="section-to-print"] {
  background-color: ${bg} !important;
  color: ${fg} !important;
}
html body header {
  background-color: ${bg} !important;
  color: ${fg} !important;
}
html body [data-scroll-container],
html body [data-restore-scroll-view="pull-request-view"],
html body [data-restore-scroll-view="pull-request-code-view"] {
  background-color: ${bg} !important;
}
`.replace(/\s+/g, " ");
}

// Styled-components / StyleX sometimes set background as a literal lch() or
// hex on the element. Walk large visible nodes and restomp neutrals that still
// match Linear greys. Also clear stale inline paints from the opposite mode.
function linearDirectPaintSurfaces(s) {
  if (!document.body) return;
  const elev = linearElevation(s);
  const our = Object.values(elev)
    .map((c) => hexToRgb(c))
    .filter(Boolean);

  const isAlreadyOurs = (rgb) =>
    our.some(
      (o) =>
        Math.abs(o.r - rgb.r) <= 3 &&
        Math.abs(o.g - rgb.g) <= 3 &&
        Math.abs(o.b - rgb.b) <= 3
    );

  const nodes = document.body.querySelectorAll(
    "main, header, [data-scroll-container], [class*='section-to-print'], [data-restore-scroll-view]"
  );
  const root = document.getElementById("root");
  const extra = [];
  if (root) {
    for (const el of root.querySelectorAll("div")) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 80000) continue;
      if (r.bottom < 0 || r.top > innerHeight + 100) continue;
      extra.push(el);
      if (extra.length > 40) break;
    }
  }

  const seen = new Set();
  for (const el of [...nodes, ...extra]) {
    if (seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const rgb = hexToRgb(bg);
    if (!rgb) continue;

    // Drop inline paint we applied under the opposite mode (wrong contrast).
    if (el.dataset.omarchyLinearPaint === "1") {
      if (!isAlreadyOurs(rgb)) {
        el.style.removeProperty("background-color");
        delete el.dataset.omarchyLinearPaint;
      }
    }

    if (!linearIsNeutralRgb(rgb)) continue;
    if (isAlreadyOurs(rgb)) continue;
    // Direct paint only touches backgrounds — use surface buckets, not text.
    const level = linearGreyLevel(rgb);
    let bucket = null;
    if (s.isDark) {
      if (level >= 0.035 && level <= 0.28) {
        if (level < 0.1) bucket = elev.bgPrimary;
        else if (level < 0.13) bucket = elev.bgSecondary;
        else if (level < 0.16) bucket = elev.bgTertiary;
        else bucket = elev.bgQuaternary;
      }
    } else if (level <= 0.32) {
      if (level < 0.08) bucket = elev.bgPrimary;
      else if (level < 0.14) bucket = elev.bgSecondary;
      else if (level < 0.2) bucket = elev.bgTertiary;
      else bucket = elev.bgQuaternary;
    } else if (level >= 0.86 && level < 0.965) {
      if (level > 0.94) bucket = elev.bgPrimary;
      else if (level > 0.91) bucket = elev.bgSecondary;
      else if (level > 0.88) bucket = elev.bgTertiary;
      else bucket = elev.bgQuaternary;
    }
    if (!bucket) continue;
    el.style.setProperty("background-color", bucket, "important");
    el.dataset.omarchyLinearPaint = "1";
  }
}

// Hardcoded lch() text (StyleX/styled-components) ignores our CSS variables.
// On light themes, restomp near-white text sitting on light surfaces so body
// copy stays readable. Skip text on dark chips/selected rows (light-on-dark
// is correct there).
function linearDirectPaintText(s) {
  if (!document.body) return;

  // Drop text overrides when switching back to dark (or before repainting).
  if (s.isDark) {
    for (const el of document.body.querySelectorAll("[data-omarchy-linear-text='1']")) {
      el.style.removeProperty("color");
      delete el.dataset.omarchyLinearText;
    }
    return;
  }

  const fg = s.fg;
  const muted = s.sidebarMuted;

  // One reusable probe per pass (this runs per rAF on busy views; a probe per
  // node was 400 appends/removes per frame). id keeps the observer ignoring it.
  const probeEl = document.createElement("div");
  probeEl.id = "omarchy-linear-probe";
  probeEl.style.display = "none";
  document.documentElement.appendChild(probeEl);
  const resolveColorRgb = (value) => {
    if (!value) return null;
    probeEl.style.color = "";
    probeEl.style.color = value;
    return hexToRgb(getComputedStyle(probeEl).color);
  };

  const effectiveBgLevel = (el) => {
    let n = el;
    for (let d = 0; d < 8 && n; d++, n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      const rgb = hexToRgb(bg);
      if (!rgb) continue;
      // Skip fully transparent.
      if (/rgba\([^)]*,\s*0\s*\)$/.test(bg.replace(/\s/g, ""))) continue;
      if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") continue;
      return linearGreyLevel(rgb);
    }
    return linearGreyLevel(hexToRgb(s.bg) || { r: 240, g: 240, b: 240 });
  };

  const nodes = document.body.querySelectorAll(
    "span, a, p, button, label, li, h1, h2, h3, h4, td, th, div"
  );
  let painted = 0;
  for (const el of nodes) {
    if (painted > 400) break;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 6) continue;
    if (r.bottom < 0 || r.top > innerHeight + 50) continue;
    // Only leaf-ish text carriers — skip huge layout wrappers.
    if (r.width * r.height > 200000) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const rgb = resolveColorRgb(cs.color);
    if (!rgb || !linearIsNeutralRgb(rgb)) continue;
    const textLevel = linearGreyLevel(rgb);
    // Only fix light/washed text.
    if (textLevel < 0.72) {
      if (el.dataset.omarchyLinearText === "1") {
        // Previously forced; if it's fine now, leave it.
      }
      continue;
    }

    const bgLevel = effectiveBgLevel(el);
    // Dark surface (selected row, dark chip) — light text is intentional.
    if (bgLevel < 0.45) {
      if (el.dataset.omarchyLinearText === "1") {
        el.style.removeProperty("color");
        delete el.dataset.omarchyLinearText;
      }
      continue;
    }

    el.style.setProperty("color", textLevel > 0.9 ? fg : muted, "important");
    el.dataset.omarchyLinearText = "1";
    painted++;
  }
  probeEl.remove();
}

function linearPaint(theme, s) {
  linearPinColorMode(s.isDark);

  let style = document.getElementById("omarchy-linear-paint");
  if (!style) {
    style = document.createElement("style");
    style.id = "omarchy-linear-paint";
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = linearStructuralCss(s);
  linearDirectPaintSurfaces(s);
  linearDirectPaintText(s);
}

// Linear injects StyleX slots after first paint and on route changes, and its
// React re-renders (heaviest on the issue view) replace nodes that we painted
// inline — each replacement briefly shows Linear's hardcoded grey. Two paths:
//
//  - FAST (rAF-coalesced, like the Slack pack's paintActiveRows): re-run only
//    the paint layer (mode pin + structural css + direct re-stomp). This is
//    what closes the visible grey flash — it runs on the next frame after a
//    re-render instead of 150ms later.
//  - FULL (debounced): OmarchyTheme.reapply(), which recomputes the sx remaps.
//    Only needed when NEW stylesheets appear (new --sx-* slots possible).
//
// Ignore our own style-tag mutations to avoid feedback loops. Do NOT watch
// html[style] — the engine writes colorScheme there on every apply.
function linearArmSxWatch() {
  if (linearArmSxWatch._armed) return;
  linearArmSxWatch._armed = true;

  let raf = 0;
  const kickFast = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const cur = OmarchyTheme.current;
      if (cur) linearPaint(cur.theme, cur.surfaces);
    });
  };

  let timer = null;
  const kickFull = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (OmarchyTheme.current) OmarchyTheme.reapply();
    }, 150);
  };

  const ours = (n) =>
    n &&
    n.nodeType === 1 &&
    typeof n.id === "string" &&
    n.id.startsWith("omarchy-");

  new MutationObserver((muts) => {
    let fast = false;
    let full = false;
    for (const m of muts) {
      if (
        m.type === "attributes" &&
        m.target === document.documentElement &&
        m.attributeName === "class"
      ) {
        // If Linear (or anything) re-introduces the wrong mode class, repin.
        fast = true;
        continue;
      }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || ours(n)) continue;
        if (n.tagName === "STYLE" || n.tagName === "LINK") full = true;
        else fast = true; // re-rendered content — restomp on next frame
      }
    }
    if (full) kickFull();
    else if (fast) kickFast();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kickFull, { once: true });
  } else {
    kickFull();
  }
  setTimeout(kickFull, 1000);
  setTimeout(kickFull, 3000);
}

OmarchyTheme.register({
  id: "linear",
  cssVars(theme, s) {
    const elev = linearElevation(s);
    const { bgPrimary, bgSecondary, bgTertiary, bgQuaternary, sidebar, sidebarDeep } = elev;
    const border = s.borderColor;
    const borderStrong = withAlpha(s.fg, s.isDark ? 0.14 : 0.12);
    const borderStronger = withAlpha(s.fg, s.isDark ? 0.2 : 0.18);
    const textPrimary = s.fg;
    const textSecondary = withAlpha(s.fg, s.isDark ? 0.9 : 0.78);
    const textTertiary = s.sidebarMuted;
    const textQuaternary = withAlpha(s.fg, s.isDark ? 0.4 : 0.45);
    const contentMuted = withAlpha(s.fg, s.isDark ? 0.45 : 0.5);
    const codeBg = withAlpha(s.fg, s.isDark ? 0.08 : 0.06);
    const pal = theme.colors || {};
    const success = pal.green || (s.isDark ? "#3fb950" : "#40a02b");
    const danger = pal.red || (s.isDark ? "#f85149" : "#d20f39");

    const vars = {
      // ----- Base / page / sidebar -----
      "--bg-base-color": s.bg,
      "--bg-color": bgPrimary,
      "--bg-sidebar-color": sidebar,
      "--bg-border-color": border,
      // Always write BOTH mode twins to the active surfaces. Leaving the
      // inactive twin as Linear's default made light mode pick up dark-twin
      // values (and vice versa) when both html classes briefly coexisted.
      "--bg-base-color-dark": s.isDark ? s.bg : "#121213",
      "--bg-base-color-light": s.isDark ? "#f9f9fa" : s.bg,
      "--bg-sidebar-dark": s.isDark ? sidebarDeep : "#09090a",
      "--bg-sidebar-light": s.isDark ? "#efeff0" : sidebar,
      "--bg-border-color-dark": s.isDark ? border : "#212224",
      "--bg-border-color-light": s.isDark ? "#e2e2e2" : border,
      "--content-color-dark": s.isDark ? contentMuted : "#6b6f76",
      "--content-color-light": s.isDark ? "#b0b5c0" : contentMuted,

      // ----- Elevation surfaces -----
      "--color-bg-primary": bgPrimary,
      "--color-bg-secondary": bgSecondary,
      "--color-bg-tertiary": bgTertiary,
      "--color-bg-quaternary": bgQuaternary,
      "--content-bg-color": bgPrimary,
      "--header-color": bgPrimary,

      // ----- Text -----
      "--color-text-primary": textPrimary,
      "--color-text-secondary": textSecondary,
      "--color-text-tertiary": textTertiary,
      "--color-text-quaternary": textQuaternary,
      "--editor-text-color": textPrimary,
      "--content-color": contentMuted,
      // Highlight twins: on light themes the "dark" twin is a near-black fill
      // Linear uses for emphasis text/chips — keep it dark for contrast.
      "--content-highlight-color": s.isDark ? "#ffffff" : mix(s.bg, s.fg, 0.92),
      "--content-highlight-color-dark": s.isDark ? "#ffffff" : "#23252a",
      "--content-highlight-color-light": s.isDark ? "#23252a" : mix(s.bg, s.fg, 0.92),

      // ----- Borders -----
      "--color-border-primary": border,
      "--color-border-secondary": borderStrong,
      "--color-border-tertiary": borderStronger,

      // ----- Accent / focus -----
      "--focus-color": s.accent,
      "--focus-ring-color": s.accent,
      "--callout-accent": s.accent,
      "--badge-highlight-color": s.accent,
      "--ai-selection-bg": withAlpha(s.accent, s.isDark ? 0.2 : 0.12),

      // Soft selected/hover fills.
      "--details-property-hover-background": s.hoverBg,
      "--details-property-default-hover-background": s.hoverBg,
      "--details-property-highlight-color": s.selectedBg,
      "--details-property-default-highlight-color": s.selectedBg,
      "--action-menu-item-bg-focus": s.hoverBg,
      "--comment-actions-background-color": bgSecondary,
      "--comment-actions-default-background-color": bgSecondary,

      // ----- Editor / inline code -----
      "--editor-bg-shade": bgSecondary,
      "--editor-inline-code-background": codeBg,
      "--editor-faint-placeholder-color": textQuaternary,

      // ----- Diff / review -----
      "--diff-view-editor-background": bgPrimary,
      "--diff-view-editor-background-opaque": bgPrimary,
      "--diff-view-editor-foreground": textPrimary,
      "--diff-view-blank-bg": bgSecondary,
      "--diff-view-focus-bg": withAlpha(s.accent, 0.12),
      "--diff-view-line-number-fg": textQuaternary,
      "--diff-view-comment-button-default-bg": bgTertiary,
      "--diff-view-comment-button-default-bg-hover": bgQuaternary,
      "--diff-view-inserted-bg": withAlpha(success, 0.12),
      "--diff-view-inserted-inline-bg": withAlpha(success, 0.22),
      "--diff-view-removed-bg": withAlpha(danger, 0.12),
      "--diff-view-removed-inline-bg": withAlpha(danger, 0.22),
      "--diff-view-git-added-fg": success,
      "--diff-view-git-deleted-fg": danger,
      "--diff-view-git-modified-fg": s.accent,
      "--diff-view-comment-button-added-bg": withAlpha(success, 0.2),
      "--diff-view-comment-button-added-bg-hover": withAlpha(success, 0.3),
      "--diff-view-comment-button-removed-bg": withAlpha(danger, 0.2),
      "--diff-view-comment-button-removed-bg-hover": withAlpha(danger, 0.3),

      "--pull-request-comment-prompt-bg-shade": bgSecondary,
      "--timeline-background-color": bgPrimary,
      "--timeline-bar-background-color": bgTertiary,
    };

    Object.assign(vars, linearSxRemaps(s));
    return vars;
  },

  apply(theme, s) {
    linearPaint(theme, s);
    linearArmSxWatch();
  },

  onColorMode(isDark) {
    linearPinColorMode(isDark);
  },
});
