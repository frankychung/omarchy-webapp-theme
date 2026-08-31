// X (Twitter) pack for the Omarchy web-app theming engine — full tier.
//
// X is the hardest target in this repo and the only one with no design-token
// layer to write into. Verified live 2026-08-31, logged in, against x.com/home.
// Four measurements shaped everything below:
//
//   (1) THERE ARE NO USABLE CUSTOM PROPERTIES. X exposes 44, and they are a
//       toast library plus a --gray1..12 ramp — not the app surfaces. A
//       cssVars() table would move almost nothing, so this is a full-tier pack.
//   (2) X ships ATOMIC CSS: 1730 style rules, one declaration each, behind
//       hashed class names (`.r-kemksi { background-color: rgb(0, 0, 0) }`).
//       The class names change whenever X rebuilds, so they must never be
//       hard-coded — but the DECLARED COLOUR is stable brand palette. So this
//       pack hard-codes the colours and DISCOVERS the selectors at runtime,
//       re-emitting each rule with our value and `!important`.
//   (3) Nothing X paints carries an inline `!important` — 393 elements have a
//       style attribute and not one uses it. An author-level `!important`
//       therefore beats both the atomic rules and the inline styles. The
//       problem here was only ever finding the selectors, never specificity.
//   (4) Light/dark rides prefers-color-scheme: X stamps `data-theme` on <html>
//       and flips it from matchMedia, which the MAIN-world shim drives.
//       Verified by emulating the media feature before navigation. Dark
//       resolves to "Lights out" (body computes to rgb(0,0,0)), not "Dim".
//
// WHY A STATIC TABLE AND NOT A CLASSIFIER. The obvious move is to classify each
// literal at runtime by luminance — page background at one end, body text at the
// other, everything else interpolated. That was built and measured, and it is
// too sharp a knife: X's muted ink (rgb(113,118,123)) lands at 0.23 of the way
// from black to rgb(231,233,234), and any threshold placed near there decides
// between "muted text" and "ink on a light chip". Put it at 0.25 and 52 labels
// on the home timeline — every timestamp and every "Following" — render in the
// page background colour, which is invisible rather than merely wrong. A table
// has no thresholds to be one hair off. Every entry below is a decision someone
// can read and disagree with, which is the property this repo wants.
//
// Anything NOT in the table is left exactly as X ships it. That is the safe
// direction: an unthemed surface looks off-palette, a mis-themed one can vanish.

