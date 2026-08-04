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

// ----------------------------------------------------------------- page scope --
// GitHub's marketing site is a different product from the app: it ships its own
// --brand-* design system and deliberately mixes dark and light hero pages —
// stock GitHub renders /features/copilot and /enterprise on #000 but
// /open-source and /pricing on #fff. Repainting all of them onto one omarchy
// surface flattens that design rather than theming it, so we opt out entirely.
//
// Classified by GitHub's OWN routing, not by a URL prefix list (which would rot
// as pages are added): every marketing route's Rails controller is named site_*
//   site_landing_pages   /features/*, /open-source, /enterprise, /solutions,
//                        /security, /about, /mobile
//   site_pricing         /pricing
//   site_resources_types /resources/*
//   site_team            /team
//   site_customer_stories /customer-stories
// while app routes are files, issues, profiles, codesearch, topics,
// gists_listings. The lone exception is the homepage: it reports `dashboard`
// either way, but signed OUT that is the marketing splash, and signed IN it is
// the real dashboard we do want themed — so that one also tests body.logged-out.
function isMarketingPage() {
  const meta = document.querySelector('meta[name="route-controller"]');
  if (meta && /^site_/.test(meta.content || "")) return true;
  return (
    location.pathname === "/" &&
    !!document.body &&
    document.body.classList.contains("logged-out")
  );
}

// This pack runs at document_start, before <head> is parsed, so the meta above
// does not exist yet. Opting out is simply never registering: the engine holds a
// pushed theme for as long as no pack has registered and replays it on register,
// so waiting costs nothing and a marketing page gets no side effects at all —
// no vars, no color-scheme, no shim event. Deciding on the meta rather than on
// DOMContentLoaded keeps the app-page path fast; it lands within the first few
// chunks of <head>, so there is no flash of unthemed GitHub.
function registerWhenClassified(pack) {
  const done = () => {
    obs.disconnect();
    if (!isMarketingPage()) OmarchyTheme.register(pack);
  };
  const tryDecide = () => {
    // The homepage test needs <body> for its class list. Everywhere else the
    // meta is enough — or a parsed <body>, which means <head> finished and no
    // such meta exists.
    if (location.pathname === "/") {
      if (document.body) done();
      return;
    }
    if (document.querySelector('meta[name="route-controller"]') || document.body) {
      done();
    }
  };
  const obs = new MutationObserver(tryDecide);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  tryDecide();
}

