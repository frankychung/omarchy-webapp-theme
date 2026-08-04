// Outlook Web pack for the Omarchy web-app theming engine — declarative tier.
//
// Outlook runs two token generations side by side, verified against the live
// mailbox (2026-08-04: 984 custom properties, 50 readable stylesheets, no
// iframes and effectively no shadow DOM, so plain var overrides reach
// everything):
//
//   Fluent v9 semantic tokens, with light-mode values that spell out the
//   elevation ladder — --colorNeutralBackground1 #ffffff (the reading pane and
//   cards) through 6 #e6e6e6, each with Hover/Pressed/Selected variants;
//   --colorNeutralForeground1..4 #242424→#707070; --colorNeutralStroke1..3;
//   and the --colorBrand* family (Microsoft blue #0f6cbd).
//
//   A legacy set that still paints real chrome: --neutralSecondarySurface
//   (#F5F5F5, the message list), --neutralTertiarySurface and
//   --headerBackground / --headerButtonsBackground (#F0F0F0, the folder rail
//   and header).
//
// The by-value hunt confirmed which token paints what: folder rail ←
// --headerBackground / --neutralTertiarySurface / Background4; message list and
// reading pane ← --neutralSecondarySurface / Background3.
//
// DELIBERATELY NOT REMAPPED: --white (401 uses) and --black (157 uses). They are
// literal colors used for icon fills, text on brand-colored buttons, and borders
// over saturated fills — repointing them at theme surfaces inverts contrast in
// places that must stay fixed. The semantic tokens above are the supported
// surface for theming; these two are not.
//
// Light/dark needs no automation: Outlook follows the system preference, which
// the MAIN-world shim (inject-prefers-color-scheme.js) flips on every omarchy
// theme apply.

