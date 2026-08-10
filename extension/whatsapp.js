// WhatsApp Web pack for the Omarchy web-app theming engine — the first
// DECLARATIVE pack: no CSS injection, no observers, no automation. WhatsApp
// themes itself through CSS custom properties, so we hand the engine a table
// mapping WhatsApp's own variables to the derived omarchy surfaces; the engine
// writes them inline-important on every theme apply.
//
// Every variable name below was verified against the live WhatsApp Web DOM
// (2026-08-04: enumerated ~2,964 custom properties from its stylesheets).
// WhatsApp runs two generations of tokens side by side — a legacy flat set
// (--app-background, --panel-background, --incoming-background, ...) and the
// newer WDS design system (--WDS-*), where each color token also has an -RGB
// twin holding a bare "r, g, b" triplet that the app composes with alpha. We
// set both generations, and both forms of the WDS tokens.
//
// Light/dark is not this pack's job: WhatsApp set to Settings → Theme →
// "System default" follows prefers-color-scheme, which the MAIN-world shim
// (inject-prefers-color-scheme.js) flips live on every omarchy theme apply.
// With WhatsApp pinned to an explicit Light/Dark instead, its text colors can
// disagree with our backgrounds when the omarchy theme crosses light↔dark —
// "System default" is the supported configuration.

