// Discord pack for the Omarchy web-app theming engine — declarative tier.
//
// Discord's current token generation is an elevation ladder, verified against
// the live logged-in app (2026-08-04, ~4,900 custom properties enumerated;
// computed values are oklab(), which is why the token hunt normalizes through
// a probe element):
//   --background-base-lowest  → server rail + channel sidebar (darkest chrome)
//   --background-base-lower   → chat pane + member list (the reading surface)
//   --background-base-low     → user panel (slightly elevated)
//   --background-surface-high/-higher/-highest → popovers, modals
//   --background-mod-subtle/-muted/-normal/-strong → hover/selection overlays
// plus semantic chat tokens (--chat-background, --channeltextarea-background),
// the mention pair, a numeric brand ladder (--brand-260..600, 500 = primary),
// and --text-link. The old --background-primary/secondary/tertiary generation
// is gone from current builds.
//
// Light/dark: Discord's Appearance → Theme → "Sync with computer" follows
// prefers-color-scheme, which the MAIN-world shim flips live on every omarchy
// theme apply — that's the supported configuration, same as WhatsApp's
// "System default".

OmarchyTheme.register({
  id: "discord",
  cssVars(theme, s) {
    const surfaceHigh = shade(s.bg, s.dir * 0.07);
    const surfaceHigher = shade(s.bg, s.dir * 0.09);
    const surfaceHighest = shade(s.bg, s.dir * 0.11);
    const inputBg = shade(s.sidebarBg, s.dir * 0.03);

    return {
      // Elevation ladder. The chat pane is the reading surface, so it gets the
      // terminal bg; the rail + channel sidebar share one token in Discord, so
      // they take the accent-tinted sidebar surface (same aesthetic as the
      // Slack pack's sidebar).
      "--background-base-lowest": s.sidebarBg,
      "--background-base-lower": s.bg,
      "--background-base-low": shade(s.bg, s.dir * 0.05),
      "--background-surface-high": surfaceHigh,
      "--background-surface-higher": surfaceHigher,
      "--background-surface-highest": surfaceHighest,

      // Hover / selection overlays (alpha, layered over the surfaces).
      "--background-mod-subtle": withAlpha(s.fg, 0.04),
      "--background-mod-muted": withAlpha(s.fg, 0.08),
      "--background-mod-normal": s.hoverBg,
      "--background-mod-strong": s.selectedBg,

      // Chat surfaces.
      "--chat-background": s.bg,
      "--chat-background-default": s.bg,
      "--channel-background-default": s.bg,
      "--channeltextarea-background": inputBg,

      // Mentions carry the accent instead of Discord's yellow/blurple.
      "--mention-background": withAlpha(s.accent, 0.22),
      "--mention-foreground": s.accent,

      // Brand ladder → accent (higher number = darker in Discord's scale).
      "--brand-260": shade(s.accent, 0.16),
      "--brand-360": shade(s.accent, 0.08),
      "--brand-500": s.accent,
      "--brand-560": shade(s.accent, -0.06),
      "--brand-600": shade(s.accent, -0.12),
      "--text-link": s.accent,
      // "N New" pills use --text-brand; the red ping badge keeps its urgency
      // semantics but in the theme's own red. Only the badge token is touched —
      // it shares its value with the danger/critical family, which must stay.
      "--text-brand": s.accent,
      "--badge-notification-background": (theme.colors || {}).red || s.accent,
    };
  },
});
