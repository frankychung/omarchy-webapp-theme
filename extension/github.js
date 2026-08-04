// GitHub pack for the Omarchy web-app theming engine — declarative tier.
// GitHub (Primer) themes through CSS custom properties selected by
// data-color-mode / data-*-theme on <html>. We map Primer's semantic tokens
// to the derived omarchy surfaces; the engine writes them with !important on
// every element so they beat the light-*.css / dark-*.css attribute rules.
//
// Token names verified via Playwright against public github.com pages
// (2026-08-04: ~1,300 custom properties on repo pages; semantic surface is
// --bgColor-*, --fgColor-*, --borderColor-*, --header-*, --control-*,
// --overlay-*). Legacy --color-canvas-* / --color-fg-* names are largely gone.
//
// Light/dark: leave Appearance → Theme on "Sync with system" (data-color-mode
// auto). The MAIN-world prefers-color-scheme shim tracks omarchy, and
// onColorMode() also pins data-color-mode so any tokens we do not override
// still follow the omarchy light/dark crossing. An explicit Light/Dark choice
// in GitHub settings can disagree with our paints when omarchy flips.

OmarchyTheme.register({
  cssVars(theme, s) {
    // Inset is darker than the page on dark themes and slightly washed on light
    // (GitHub: #010409 vs #0d1117 dark; #f6f8fa vs #fff light).
    const bgInset = shade(s.bg, -s.dir * 0.04);
    const bgMuted = s.sidebarBg;
    const bgEmphasis = mix(s.bg, s.fg, s.isDark ? 0.22 : 0.78);
    const bgInverse = s.isDark ? shade(s.fg, -0.05) : mix(s.bg, s.fg, 0.88);
    const fgOnEmphasis = s.isDark ? s.bg : "#ffffff";
    const accentMuted = withAlpha(s.accent, s.isDark ? 0.15 : 0.12);
    const accentSubtle = withAlpha(s.accent, s.isDark ? 0.1 : 0.08);
    const controlRest = shade(s.sidebarBg, s.dir * 0.02);
    const controlHover = mix(controlRest, s.fg, s.isDark ? 0.08 : 0.06);
    const controlActive = mix(controlRest, s.fg, s.isDark ? 0.12 : 0.1);
    // Header: prefer omarchy chrome (browser toolbar tint) when present.
    const headerBg = s.chromeBg;
    const headerFg = s.isDark ? s.fg : mix(s.chromeBg, "#ffffff", 0.92);
    const headerFgMuted = withAlpha(headerFg, 0.7);
    const searchBg = shade(headerBg, s.dir * 0.06);
    const overlayBg = s.isDark ? bgInset : s.bg;
    const borderDefault = s.borderColor;
    const borderMuted = withAlpha(s.fg, 0.06);
    const borderEmphasis = withAlpha(s.fg, 0.2);

    // Soft status fills — keep Primer's hue roles but tint from the terminal
    // palette when the host sent colors.toml entries.
    const pal = theme.colors || {};
    const success = pal.green || "#3fb950";
    const danger = pal.red || "#f85149";
    const attention = pal.yellow || "#d29922";
    const done = pal.magenta || pal.bright_magenta || "#ab7df8";
    const open = pal.green || success;
    const closed = danger;

    return {
      // ----- Canvas / page surfaces -----
      "--bgColor-default": s.bg,
      "--bgColor-muted": bgMuted,
      "--bgColor-inset": bgInset,
      "--bgColor-emphasis": bgEmphasis,
      "--bgColor-inverse": bgInverse,
      "--bgColor-disabled": shade(s.bg, s.dir * 0.03),
      "--bgColor-transparent": "transparent",
      "--bgColor-neutral-muted": withAlpha(s.fg, s.isDark ? 0.12 : 0.08),
      "--bgColor-neutral-emphasis": mix(s.bg, s.fg, s.isDark ? 0.35 : 0.55),

      // Accent fills (links, primary buttons, selected chrome).
      "--bgColor-accent-emphasis": s.accent,
      "--bgColor-accent-muted": accentMuted,

      // Status emphasis / muted (issues, PRs, alerts) — palette-aware when
      // colors.toml is present; otherwise Primer-like defaults.
      "--bgColor-success-emphasis": success,
      "--bgColor-success-muted": withAlpha(success, 0.15),
      "--bgColor-danger-emphasis": danger,
      "--bgColor-danger-muted": withAlpha(danger, 0.15),
      "--bgColor-attention-emphasis": attention,
      "--bgColor-attention-muted": withAlpha(attention, 0.15),
      "--bgColor-done-emphasis": done,
      "--bgColor-done-muted": withAlpha(done, 0.15),
      "--bgColor-open-emphasis": open,
      "--bgColor-open-muted": withAlpha(open, 0.15),
      "--bgColor-closed-emphasis": closed,
      "--bgColor-closed-muted": withAlpha(closed, 0.15),

      // ----- Foreground -----
      "--fgColor-default": s.fg,
      "--fgColor-muted": s.sidebarMuted,
      "--fgColor-onEmphasis": fgOnEmphasis,
      "--fgColor-onInverse": s.isDark ? s.bg : s.fg,
      "--fgColor-disabled": withAlpha(s.fg, 0.4),
      "--fgColor-accent": s.accent,
      "--fgColor-link": s.accent,
      "--fgColor-success": success,
      "--fgColor-danger": danger,
      "--fgColor-attention": attention,
      "--fgColor-done": done,
      "--fgColor-open": open,
      "--fgColor-closed": closed,
      "--fgColor-neutral": s.sidebarMuted,

      // ----- Borders -----
      "--borderColor-default": borderDefault,
      "--borderColor-muted": borderMuted,
      "--borderColor-emphasis": borderEmphasis,
      "--borderColor-disabled": withAlpha(s.fg, 0.05),
      "--borderColor-accent-emphasis": s.accent,
      "--borderColor-accent-muted": withAlpha(s.accent, 0.4),
      "--borderColor-success-emphasis": success,
      "--borderColor-danger-emphasis": danger,
      "--borderColor-attention-emphasis": attention,
      "--borderColor-done-emphasis": done,
      "--borderColor-open-emphasis": open,
      "--borderColor-closed-emphasis": closed,
      "--borderColor-transparent": "transparent",

      // ----- App header -----
      "--header-bgColor": headerBg,
      "--header-fgColor-default": headerFgMuted,
      "--header-fgColor-logo": headerFg,
      "--header-borderColor-divider": withAlpha(headerFg, 0.12),
      "--headerSearch-bgColor": searchBg,
      "--headerSearch-borderColor": withAlpha(headerFg, 0.2),

      // ----- Controls (inputs, buttons at rest) -----
      "--control-bgColor-rest": controlRest,
      "--control-bgColor-hover": controlHover,
      "--control-bgColor-active": controlActive,
      "--control-bgColor-selected": controlRest,
      "--control-bgColor-disabled": shade(s.bg, s.dir * 0.02),
      "--control-fgColor-rest": s.fg,
      "--control-fgColor-placeholder": s.sidebarMuted,
      "--control-fgColor-disabled": withAlpha(s.fg, 0.4),
      "--control-iconColor-rest": s.sidebarMuted,
      "--control-borderColor-rest": borderDefault,
      "--control-borderColor-emphasis": borderEmphasis,
      "--control-borderColor-disabled": withAlpha(s.fg, 0.05),
      "--control-borderColor-selected": s.accent,
      "--control-borderColor-success": success,
      "--control-borderColor-danger": danger,
      "--control-borderColor-warning": attention,

      // Checked / primary-ish controls.
      "--control-checked-bgColor-rest": s.accent,
      "--control-checked-bgColor-hover": shade(s.accent, s.dir * 0.08),
      "--control-checked-bgColor-active": shade(s.accent, s.dir * 0.12),
      "--control-checked-bgColor-disabled": withAlpha(s.accent, 0.4),
      "--control-checked-fgColor-rest": fgOnEmphasis,
      "--control-checked-fgColor-disabled": withAlpha(fgOnEmphasis, 0.5),
      "--control-checked-borderColor-rest": s.accent,
      "--control-checked-borderColor-hover": shade(s.accent, s.dir * 0.08),
      "--control-checked-borderColor-active": shade(s.accent, s.dir * 0.12),
      "--control-checked-borderColor-disabled": withAlpha(s.accent, 0.4),

      // Transparent control variants (icon buttons, tabs).
      "--control-transparent-bgColor-rest": "transparent",
      "--control-transparent-bgColor-hover": s.hoverBg,
      "--control-transparent-bgColor-active": s.selectedBg,
      "--control-transparent-bgColor-selected": s.selectedBg,
      "--control-transparent-bgColor-disabled": "transparent",
      "--control-transparent-borderColor-rest": "transparent",
      "--control-transparent-borderColor-hover": "transparent",
      "--control-transparent-borderColor-active": "transparent",

      // ----- Focus + overlays -----
      "--focus-outlineColor": s.accent,
      "--focus-outline-color": s.accent,
      "--overlay-bgColor": overlayBg,
      "--overlay-borderColor": borderDefault,
      "--overlay-backdrop-bgColor": withAlpha("#000000", s.isDark ? 0.6 : 0.4),

      // Soft accent wash used by selected rows / filters in places.
      "--bgColorHover": accentSubtle,

      // ----- Primer Button components (Code, New issue, etc.) -----
      // Primary actions use the omarchy accent (not GitHub's success green).
      "--button-primary-bgColor-rest": s.accent,
      "--button-primary-bgColor-hover": shade(s.accent, s.dir * 0.08),
      "--button-primary-bgColor-active": shade(s.accent, s.dir * 0.12),
      "--button-primary-bgColor-disabled": withAlpha(s.accent, 0.4),
      "--button-primary-fgColor-rest": fgOnEmphasis,
      "--button-primary-fgColor-disabled": withAlpha(fgOnEmphasis, 0.5),
      "--button-primary-iconColor-rest": fgOnEmphasis,
      "--button-primary-iconColor-disabled": withAlpha(fgOnEmphasis, 0.5),
      "--button-primary-borderColor-rest": withAlpha("#ffffff", 0.15),
      "--button-primary-borderColor-hover": withAlpha("#ffffff", 0.15),
      "--button-primary-borderColor-active": withAlpha("#ffffff", 0.15),
      "--button-primary-borderColor-disabled": "transparent",

      "--button-default-bgColor-rest": controlRest,
      "--button-default-bgColor-hover": controlHover,
      "--button-default-bgColor-active": controlActive,
      "--button-default-bgColor-selected": controlActive,
      "--button-default-bgColor-disabled": shade(s.bg, s.dir * 0.02),
      "--button-default-fgColor-rest": s.fg,
      "--button-default-fgColor-disabled": withAlpha(s.fg, 0.4),
      "--button-default-borderColor-rest": borderDefault,
      "--button-default-borderColor-hover": borderDefault,
      "--button-default-borderColor-active": borderDefault,
      "--button-default-borderColor-disabled": withAlpha(s.fg, 0.05),

      "--button-invisible-fgColor-rest": s.fg,
      "--button-invisible-fgColor-hover": s.fg,
      "--button-invisible-fgColor-active": s.fg,
      "--button-invisible-fgColor-disabled": withAlpha(s.fg, 0.4),
      "--button-invisible-bgColor-hover": s.hoverBg,
      "--button-invisible-bgColor-active": s.selectedBg,
      "--button-invisible-iconColor-rest": s.sidebarMuted,
      "--button-invisible-iconColor-hover": s.sidebarMuted,

      "--button-danger-bgColor-rest": controlRest,
      "--button-danger-bgColor-hover": danger,
      "--button-danger-bgColor-active": shade(danger, s.dir * 0.08),
      "--button-danger-fgColor-rest": danger,
      "--button-danger-fgColor-hover": fgOnEmphasis,
      "--button-danger-fgColor-active": fgOnEmphasis,
      "--button-danger-iconColor-rest": danger,
      "--button-danger-iconColor-hover": fgOnEmphasis,

      "--button-outline-fgColor-rest": s.accent,
      "--button-outline-fgColor-hover": s.accent,
      "--button-outline-bgColor-hover": controlHover,
      "--button-outline-bgColor-active": s.accent,
      "--button-outline-fgColor-active": fgOnEmphasis,
    };
  },

  // Pin Primer's color-mode attributes when omarchy crosses light↔dark so
  // any token we do not map still tracks the right theme stylesheet branch.
  onColorMode(isDark) {
    const h = document.documentElement;
    h.setAttribute("data-color-mode", isDark ? "dark" : "light");
    if (!h.getAttribute("data-dark-theme")) {
      h.setAttribute("data-dark-theme", "dark");
    }
    if (!h.getAttribute("data-light-theme")) {
      h.setAttribute("data-light-theme", "light");
    }
  },
});
