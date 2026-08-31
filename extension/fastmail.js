// Fastmail pack for the Omarchy web-app theming engine — declarative tier.
//
// Fastmail's web client themes through one of the most regular token systems in
// this repo: a `--ui-<component>-color-<role>[-<state>]` naming scheme with a
// small `--theme-color-*` layer above it that the account's own colour theme
// writes into. Verified live 2026-08-31, logged in, against app.fastmail.com —
// 296 custom properties enumerated across both polarities, 216 of them
// colour-valued. Four measurements decide the shape of this pack:
//
//   (1) ZERO triplet-valued tokens. Nothing is consumed as `rgb(var(--x))`, so
//       every token takes a real colour and the format trap that shaped the
//       Slack and HEY packs does not exist here.
//   (2) 196 of 1741 elements carry a `style` attribute and exactly ONE of them
//       is colour-valued; zero carry an inline `!important`. The engine's
//       inline-important redefinition wins everywhere, so there is no observer
//       or rAF repaint path in this pack.
//   (3) Light/dark rides prefers-color-scheme with no automation: Fastmail
//       stamps `t-light` / `t-dark` on <html> at boot, which the MAIN-world shim
//       drives. Verified by emulating the media feature before navigation and
//       observing the class flip. Nothing to pin, so there is no onColorMode.
//   (4) That class also means every token this pack does NOT map still resolves
//       to a polarity-correct value. Leaving something alone here is safe in a
//       way it would not be on a site that only ships one palette.
//
// FASTMAIL'S OWN COLOUR THEME IS OVERRIDDEN, deliberately. Picking a theme in
// Fastmail's settings rewrites `--theme-color-header` and friends (an account on
// a colour theme resolves the header to #243959 rather than the default grey),
// and this pack writes over that. The content rule this repo follows protects
// content authored by someone ELSE — a sender's HTML, a mod's community colours.
// A Fastmail colour theme is the user's own choice about chrome, and installing
// this extension is a later and more specific choice about the same chrome, so
// the extension wins. Slack's pack overrides Slack's theme picker on exactly
// this reasoning.
//
// One methodology note for whoever edits this next: `page.goto` must use
// `waitUntil: "commit"`. Fastmail's service worker keeps the load event pending
// indefinitely, so `domcontentloaded` and `load` both hang the harness.

// Fastmail's shipped status hues, kept per-polarity as the fallback for palettes
// that have nothing honest to offer a role (`white`, `vantablack`, `lumon`).
// Sampled from the live app's `-color-fg` tokens, which are the values tuned to
// read on Fastmail's own page background in each mode.
const FASTMAIL_STATUS = {
  danger: { dark: "#dc818f", light: "#b9031f" },
  success: { dark: "#8abd99", light: "#147b33" },
  attention: { dark: "#ffe083", light: "#ffc107" },
};

