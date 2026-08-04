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

      // ----- Legacy chrome tokens -----
      "--neutralSecondarySurface": s.sidebarBg,
      "--neutralTertiarySurface": s.chromeBg,
      "--headerBackground": s.chromeBg,
      "--headerBackgroundSearch": s.chromeBg,
      "--headerButtonsBackground": s.chromeBg,
      "--headerButtonsBackgroundSearch": s.chromeBg,
      "--neutralLight": s.chromeBg,
      "--neutralLighter": s.sidebarBg,
    };
  },
});
