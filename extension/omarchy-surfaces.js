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
  // Muted/secondary text. Stays an rgba() ink rather than an opaque mix so it
  // keeps adapting to whatever surface it lands on — but the alpha is solved for
  // a contrast TARGET instead of being a flat fraction of fg. Packs spend this on
  // real copy (GitHub's --fgColor-muted carries issue metadata and mega-menu
  // descriptions), and a flat 0.65 put 5 of 22 shipped themes under the AA
  // 4.5:1 floor. Target 6:1, matching GitHub's own dark muted (6.15:1).
  //
  // Solved against the PAGE bg only, deliberately. Also requiring 6:1 on the
  // accent-tinted sidebarBg pushes the alpha to 1.0 on low-headroom themes
  // (rose-pine, catppuccin-latte, everforest, tokyo-night, gruvbox), which
  // collapses muted onto fg and destroys the muted/primary distinction entirely.
  // Solving against bg keeps every theme's muted distinguishable, lands 6.0-6.2:1
  // where the copy actually lives, and still leaves the sidebar above the AA
  // floor (worst case 4.53:1).
  const sidebarMuted = withAlpha(fg, alphaForContrast(fg, [theme.bg], 6));
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