// X's brand palette, sampled live from its own stylesheets in both polarities.
// Keyed by "<property class>|<declared value>" because one literal can mean two
// things in one polarity: in light mode `rgb(255, 255, 255)` is the page when it
// is a background and the ink on a filled button when it is a colour.
//
// Property classes: `ink` (color/fill/stroke/caret-color/text-decoration-color),
// `bg` (background-color), `border` (any border-*-color).
const X_LITERALS = {
  dark: {
    // Lights out. The page is pure black; the ladder above it is near-black.
    "bg|rgb(0, 0, 0)": "pageBg",
    "bg|rgb(11, 11, 11)": "raisedBg",
    "bg|rgb(16, 17, 20)": "raisedBg",
    "bg|rgb(20, 20, 20)": "raisedBg",
    "bg|rgb(22, 24, 28)": "raisedBg",
    "bg|rgb(26, 26, 26)": "raisedBg",
    "bg|rgb(27, 32, 35)": "raisedBg",
    "bg|rgb(32, 35, 39)": "raisedBg2",
    "bg|rgb(39, 44, 48)": "raisedBg2",
    "bg|rgb(42, 45, 48)": "raisedBg2",
    "bg|rgb(47, 51, 54)": "raisedBg2",
    "bg|rgb(51, 51, 51)": "raisedBg2",
    "bg|rgb(51, 54, 57)": "raisedBg2",
    "bg|rgb(54, 54, 57)": "raisedBg2",
    "bg|rgb(62, 65, 68)": "raisedBg3",
    "bg|rgb(63, 67, 71)": "raisedBg3",
    "bg|rgb(75, 78, 82)": "raisedBg3",
    "border|rgb(26, 26, 26)": "border",
    "border|rgb(32, 35, 39)": "border",
    "border|rgb(42, 45, 48)": "border",
    "border|rgb(47, 51, 54)": "border",
    "border|rgb(51, 54, 57)": "border",
    "border|rgb(54, 54, 57)": "border",
    "border|rgb(61, 61, 61)": "borderStrong",
    "border|rgb(62, 65, 68)": "borderStrong",
    "border|rgb(68, 68, 71)": "borderStrong",
    "border|rgb(89, 93, 98)": "borderStrong",
    "ink|rgb(62, 65, 68)": "fgFaint",
    "ink|rgb(68, 68, 71)": "fgFaint",
    "ink|rgb(100, 105, 109)": "fgMuted",
    "ink|rgb(113, 118, 123)": "fgMuted",
    "ink|rgb(117, 117, 117)": "fgMuted",
    "ink|rgb(127, 127, 127)": "fgMuted",
    "ink|rgb(128, 128, 128)": "fgMuted",
    "ink|rgb(130, 154, 171)": "fgMuted",
    "ink|rgb(182, 185, 188)": "fgMuted",
    "ink|rgb(231, 233, 234)": "fg",
    "ink|rgb(232, 232, 232)": "fg",
    "ink|rgb(247, 249, 249)": "fg",
    "ink|rgb(239, 243, 244)": "fg",
    // The Post button in Lights out is a LIGHT chip with dark ink. Repainting it
    // as the accent keeps it the loudest control on the page, which is its job.
    "bg|rgb(239, 243, 244)": "accent",
    "bg|rgb(247, 249, 249)": "accent",
    "ink|rgb(15, 20, 25)": "onAccent",
    // `rgb(0, 0, 0)` is deliberately absent from BOTH tables as an ink and as a
    // background. It is the page in Lights out (mapped above as a background in
    // dark only), the Post button in Light, X's hidden accessibility headings,
    // and the ink on a light chip — four meanings, one literal, no property or
    // alpha that separates them. Mapping it painted 56 "Trending" labels on
    // /explore in the page background colour, which is invisible. Left alone.
    "ink|rgb(255, 255, 255)": "onAccent",
    "bg|rgb(255, 255, 255)": "accent",
  },
  light: {
    "bg|rgb(255, 255, 255)": "pageBg",
    "bg|rgb(247, 249, 249)": "raisedBg",
    "bg|rgb(239, 243, 244)": "raisedBg",
    "bg|rgb(229, 234, 236)": "raisedBg2",
    "bg|rgb(230, 236, 240)": "raisedBg2",
    "bg|rgb(207, 217, 222)": "raisedBg3",
    "bg|rgb(185, 202, 211)": "raisedBg3",
    "border|rgb(239, 243, 244)": "border",
    "border|rgb(229, 234, 236)": "border",
    "border|rgb(207, 217, 222)": "borderStrong",
    "border|rgb(185, 202, 211)": "borderStrong",
    "border|rgb(159, 181, 195)": "borderStrong",
    // X spends this one as a decorative/disabled icon ink as well as a border
    // and a surface — 12 SVG glyphs on the timeline inherit it. At 1.7:1 on
    // white it is deliberately faint, so it maps to fgFaint rather than
    // fgMuted, which would make the icons darker than X draws them.
    "ink|rgb(207, 217, 222)": "fgFaint",
    "ink|rgb(185, 202, 211)": "fgFaint",
    "ink|rgb(83, 100, 113)": "fgMuted",
    "ink|rgb(107, 127, 142)": "fgMuted",
    "ink|rgb(130, 154, 171)": "fgMuted",
    "ink|rgb(117, 117, 117)": "fgMuted",
    "ink|rgb(127, 127, 127)": "fgMuted",
    "ink|rgb(128, 128, 128)": "fgMuted",
    "ink|rgb(15, 20, 25)": "fg",
    "ink|rgb(0, 0, 0)": "fg",
    "ink|rgb(39, 44, 48)": "fg",
    "ink|rgb(63, 63, 63)": "fg",
    // ...and in Light the Post button is a DARK chip with white ink.
    "bg|rgb(15, 20, 25)": "accent",
    "ink|rgb(255, 255, 255)": "onAccent",
    "ink|rgb(239, 243, 244)": "onAccent",
  },
};

// X blue, in both polarities and both of its pressed states. Kept out of the
// tables above because it is the one hue that is the SAME in every X theme.
const X_ACCENT = {
  "ink|rgb(29, 155, 240)": "accent",
  "bg|rgb(29, 155, 240)": "accent",
  "border|rgb(29, 155, 240)": "accent",
  "ink|rgb(26, 140, 216)": "accentHover",
  "bg|rgb(26, 140, 216)": "accentHover",
  "bg|rgb(23, 124, 192)": "accentActive",
  "ink|rgb(107, 201, 251)": "accentSoft",
  "ink|rgb(142, 205, 248)": "accentSoft",
  "bg|rgb(142, 205, 248)": "accentSoft",
};