registerWhenClassified({
  id: "github",
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
    // The header foreground has to contrast with the HEADER background, which is
    // omarchy's browser-chrome tint and NOT necessarily the page bg. Light
    // omarchy themes ship a light chrome (flexoki-light: bg #FFFCF0, chrome
    // #f2f0e5), so keying this off the page's dark/light reading painted a
    // near-white foreground onto a near-white header — 1.09:1, i.e. an invisible
    // nav and search icon. Read the header's own luminance instead. Reuse the
    // theme fg when it lands on the right side, else fall back to a pole.
    const headerRgb = hexToRgb(headerBg);
    const headerIsDark = headerRgb ? relLuminance(headerRgb) < 0.5 : s.isDark;
    const headerFg = headerIsDark
      ? s.isDark
        ? s.fg
        : "#ffffff"
      : s.isDark
        ? "#1f1f1f"
        : s.fg;
    const headerFgMuted = withAlpha(headerFg, 0.7);
    const searchBg = shade(headerBg, s.dir * 0.06);
    const overlayBg = s.isDark ? bgInset : s.bg;
    const borderDefault = s.borderColor;
    const borderMuted = withAlpha(s.fg, 0.06);
    const borderEmphasis = withAlpha(s.fg, 0.2);

    // Marketing/brand surfaces. GitHub's logged-out chrome is a separate design
    // system from Primer (--brand-* rather than --bgColor-*), and its dark
    // branch is pure #000 on a near-white/near-black scale, so it needs its own
    // ramp rather than a reuse of the Primer surfaces above.
    const brandCanvasMuted = shade(s.bg, s.dir * 0.02);
    const brandCanvasSubtle = shade(s.bg, s.dir * 0.05);
    const brandCanvasOverlay = shade(s.bg, s.dir * 0.1);
    const brandNeutral = mix(s.bg, s.fg, s.isDark ? 0.45 : 0.55);
    // The mega-menu leans on muted text for every item's description, so it
    // carries real copy rather than incidental labels. The pack's usual muted
    // alpha (0.65) only reaches ~3.0:1 on light themes; hold it closer to fg
    // there so the menu stays readable.
    const brandTextMuted = withAlpha(s.fg, s.isDark ? 0.65 : 0.82);

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

      // ----- Marketing / brand tokens (--brand-*) -----
      // The logged-out header, its mega-menu dropdowns, and github.com's
      // marketing pages are built on this family, NOT on the Primer tokens
      // above. Their rules read e.g.
      //   background-color: var(--brand-color-canvas-default, var(--bgColor-default))
      // and because GitHub *does* define --brand-color-canvas-default, that
      // Primer fallback is never reached — so without these the whole
      // logged-out chrome ignores the theme. Its dark branch is #000, which
      // reads as an unthemed black slab next to any omarchy background.
      //
      // Only the ~37 --brand-color-* PRIMITIVES are worth mapping. GitHub also
      // ships ~560 per-component tokens (--brand-Accordion-*, --brand-ActionMenu-*,
      // …) but those are build-time-resolved literals, not var() references to
      // these primitives, so overriding the primitives does not reach them.
      // Map more only when a specific component is seen to need it.
      "--brand-color-canvas-default": s.bg,
      "--brand-color-canvas-muted": brandCanvasMuted,
      "--brand-color-canvas-subtle": brandCanvasSubtle,
      "--brand-color-canvas-inset": bgInset,
      "--brand-color-canvas-overlay": brandCanvasOverlay,
      "--brand-color-canvas-invert": s.fg,

      "--brand-color-text-default": s.fg,
      "--brand-color-text-muted": brandTextMuted,
      "--brand-color-text-subtle": brandTextMuted,
      "--brand-color-text-onEmphasis": fgOnEmphasis,
      "--brand-color-text-emphasized": s.accent,
      "--brand-color-text-link-rest": s.accent,
      "--brand-color-text-link-pressed": shade(s.accent, s.dir * 0.12),
      "--brand-color-text-danger": danger,
      "--brand-color-text-error": danger,

      "--brand-color-border-default": borderDefault,
      "--brand-color-border-muted": borderMuted,
      "--brand-color-border-subtle": withAlpha(s.fg, 0.12),

      "--brand-color-accent-primary": s.accent,
      "--brand-color-accent-secondary": pal.yellow || pal.orange || attention,
      "--brand-color-focus": s.accent,

      "--brand-color-neutral-emphasis": brandNeutral,
      "--brand-color-neutral-emphasisPlus": brandNeutral,
      "--brand-color-neutral-muted": brandTextMuted,
      "--brand-color-neutral-subtle": brandTextMuted,

      "--brand-color-success-emphasis": success,
      "--brand-color-success-fg": success,
      "--brand-color-success-muted": withAlpha(success, 0.15),
      "--brand-color-success-subtle": withAlpha(success, 0.25),
      "--brand-color-danger-emphasis": danger,
      "--brand-color-danger-fg": danger,
      "--brand-color-danger-muted": withAlpha(danger, 0.15),
      "--brand-color-danger-subtle": withAlpha(danger, 0.25),
      "--brand-color-error-emphasis": danger,
      "--brand-color-error-fg": danger,
      "--brand-color-error-muted": withAlpha(danger, 0.15),
      "--brand-color-error-subtle": withAlpha(danger, 0.25),

      // Floating panels (the mega-menu dropdowns) draw their 1px ring from
      // this, hardcoded to Primer's blue-gray. Re-tint it or every dropdown
      // keeps a cold outline against a warm theme.
      "--shadow-floating-small": `0 0 0 1px ${borderDefault}, 0 6px 12px -3px ${withAlpha(
        "#000000",
        0.4
      )}, 0 6px 18px 0 ${withAlpha("#000000", 0.4)}`,
    };
  },

  // A few logged-out-header rules pick tokens whose *meaning* does not match
  // where they are used, so no value we assign the token can satisfy both
  // callers. Those have to be overridden per-selector instead.
  apply() {
    const css = `
/* ===== logged-out header search ===== */
/* GitHub fills the magnifier with --fgColor-onEmphasis:
     body:not(.header-white) .HeaderMenu .search-input .header-search-button svg
   That token means "text drawn ON an emphasis fill", so on a dark theme it is
   correctly the page background — but here the icon sits on the HEADER, not on
   an accent fill, so honoring it paints bg-on-bg and the icon vanishes. We
   cannot retune --fgColor-onEmphasis without wrecking every accent button, so
   repoint just this icon at the header foreground. */
html body:not(.header-white) .HeaderMenu .search-input .header-search-button svg {
  fill: var(--header-fgColor-default) !important;
}
/* The collapsed/expanded placeholder is hardcoded to rgba(255,255,255,.75),
   which disappears against a light omarchy header. */
html body .HeaderMenu .search-input .header-search-button.placeholder,
html body .HeaderMenu .search-input .search-with-dialog {
  color: var(--header-fgColor-default) !important;
}
`;
    let style = document.getElementById("omarchy-github-css");
    if (!style) {
      style = document.createElement("style");
      style.id = "omarchy-github-css";
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
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
