// Omarchy web-app theming — shared color library (app-agnostic).
//
// App-agnostic helpers for turning an omarchy theme's hex values into the
// surfaces an app pack paints with. Loaded first in the content-script list so
// every later script (omarchy-surfaces.js, omarchy-runtime.js, and each app
// pack) shares these in the content script's isolated-world global scope.

function hexToRgb(hex) {
  // Accept rgb(r, g, b) too — shade() emits that form, and we sometimes
  // chain shade() output back through mix()/withAlpha().
  if (typeof hex === "string" && hex.startsWith("rgb")) {
    const m = hex.match(/\d+/g);
    if (m && m.length >= 3) {
      return { r: +m[0], g: +m[1], b: +m[2] };
    }
    return null;
  }
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// WCAG relative luminance needs each channel linearized (gamma-decoded) first;
// weighting the raw sRGB bytes misclassifies mid-tone backgrounds (#808080 reads
// 0.502 raw vs 0.216 linearized). Every shipped omarchy theme lands the same
// either way — a custom mid-tone background need not.
function channelLuminance(byte) {
  const channel = byte / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relLuminance({ r, g, b }) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function shade(hex, delta) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + delta * 255)));
  return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
}

function withAlpha(hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

// WCAG contrast ratio between two colors. Both are composited/opaque by the
// time they get here — pass the surface a translucent ink will actually sit on,
// not the ink's rgba() string.
function contrastRatio(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return 1;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Pick the lowest alpha at which `ink` over EVERY surface in `surfaces` clears
// `target` contrast. Muted text is a fixed fraction of the foreground in most
// theming systems, but a fixed fraction ignores how much contrast the theme's fg
// had to begin with: at the old flat 0.65, 5 of the 22 shipped omarchy themes put
// muted text below the WCAG AA 4.5:1 floor (rose-pine was worst at 3.00:1), and
// GitHub spends --fgColor-muted on real copy — issue metadata, mega-menu
// descriptions — not just incidental labels.
//
// Contrast is monotonic in alpha (compositing walks the colour from the surface
// toward the ink, and luminance is monotonic in the channels), so a rising scan
// finds the minimum. Returns 1 when even the opaque foreground can't reach the
// target — on a low-headroom theme that means muted lands on fg and the
// muted/primary distinction flattens, which is the accepted cost of the target.
function alphaForContrast(ink, surfaces, target, floorAlpha) {
  const floor = floorAlpha == null ? 0.65 : floorAlpha;
  const list = (Array.isArray(surfaces) ? surfaces : [surfaces]).filter(Boolean);
  if (!list.length) return floor;
  for (let a = floor; a < 1; a += 0.01) {
    const ok = list.every((surface) => contrastRatio(mix(surface, ink, a), surface) >= target);
    if (ok) return Math.round(a * 100) / 100;
  }
  return 1;
}

// Emit "r, g, b" — a bare channel list, NOT a color. Some design systems (see
// Slack's --sk_* tokens) hold their palette as triplets and composite at the
// point of use: `color: rgba(var(--sk_primary_foreground), .7)`. Feeding a real
// color into one of those produces `rgba(#a9b1d6, .7)`, which is invalid at
// computed-value time — the declaration is dropped and an inherited property
// like `color` silently unwinds to the UA default (white under color-scheme:
// dark, black under light) instead of failing visibly. Always verify how a token
// is consumed before overriding it; the format is part of the contract.
function toTriplet(color) {
  const c = hexToRgb(color);
  if (!c) return color;
  return `${c.r}, ${c.g}, ${c.b}`;
}

function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  const r = Math.round(a.r * (1 - t) + b.r * t);
  const g = Math.round(a.g * (1 - t) + b.g * t);
  const bl = Math.round(a.b * (1 - t) + b.b * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