// Property name → the class the tables are keyed on.
const INK_PROPS = ["color", "fill", "stroke", "caret-color", "text-decoration-color"];
const COLOR_PROPS = INK_PROPS.concat([
  "background-color", "border-color", "border-top-color", "border-right-color",
  "border-bottom-color", "border-left-color", "outline-color",
]);

function propClass(prop) {
  if (prop === "background-color") return "bg";
  if (prop.startsWith("border") || prop === "outline-color") return "border";
  return "ink";
}

// A translucent black is ALWAYS a scrim in X — the lightbox dimmer, the chips
// the video player floats over its own picture — and never a surface. Its
// opaque twin is not: `rgb(0, 0, 0)` is the page in Lights out and the Post
// button in Light. Alpha-splitting the two together painted the lightbox
// dimmer and the player controls in the accent on every light theme, which
// stops the dimmer dimming and puts a mid-tone chip over arbitrary video.
// Scrims have to stay dark whatever the terminal palette says.
const X_SCRIM_BASES = new Set(["rgb(0, 0, 0)", "rgb(15, 20, 25)"]);

// X paints translucent washes as rgba() of the same brand literals
// (`rgba(29, 155, 240, 0.1)` behind a selected row). Split the alpha off, look
// the opaque colour up, and put the alpha back — one table entry then covers
// every wash derived from it.
function splitAlpha(value) {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(value);
  if (!m) return null;
  const alpha = parseFloat(m[4]);
  if (!(alpha > 0) || alpha >= 1) return null;
  return { base: `rgb(${m[1]}, ${m[2]}, ${m[3]})`, alpha };
}

function reAlpha(color, alpha) {
  const rgb = /^#/.test(color) ? hexToRgb(color) : null;
  if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : color;
}

const STYLE_ID = "omarchy-x-overrides";

// Total rules across X's own stylesheets, excluding ours. Changes whenever X
// registers new atomic classes for a route it has not rendered before.
function ruleCount() {
  let n = 0;
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode && sheet.ownerNode.id === STYLE_ID) continue;
    try {
      n += sheet.cssRules.length;
    } catch (_) {
      // cross-origin; nothing to count
    }
  }
  return n;
}