OmarchyTheme.register({
  id: "fastmail",

  cssVars(theme, s) {
    const dir = s.dir;
    const bg = theme.bg;
    const fg = s.fg;
    const accent = s.accent;

    // Surface ladder. Fastmail separates its own surfaces by going DARKER in
    // both polarities (a #fafafa popover on a #fff page, a #121416 one on a
    // #1b1e20 page). Every other pack in this repo instead moves AWAY from the
    // page — lighter on dark themes, darker on light ones — and that is what
    // `dir` encodes. Follow the repo, not the app: on `vantablack` and `white`
    // there is no headroom in Fastmail's direction at all and the whole ladder
    // would collapse onto the page.
    const recessed = shadeAway(bg, -dir * 0.03); // outer canvas behind the panes
    const hoverBg = shade(bg, dir * 0.04);
    const focusedBg = shade(bg, dir * 0.07);
    const activeBg = shade(bg, dir * 0.09);
    const layerBg = shade(bg, dir * 0.05); // modals, popovers, menus

    // Accent ramp. Fastmail's is a five-stop scale and the app leans on all of
    // it: 100 is the base, 110/120 are hover/active, 60 is a muted outline and
    // 10 is the faint wash behind a selected row.
    const accentHover = shade(accent, dir * 0.06);
    const accentActive = shade(accent, dir * 0.12);
    const accentMuted = mix(accent, bg, 0.45);
    const accentWash = mix(bg, accent, 0.14);
    const onAccent = inkOn(accent, [bg, fg]);

    const chromeFg = inkOn(s.chromeBg, [fg, bg]);
    const disabledFg = withAlpha(fg, 0.45);
    const disabledBg = mix(bg, fg, 0.35);

    // Fastmail's toast is INVERSE in both polarities — a near-black sheet with
    // white text sits over the light theme too. That is a deliberate "this is
    // transient, it is not part of the page" signal, so reproduce the inversion
    // rather than the literal colours.
    const toastBg = mix(bg, fg, 0.85);
    const toastFg = inkOn(toastBg, [bg, fg]);

    const status = statusPalette(theme.colors || {}, {
      danger: FASTMAIL_STATUS.danger[s.isDark ? "dark" : "light"],
      success: FASTMAIL_STATUS.success[s.isDark ? "dark" : "light"],
      attention: FASTMAIL_STATUS.attention[s.isDark ? "dark" : "light"],
      // `done` is computed but unspent: Fastmail's "informative" role resolves
      // to the SAME value as its accent (both #0067b9 in light), so informative
      // rides the theme accent below instead of a fourth searched hue. It is
      // still passed so the distinctness pass sees the full role set.
      done: "#0067b9",
    });
    const danger = status.danger;
    const success = status.success;
    const attention = status.attention;

    // Status surface recipe, shared by critical / success / warning /
    // informative, all of which ship the same bg / border / fg / fg-strong
    // quartet. fg is the hue itself — it was authored to read on the terminal
    // background, which is exactly the surface it lands on here. fg-strong then
    // pushes further from the page in whichever direction `dir` points.
    const wash = (hue) => mix(bg, hue, 0.12);
    const edge = (hue) => mix(bg, hue, 0.4);
    const strong = (hue) => shade(hue, dir * 0.15);

    const highlightBg = mix(bg, attention, 0.3);

    return {
      // ===== account theme layer =====
      // The app's own colour-theme surface. --theme-color-header doubles as the
      // top bar and the source --ui-pageheader-color-bg reads from, so both are
      // written; chromeBg carries omarchy's chromium.theme tint where the theme
      // ships one, which is what makes the top bar match the browser toolbar.
      "--theme-color-header": s.chromeBg,
      "--theme-color-header-fg": chromeFg,
      "--theme-color-headerStop": mix(s.chromeBg, bg, 0.5),
      "--theme-color-sidebar": s.sidebarBg,
      "--theme-color-sidebar-accent": mix(s.sidebarBg, accent, 0.2),
      "--theme-color-accent-10": accentWash,
      "--theme-color-accent-60": accentMuted,
      "--theme-color-accent-100": accent,
      "--theme-color-accent-110": accentHover,
      "--theme-color-accent-120": accentActive,

      // ===== page surfaces =====
      "--ui-page-color-bg": bg,
      "--ui-page-color-bg-active": activeBg,
      "--ui-page-color-bg-focused": focusedBg,
      "--ui-page-color-bg-hover": hoverBg,
      "--ui-page-color-bg-selected": accentWash,
      "--ui-page-color-bg-backdrop": recessed,
      // The fade ladder is PRE-COMPOSITED: Fastmail ships each rung as an
      // opaque-to-transparent wash of the page colour itself (hsla(0,0%,100%,.6)
      // in light, rgba(27,30,32,.6) in dark) and uses them for scroll masks and
      // sticky-header fades. Regenerate the whole ladder from our background or
      // a white halo survives at the top of every scrolling list.
      "--ui-page-color-bg-fade0": withAlpha(bg, 0),
      "--ui-page-color-bg-fade20": withAlpha(bg, 0.2),
      "--ui-page-color-bg-fade40": withAlpha(bg, 0.4),
      "--ui-page-color-bg-fade60": withAlpha(bg, 0.6),
      "--ui-page-color-bg-fade80": withAlpha(bg, 0.8),
      "--ui-page-color-bg-fade90": withAlpha(bg, 0.9),
      "--ui-page-color-bg-fade100": bg,
      "--ui-page-color-bg-backdrop-fade0": withAlpha(recessed, 0),
      "--ui-page-color-border": withAlpha(fg, 0.28),
      "--ui-page-color-border-medium": withAlpha(fg, 0.18),
      "--ui-page-color-border-subtle": withAlpha(fg, 0.1),
      "--ui-page-color-fg": fg,
      "--ui-page-color-fg-action": accent,
      // Fastmail's "inverse" ink is the page background, not white — it is spent
      // on text that sits on a filled accent or a dark chip.
      "--ui-page-color-fg-inverse": bg,
      "--ui-page-color-fg-subtle": s.sidebarMuted,
      "--ui-page-color-fg-vsubtle": withAlpha(fg, alphaForContrast(fg, [bg], 4.5)),

      // ===== top bar and sidebar =====
      "--ui-pageheader-color-bg": s.chromeBg,
      "--ui-pageheader-search-color-border": withAlpha(chromeFg, 0.14),
      "--ui-pageheader-search-color-border-hover": withAlpha(chromeFg, 0.24),
      "--ui-sidebar-color-bg": s.sidebarBg,
      "--ui-sidebar-color-bg-selected": s.selectedBg,
      "--ui-sidebar-color-fg": s.sidebarFg,

      // ===== floating and secondary surfaces =====
      "--ui-layer-color-bg": layerBg,
      "--ui-layer-color-bg-withblur": withAlpha(layerBg, 0.85),
      "--ui-layer-color-border": withAlpha(fg, 0.14),
      "--ui-layer-color-border-divider": withAlpha(fg, 0.1),
      "--ui-altsurface-color-bg": hoverBg,
      "--ui-altsurface-color-bg-focused": focusedBg,
      "--ui-card-color-border": withAlpha(fg, 0.12),
      "--ui-badge-color-bg": focusedBg,
      "--ui-badge-color-border-divider": withAlpha(fg, 0.1),
      "--ui-accordian-bg": hoverBg,
      "--ui-accordian-bg-done": withAlpha(hoverBg, 0.6),
      "--ui-drawer-handle-bg": withAlpha(fg, 0.3),
      "--ui-invitationicon-color-bg": withAlpha(fg, 0.1),
      "--ui-kbfocus-color-fg": accentMuted,
      "--ui-loading-color-fg": accent,
      "--ui-splash-color-stop1": mix(bg, accent, 0.35),
      "--ui-splash-color-stop2": mix(bg, accent, 0.12),
      // The "+3 more" chip on a stacked avatar row — a count, not an identity
      // colour, so unlike --ui-avatar-color-fg-* it is chrome and gets themed.
      "--ui-avatar-color-bg-more": focusedBg,

      // ===== buttons: cta (accent-filled) =====
      "--ui-button-cta-color-bg": accent,
      "--ui-button-cta-color-bg-hover": accentHover,
      "--ui-button-cta-color-bg-active": accentActive,
      "--ui-button-cta-color-bg-disabled": disabledBg,
      "--ui-button-cta-color-fg": onAccent,
      "--ui-button-cta-color-border-focus": accentWash,
      "--ui-button-cta-color-outline-focus": accentMuted,
      "--ui-button-cta-color-danger-bg": danger,
      "--ui-button-cta-color-danger-bg-hover": shade(danger, dir * 0.06),
      "--ui-button-cta-color-danger-bg-active": shade(danger, dir * 0.12),
      "--ui-button-cta-color-danger-border-focus": mix(bg, danger, 0.18),
      "--ui-button-cta-color-danger-outline-focus": mix(danger, bg, 0.4),

      // ===== buttons: danger (text) =====
      "--ui-button-danger-color-fg": danger,
      "--ui-button-danger-color-border-focus": mix(bg, danger, 0.3),
      "--ui-button-danger-color-outline-focus": mix(danger, bg, 0.45),

      // ===== buttons: selected =====
      "--ui-button-selected-color-bg": accentWash,
      "--ui-button-selected-color-border": accent,
      "--ui-button-selected-color-fg": fg,

      // ===== buttons: simple (bordered) =====
      // The bg rungs stay rgba() inks rather than opaque mixes so a simple
      // button reads the same whether it lands on the page, the sidebar or a
      // popover — all three surfaces exist in this app and all three are used.
      "--ui-button-simple-color-bg": withAlpha(fg, 0.1),
      "--ui-button-simple-color-bg-hover": withAlpha(fg, 0.15),
      "--ui-button-simple-color-bg-active": withAlpha(fg, 0.2),
      "--ui-button-simple-color-bg-disabled": bg,
      "--ui-button-simple-color-border-disabled": withAlpha(fg, 0.18),
      "--ui-button-simple-color-border-focus": accent,
      "--ui-button-simple-color-fg": fg,
      "--ui-button-simple-color-fg-active": accent,
      "--ui-button-simple-color-fg-disabled": disabledFg,
      "--ui-button-simple-color-outline-focus": accent,

      // ===== buttons: subtle (ghost) =====
      "--ui-button-subtle-color-bg-hover": withAlpha(fg, 0.08),
      "--ui-button-subtle-color-bg-active": withAlpha(fg, 0.14),
      "--ui-button-subtle-color-border-focus": accent,
      "--ui-button-subtle-color-fg": s.sidebarMuted,
      "--ui-button-subtle-color-fg-hover": fg,
      "--ui-button-subtle-color-fg-disabled": disabledFg,
      "--ui-button-subtle-color-outline-focus": accent,

      // ===== inputs =====
      "--ui-input-color-bg": bg,
      "--ui-input-color-bg-active": hoverBg,
      "--ui-input-color-border": withAlpha(fg, 0.3),
      "--ui-input-color-border-hover": withAlpha(fg, 0.45),
      "--ui-input-color-border-error": danger,
      "--ui-input-activated-color-bg": accent,
      "--ui-input-activated-color-bg-hover": accentHover,
      "--ui-input-activated-color-fg": onAccent,
      "--ui-input-disabled-color-bg": hoverBg,
      "--ui-input-disabled-color-border": withAlpha(fg, 0.15),
      "--ui-input-disabled-color-fg": disabledFg,
      "--ui-input-focused-color-border": accent,
      "--ui-input-focused-color-outline": accentMuted,
      // Pre-composited like the page fades: the .4 wash of the focus ring.
      "--ui-input-focused-color-outline-fade40": withAlpha(accentMuted, 0.4),
      "--ui-input-icon-color-stroke": s.sidebarMuted,
      "--ui-input-icon-color-stroke-hover": fg,
      "--ui-toggle-color-bg": mix(bg, fg, 0.55),
      "--ui-toggle-color-bg-hover": mix(bg, fg, 0.75),
      "--ui-toggle-color-bg-disabled": mix(bg, fg, 0.3),

      // ===== icons =====
      // Semantic icons keep their MEANING and take their hue from the theme:
      // the pin is the danger role, the star the attention role, the unread dot
      // the accent. statusPalette falls back to Fastmail's own values when the
      // palette has nothing chromatic enough, so a monochrome theme gets a red
      // pin rather than a grey one indistinguishable from an unpinned row.
      "--ui-icon-color-stroke": fg,
      "--ui-icon-pin-color-fill": danger,
      "--ui-icon-pin-color-stroke": danger,
      "--ui-icon-star-color-fill-on": attention,
      "--ui-icon-star-color-stroke-on": attention,
      "--ui-icon-star-color-stroke-off": s.sidebarMuted,
      "--ui-icon-unread-color-fill-isunread": accent,
      "--ui-icon-unread-color-fill-isread": s.sidebarMuted,
      "--ui-bottomtoolbar-icon-color-primary": fg,
      "--ui-bottomtoolbar-icon-color-secondary": s.sidebarMuted,

      // ===== status surfaces =====
      "--ui-critical-color-bg": wash(danger),
      "--ui-critical-color-border": edge(danger),
      "--ui-critical-color-fg": danger,
      "--ui-critical-color-fg-strong": strong(danger),
      "--ui-success-color-bg": wash(success),
      "--ui-success-color-border": edge(success),
      "--ui-success-color-fg": success,
      "--ui-success-color-fg-strong": strong(success),
      "--ui-warning-color-bg": wash(attention),
      "--ui-warning-color-border": edge(attention),
      "--ui-warning-color-fg": attention,
      "--ui-warning-color-fg-strong": strong(attention),
      "--ui-informative-color-bg": wash(accent),
      "--ui-informative-color-bg-fade0": withAlpha(mix(bg, accent, 0.12), 0),
      "--ui-informative-color-bg-selected": mix(bg, accent, 0.3),
      "--ui-informative-color-border": edge(accent),
      "--ui-informative-color-fg": accent,
      "--ui-informative-color-fg-strong": strong(accent),
      "--ui-verified-color-fg": success,

      // ===== accent-toned one-offs =====
      "--ui-today-color-bg": mix(bg, accent, 0.14),
      "--ui-today-color-border": withAlpha(accent, 0.4),
      "--ui-today-color-fg": accent,
      "--ui-setupbanner-bg": mix(bg, accent, 0.08),
      "--ui-setupbannertoggle-color-bg": mix(bg, fg, 0.5),
      "--ui-setupbannertoggle-color-bg-hover": mix(bg, fg, 0.7),
      "--ui-setupbannertoggle-color-fg": inkOn(mix(bg, fg, 0.5), [bg, fg]),
      "--ui-setupbannertoggle-color-fg-hover": inkOn(mix(bg, fg, 0.7), [bg, fg]),

      // ===== attention-toned one-offs =====
      // Fastmail ships the search highlight ASYMMETRICALLY — light mode tints
      // the background and leaves the ink alone, dark mode tints the ink and
      // leaves the background transparent. Write both rungs in both modes so a
      // match is the same chip either way; that needs the ink solved against the
      // chip rather than inherited.
      "--ui-highlight-color-bg": highlightBg,
      "--ui-highlight-color-fg": inkOn(highlightBg, [fg, bg]),
      "--ui-memo-color-bg-stop1": withAlpha(attention, 0.3),
      "--ui-memo-color-bg-stop2": withAlpha(attention, 0.18),
      "--ui-memo-color-fg": fg,
      "--ui-snooze-color-bg": mix(bg, attention, 0.1),
      "--ui-snooze-color-border": mix(bg, attention, 0.35),
      "--ui-snooze-color-fg": attention,
      "--ui-diff-color-bg": mix(bg, attention, 0.25),
      "--ui-newicon-bg": attention,
      "--ui-newicon-fg": inkOn(attention, [bg, fg]),

      // ===== toasts =====
      "--ui-notification-color-bg": toastBg,
      "--ui-notification-color-fg": toastFg,
      "--ui-notification-action-color-bg": withAlpha(toastFg, 0.1),
      "--ui-notification-action-color-bg-hover": withAlpha(toastFg, 0.15),
      "--ui-notification-action-color-bg-active": withAlpha(toastFg, 0.2),
      "--ui-notification-action-color-bg-disabled": withAlpha(toastFg, 0.07),
      "--ui-notification-action-color-fg": toastFg,
      "--ui-notification-action-color-fg-disabled": withAlpha(toastFg, 0.7),
    };
  },
});

// DELIBERATELY UNMAPPED, and none of it is an oversight. Every token below still
// resolves through Fastmail's own `t-light` / `t-dark` class, so leaving it
// alone yields a polarity-correct value rather than a stranded one:
//
//   --ui-avatar-color-fg-1..15   Identity colouring. Fifteen well-separated hues
//                                assigned per contact; an omarchy palette has at
//                                most eight chromatic slots, so recolouring
//                                would collide two contacts onto one colour and
//                                destroy the only thing the hue is for. Same
//                                call as Reddit's --color-identity-*.
//   --ui-quote-color-bg/fg-1..5  Quote nesting levels, which live INSIDE the
//                                message body. Received mail is authored by the
//                                sender and this repo does not transform it —
//                                the same line HEY's pack draws.
//   --ui-icon-emoji-color-fill-* Emoji glyph fills. Identical in both polarities,
//                                which is the app telling us they are literals,
//                                not surfaces.
//   --ui-featureonboarding-*     Promotional onboarding art: gold gradients,
//   --ui-featuretour-*           layered icon shadows and tour callouts, 22
//   --ui-newfeatureicon-*        tokens' worth. Transient, off the daily path,
//                                and several are multi-stop gradients whose
//                                stops only make sense together.
