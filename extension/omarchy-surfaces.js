// Omarchy web-app theming — surface derivation (app-agnostic).
//
// deriveSurfaces() is the CONTRACT between the generic engine and an app pack:
// it maps a pushed omarchy theme (bg/fg/accent/chrome) to the named surfaces an
// app pack paints with. The returned object shape IS the API — app packs read
// these fields, so keep it stable. Dark vs. light is decided by WCAG relative
// luminance of the terminal bg (< 0.5 = dark), *not* by the theme's day/night
// name.
//
// Uses the color helpers from omarchy-colors.js, shared in the content
// script's scope.

function deriveSurfaces(theme) {
  if (!theme || !theme.bg) return null;
  const bgRgb = hexToRgb(theme.bg);
  if (!bgRgb) return null;

  const isDark = relLuminance(bgRgb) < 0.5;
  const fg = theme.fg || (isDark ? "#e6e6e6" : "#1f1f1f");
  const accent = theme.accent || (isDark ? "#7aa2f7" : "#1264a3");

  // delta direction: lighter shades on dark themes, darker shades on light themes
  const dir = isDark ? +1 : -1;
  // Two surfaces:
  //  - sidebarBg: the channel list. Subtly accent-tinted so the workspace
  //    feels theme-aware. Kept light — heavier mixes flood the chrome on
  //    warm/saturated accents.
  //  - chromeBg: outer-app chrome (tab rail + top nav). Uses omarchy's
  //    chromium.theme when the theme ships one, so the app matches Brave's
  //    toolbar tint. Falls back to sidebarBg when absent — keeps fg
  //    contrast correct on light themes.
  const sidebarBg = mix(shade(theme.bg, dir * 0.04), accent, isDark ? 0.1 : 0.06);
  const chromeBg = theme.chrome || sidebarBg;
  const railBg = chromeBg;
  const navBg = chromeBg;
  const sidebarFg = fg;
  const sidebarMuted = withAlpha(fg, 0.65);
  // Stronger than fg: push toward white on dark themes / black on light themes.
  // Used for unread rows so they read brighter than read rows.
  const fgStrong = shade(fg, dir * 0.125);
  const hoverBg = withAlpha(accent, 0.2);
  const selectedBg = withAlpha(accent, 0.35);
  const borderColor = withAlpha(fg, 0.08);

  return {
    bg: theme.bg,
    isDark,
    fg,
    accent,
    dir,
    sidebarBg,
    chromeBg,
    railBg,
    navBg,
    sidebarFg,
    sidebarMuted,
    fgStrong,
    hoverBg,
    selectedBg,
    borderColor,
  };
}