OmarchyTheme.register({
  id: "x",

  apply(theme, s) {
    const dir = s.dir;
    const roles = {
      pageBg: theme.bg,
      raisedBg: shade(theme.bg, dir * 0.04),
      raisedBg2: shade(theme.bg, dir * 0.07),
      raisedBg3: shade(theme.bg, dir * 0.11),
      // Borders stay rgba() inks rather than opaque mixes: X draws the same
      // divider over the page, over a hover row and inside a popover, and an
      // opaque value tuned for one of those is visibly wrong on the other two.
      border: withAlpha(s.fg, 0.16),
      borderStrong: withAlpha(s.fg, 0.3),
      fg: s.fg,
      fgMuted: s.sidebarMuted,
      // Decorative and disabled iconography. X draws these near the floor of
      // legibility on purpose; matching fgMuted would make them louder than the
      // real copy beside them.
      fgFaint: withAlpha(s.fg, 0.32),
      accent: s.accent,
      accentHover: shade(s.accent, dir * 0.06),
      accentActive: shade(s.accent, dir * 0.12),
      accentSoft: mix(theme.bg, s.accent, 0.45),
      onAccent: inkOn(s.accent, [theme.bg, s.fg]),
    };
    const table = Object.assign({}, X_LITERALS[s.isDark ? "dark" : "light"], X_ACCENT);

    // Look a declared value up, preserving any alpha it carried.
    const resolve = (prop, value) => {
      const key = propClass(prop) + "|" + value;
      if (table[key]) return roles[table[key]];
      const split = splitAlpha(value);
      if (!split || X_SCRIM_BASES.has(split.base)) return null;
      const role = table[propClass(prop) + "|" + split.base];
      return role ? reAlpha(roles[role], split.alpha) : null;
    };

    const out = [];

    // 1. X's own atomic rules. Re-emit each matching one with the same selector
    //    and our value. CSSStyleRule.cssRules is a TRUTHY EMPTY LIST under CSS
    //    Nesting, so the usual `if (rule.cssRules) { recurse; continue }` guard
    //    silently skips every style rule — discriminate on rule.style instead.
    //    That bug is why an earlier version of this pack found zero rules.
    const walk = (list) => {
      for (let i = 0; i < list.length; i++) {
        const rule = list[i];
        if (rule.style && rule.selectorText) {
          for (const prop of COLOR_PROPS) {
            const value = rule.style.getPropertyValue(prop);
            if (!value) continue;
            const mapped = resolve(prop, value.trim());
            if (mapped) out.push(`${rule.selectorText}{${prop}:${mapped} !important}`);
          }
        }
        if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode && sheet.ownerNode.id === STYLE_ID) continue;
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (_) {
        continue; // cross-origin; X has none today, but don't die if it adds one
      }
      walk(rules);
    }

    // 2. The inline painters. X sets colour from JS on ~150 elements and the
    //    rest inherits, so a handful of attribute selectors covers all of it.
    //
    //    These are emitted FROM THE TABLE, not from a scan of the live DOM.
    //    Scanning was the first version and it breaks on a light<->dark switch:
    //    X re-renders with the other palette AFTER the theme push, writing
    //    inline values that were not in the DOM when apply() ran, and no new
    //    CSS rule is inserted so the rule-count poll never fires either. The
    //    result was permanent until reload — 494 elements still painting X's
    //    muted grey after switching from a light omarchy theme to a dark one.
    //    The table already knows every value worth rewriting, so just emit
    //    them all; a selector that matches nothing costs nothing.
    //
    //    A declaration is either FIRST in the style attribute or preceded by
    //    "; ", which is what keeps `color:` from also matching
    //    `background-color:`.
    const INLINE_PROPS = { ink: ["color", "fill"], bg: ["background-color"], border: ["border-color"] };
    for (const key of Object.keys(table)) {
      const idx = key.indexOf("|");
      const cls = key.slice(0, idx);
      const value = key.slice(idx + 1);
      const mapped = roles[table[key]];
      if (!mapped) continue;
      for (const prop of INLINE_PROPS[cls]) {
        const sel = prop === "color"
          ? `[style^="color: ${value}"], [style*="; color: ${value}"]`
          : `[style*="${prop}: ${value}"]`;
        out.push(`${sel}{${prop}:${mapped} !important}`);
      }
    }

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = out.join("\n");

    // X inserts atomic rules LAZILY, and a MutationObserver CANNOT SEE IT.
    // Opening a profile, /explore or settings adds rules through
    // `sheet.insertRule()` on stylesheets that already exist, which produces no
    // DOM mutation at all. The first version of this pack watched for added
    // <style> nodes and never fired: coverage fell from 129 emitted rules on the
    // home timeline to 46 on settings, leaving the Post button, the Follow
    // button and muted profile text unthemed.
    //
    // Poll the rule COUNT instead. Summing `cssRules.length` over ~9 sheets is
    // nine property reads, cheap enough to run every second for the life of a
    // tab, and it detects exactly the event that matters.
    if (!this._poll) {
      this._poll = setInterval(() => {
        const count = ruleCount();
        if (count === this._lastCount) return;
        this._lastCount = count;
        OmarchyTheme.reapply();
      }, 1000);
    }
    this._lastCount = ruleCount();
  },

});

// DELIBERATELY UNMAPPED, and none of it is an oversight:
//
//   Keyword values (`black`, `white`, `transparent`, `currentcolor`). 20 rules
//   set `border-color: black` on 6205 elements as part of react-native-web's
//   reset, all with `border-width: 0`. Repainting them buys nothing and would
//   put a visible edge on anything that later gains a width.
//
//   The engagement hues — like (rgb(249, 24, 128)), repost (rgb(0, 186, 124)),
//   and the alert red (rgb(244, 33, 46)). These are the same "keep the meaning"
//   colours as Reddit's vote arrows, but unlike a vote arrow they are already
//   distinct from each other and from X blue, and X's own accent picker offers
//   six alternatives a user may have chosen. Recolouring them from a terminal
//   palette would collide two engagement states on themes with one warm hue.
//
//   Media and everything painted over it: video and image backgrounds, the
//   player's control chips, and the lightbox scrim. Controls that ride ON media
//   have to stay legible against arbitrary pixels, which is what X's fixed
//   dark scrim is for.
//
//   Verification badge colours (blue, gold, grey), which encode account type,
//   and the promotional / Grok / Spaces artwork gradients.
//
// NOT COVERED: a user who has pinned X's "Dim" theme rather than leaving it on
// the system setting. Dim's literals (rgb(21, 32, 43) and its ladder) are a
// third palette this pack has not measured, so Dim gets partial theming. The
// README asks for the system setting, which resolves to Light or Lights out.