OmarchyTheme.register({
  id: "whatsapp",
  cssVars(theme, s) {
    // Bare "r, g, b" triplet for WhatsApp's -RGB twins. hexToRgb also accepts
    // the rgb()/rgba() strings that shade()/mix() emit.
    const rgb = (c) => {
      const p = hexToRgb(c);
      return p ? `${p.r}, ${p.g}, ${p.b}` : null;
    };

    const incoming = shade(s.bg, s.dir * 0.07);
    const outgoing = mix(shade(s.bg, s.dir * 0.06), s.accent, 0.22);
    const composer = s.sidebarBg;
    const inputBg = shade(s.sidebarBg, s.dir * 0.03);
    // Accent-tinted opaque surface (the family behind the selected filter
    // chip, banners, and other "deemphasized accent" fills).
    const accentSoft = mix(s.bg, s.accent, 0.22);

    const vars = {
      // App frame + chat-list panel (legacy tokens).
      "--app-background": s.bg,
      "--app-background-deeper": shade(s.bg, s.dir * 0.03),
      "--app-background-stripe": s.chromeBg,
      "--ui-background": s.bg,
      "--surface-background": s.sidebarBg,
      "--navbar-background": s.chromeBg,
      "--nav-bar-background": s.chromeBg,
      "--panel-background": s.sidebarBg,
      "--panel-background-deep": s.chromeBg,
      "--panel-background-rgb": rgb(s.sidebarBg),
      "--panel-input-background": inputBg,
      "--background-default-rgb": rgb(s.bg),

      // WDS washes (app frame surfaces).
      "--WDS-app-wash": s.bg,
      "--WDS-background-wash-plain": s.bg,
      "--WDS-background-wash-plain-RGB": rgb(s.bg),
      "--WDS-background-wash-inset": shade(s.bg, s.dir * 0.02),
      "--WDS-background-wash-inset-RGB": rgb(shade(s.bg, s.dir * 0.02)),
      "--WDS-background-elevated-wash-plain": s.sidebarBg,
      "--WDS-background-elevated-wash-plain-RGB": rgb(s.sidebarBg),
      "--WDS-background-elevated-wash-inset": shade(s.sidebarBg, s.dir * 0.02),
      "--WDS-background-elevated-wash-inset-RGB": rgb(shade(s.sidebarBg, s.dir * 0.02)),

      // Conversation pane: base color under the doodle wallpaper + composer.
      "--WDS-systems-chat-background-wallpaper": s.bg,
      "--WDS-systems-chat-background-wallpaper-RGB": rgb(s.bg),
      "--WDS-systems-chat-surface-composer": composer,
      "--WDS-systems-chat-surface-composer-RGB": rgb(composer),
      "--text-input-bar-background": composer,
      "--input-background": inputBg,
      "--search-input-background": inputBg,

      // Message bubbles: incoming stays a neutral surface shade; outgoing
      // carries the accent tint (WhatsApp's own green otherwise).
      "--incoming-background": incoming,
      "--outgoing-background": outgoing,
      "--WDS-systems-bubble-surface-incoming": incoming,
      "--WDS-systems-bubble-surface-incoming-RGB": rgb(incoming),
      "--WDS-systems-bubble-surface-outgoing": outgoing,
      "--WDS-systems-bubble-surface-outgoing-RGB": rgb(outgoing),

      // WDS semantic surfaces — these are what actually paint the chat-list
      // pane (#pane-side → --WDS-surface-default) and the header row
      // (--WDS-components-surface-nav-bar / --WDS-surface-emphasized /
      // --WDS-systems-chat-surface-tray), found by resolving every custom
      // property at those elements and matching the painted color.
      "--WDS-surface-default": s.sidebarBg,
      "--WDS-surface-elevated-default": s.sidebarBg,
      "--WDS-surface-emphasized": s.chromeBg,
      "--WDS-surface-elevated-emphasized": s.chromeBg,
      "--WDS-components-surface-nav-bar": s.chromeBg,
      "--WDS-systems-chat-surface-tray": s.chromeBg,

      // Floating surfaces.
      "--dropdown-background": s.sidebarBg,
      "--popover-background": s.sidebarBg,

      // Accent family — WhatsApp's signature green becomes the omarchy accent
      // (unread badges, active filter chip, "today" timestamps, links).
      "--WDS-accent": s.accent,
      "--WDS-accent-RGB": rgb(s.accent),
      "--WDS-accent-emphasized": shade(s.accent, s.dir * 0.08),
      "--WDS-accent-emphasized-RGB": rgb(shade(s.accent, s.dir * 0.08)),
      "--WDS-accent-deemphasized": accentSoft,
      "--WDS-accent-deemphasized-RGB": rgb(accentSoft),
      "--WDS-content-action-emphasized": s.accent,
      "--WDS-content-external-link": s.accent,
      "--WDS-components-filter-surface-selected": accentSoft,
      "--avatar-background": mix(s.bg, s.accent, 0.25),
      // The unread badge paints via the "always branded" / positive tokens,
      // not --WDS-accent — WhatsApp's brand green family becomes the accent
      // (or the theme's own green for the success-semantic token).
      "--WDS-persistent-always-branded": s.accent,
      "--WDS-persistent-always-branded-RGB": rgb(s.accent),
    };

    // Default avatars (contacts/groups without images) draw from a fixed
    // family of profile-photo color tokens. Recolor each from the theme's own
    // terminal palette (the host's full colors.toml payload), so placeholder
    // avatars sit in the omarchy palette instead of WhatsApp's. Missing keys
    // just keep WhatsApp's color for that slot.
    const pal = theme.colors || {};
    // Success-semantic green: prefer the theme's green so "positive" things
    // stay green-ish when the palette has one; otherwise the accent.
    // Matched by HUE rather than by the slot's name — `pal.green` is an amber in
    // matte-black and a blue in lumon, either of which would make WhatsApp's
    // "positive" affordances read as something else. Falls back to the accent
    // (not a hardcoded green) so the pack stays theme-coherent as before.
    const positive = statusColor(pal, "success", [], s.accent);
    vars["--WDS-secondary-positive"] = positive;
    vars["--WDS-secondary-positive-RGB"] = rgb(positive);
    const avatarColors = {
      green: pal.green || s.accent,
      teal: pal.cyan || s.accent,
      "sky-blue": pal.bright_cyan || pal.cyan || s.accent,
      cobalt: pal.blue || s.accent,
      red: pal.red || s.accent,
      orange: pal.orange || pal.yellow || s.accent,
      yellow: pal.yellow || s.accent,
      pink: pal.bright_magenta || pal.magenta || s.accent,
      purple: pal.magenta || s.accent,
      brown: pal.brown || pal.yellow || s.accent,
      gray: mix(s.bg, s.fg, 0.55),
    };
    for (const [wa, color] of Object.entries(avatarColors)) {
      if (!color) continue;
      const surface = mix(s.bg, color, 0.3);
      vars[`--WDS-components-profile-photo-surface-${wa}`] = surface;
      vars[`--WDS-components-profile-photo-surface-${wa}-RGB`] = rgb(surface);
      vars[`--WDS-components-profile-photo-content-${wa}`] = color;
      vars[`--WDS-components-profile-photo-content-${wa}-RGB`] = rgb(color);
    }

    return vars;
  },
});
