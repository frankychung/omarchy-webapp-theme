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