OmarchyTheme.register({
  id: "outlook",

  cssVars(theme, s) {
    // Fluent's ladder runs lightest→darkest in light mode; shade() already
    // walks the correct direction for the active theme via s.dir.
    const bg2 = shade(s.bg, s.dir * 0.02);
    const bg5 = shade(s.bg, s.dir * 0.08);
    const bg6 = shade(s.bg, s.dir * 0.1);
    const hover = shade(s.bg, s.dir * 0.04);
    const pressed = shade(s.bg, s.dir * 0.07);
    const strokeStrong = withAlpha(s.fg, s.isDark ? 0.22 : 0.18);

    return {
      // ----- Fluent surfaces -----
      // 1 is the reading pane and every card/dialog; 3 is the message list; 4 is
      // the folder rail and header row.
      "--colorNeutralBackground1": s.bg,
      "--colorNeutralBackground1Hover": hover,
      "--colorNeutralBackground1Pressed": pressed,
      "--colorNeutralBackground1Selected": s.selectedBg,
      "--colorNeutralBackground2": bg2,
      "--colorNeutralBackground2Hover": hover,
      "--colorNeutralBackground2Pressed": pressed,
      "--colorNeutralBackground2Selected": s.selectedBg,
      "--colorNeutralBackground3": s.sidebarBg,
      "--colorNeutralBackground3Hover": s.hoverBg,
      "--colorNeutralBackground3Pressed": pressed,
      "--colorNeutralBackground3Selected": s.selectedBg,
      "--colorNeutralBackground4": s.chromeBg,
      "--colorNeutralBackground5": bg5,
      "--colorNeutralBackground6": bg6,
      "--colorNeutralBackgroundDisabled": bg2,

      // Subtle (transparent-by-default) button surfaces.
      "--colorSubtleBackgroundHover": s.hoverBg,
      "--colorSubtleBackgroundPressed": s.selectedBg,

      // ----- Fluent text -----
      "--colorNeutralForeground1": s.fg,
      "--colorNeutralForeground2": withAlpha(s.fg, 0.88),
      "--colorNeutralForeground3": s.sidebarMuted,
      "--colorNeutralForeground4": withAlpha(s.fg, 0.55),
      "--colorNeutralForegroundDisabled": withAlpha(s.fg, 0.38),

      // ----- Fluent borders -----
      "--colorNeutralStroke1": strokeStrong,
      "--colorNeutralStroke2": s.borderColor,
      "--colorNeutralStroke3": s.borderColor,

      // ----- Brand → accent -----
      // Background2 is the pale-blue selected/highlight wash, not a fill.
      "--colorBrandBackground": s.accent,
      "--colorBrandBackground2": withAlpha(s.accent, 0.15),
      "--colorBrandForeground1": s.accent,
      "--colorBrandForeground2": shade(s.accent, -s.dir * 0.08),

      // ----- Legacy Office theme palette -----
      // A third generation, and the busiest: --themePrimary alone has 376 uses
      // and paints the blue subject lines. The Lighter/LighterAlt end supplies
      // the message-list selection washes, so mapping these themes selection
      // through the token layer rather than by selector.
      "--themePrimary": s.accent,
      "--themeSecondary": shade(s.accent, s.dir * 0.06),
      "--themeTertiary": shade(s.accent, s.dir * 0.12),
      "--themeDarkAlt": shade(s.accent, -s.dir * 0.06),
      "--themeDark": shade(s.accent, -s.dir * 0.12),
      "--themeDarker": shade(s.accent, -s.dir * 0.18),
      "--themeLight": withAlpha(s.accent, 0.28),
      "--themeLighter": s.selectedBg,
      "--themeLighterAlt": s.hoverBg,

      // ----- Legacy chrome tokens -----
      // --neutralPrimarySurface is what actually paints the list header
      // ("Focused / Other", the sort controls) and the "Other Emails" summary
      // row — all of which have generated class names, so CDS matched-styles
      // was the only way to find the token behind them.
      "--neutralPrimarySurface": s.bg,
      "--neutralSecondarySurface": s.sidebarBg,
      "--neutralTertiarySurface": s.chromeBg,
      // The calendar grid's past / out-of-range time slots. Outlook offsets them
      // slightly from the live area rather than matching it (white vs #fafafa),
      // so keep a gentle offset instead of collapsing them onto the background —
      // otherwise past and upcoming hours become indistinguishable.
      "--neutralLighterAlt": shade(s.bg, s.dir * 0.03),
      "--headerBackground": s.chromeBg,
      "--headerBackgroundSearch": s.chromeBg,
      "--headerButtonsBackground": s.chromeBg,
      "--headerButtonsBackgroundSearch": s.chromeBg,
      "--neutralLight": s.chromeBg,
      "--neutralLighter": s.sidebarBg,
    };
  },

  // The message-list rows are the one surface the token layer can't reach: they
  // paint from --white, which is a LITERAL colour here — it stays #FFFFFF in dark
  // mode as well as light, and is used for icon fills and for text on
  // brand-coloured buttons, so remapping it inverts contrast where it matters.
  //
  // Their class names are generated (jGG6V.gDC9O.UWKUc), so the stable hook is
  // the ARIA role Outlook gives every list row. Hover and selection are already
  // handled through --themeLighter/--themeLighterAlt above; these rules only
  // supply the resting surface and act as a backstop for the other two.
  apply(theme, s) {
    let style = document.getElementById("omarchy-outlook-rows");
    if (!style) {
      style = document.createElement("style");
      style.id = "omarchy-outlook-rows";
      (document.head || document.documentElement).appendChild(style);
    }
    // The list header ("Focused / Other", the sort controls) and the "Other
    // Emails" summary row are white too, but every one of them has generated
    // class names (bkYAr, NISFx.dFpOt, …) that change between builds, so they
    // can't be targeted directly.
    //
    // Instead, REDEFINE --white locally on Outlook's stable data-app-section
    // containers. Custom properties inherit, so everything inside those regions
    // that resolves var(--white) picks up the theme surface, while --white stays
    // literally white everywhere else — which is what the app-launcher icons and
    // the text on brand-coloured buttons need. No class names involved.
    const regions = [
      '[data-app-section="MessageList"]',
      '[data-app-section="NavigationPane"]',
      '[data-app-section="Ribbon"]',
      '[data-app-section="MailReadCompose"]',
      '[data-app-section="ConversationContainer"]',
      // Calendar carries its own set of section names.
      '[data-app-section="CalendarModule"]',
      '[data-app-section="CalendarModuleSurface"]',
      '[data-app-section="CalendarSurfaceNavigationToolbar"]',
      '[data-app-section^="Surface_"]',
      '[data-app-section^="calendar-view"]',
    ].join(", ");
    style.textContent = [
      regions + " { --white: " + s.bg + "; }",
      '[role="option"] { background-color: ' + s.bg + " !important; }",
      '[role="option"]:hover { background-color: ' + s.hoverBg + " !important; }",
      '[role="option"][aria-selected="true"] { background-color: ' + s.selectedBg + " !important; }",
      // The list's own scroll container and the date group headers sit behind
      // the rows and pick up the same literal white.
      '[role="listbox"], [role="grid"] { background-color: ' + s.bg + " !important; }",
    ].join("\n");
  },
});
