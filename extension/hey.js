// HEY pack for the Omarchy web-app theming engine — declarative tier.
// Covers HEY email AND HEY Calendar: they are one Rails app at app.hey.com
// sharing one token system (the calendar's 18 stylesheets make 192
// var(--color-*) references and contain 2 hardcoded hex values in 90KB), so a
// single pack themes both.
//
// Verified against the live app (2026-08-18: 259 custom properties resolving on
// <html>, 147 stylesheets, no shadow DOM). HEY is the friendliest target in this
// repo by a wide margin: 9 of 948 elements carry a style attribute, only ONE of
// those is colour-valued, and there is not a single inline !important on the
// page. Nothing here needs the inline-painting or observer machinery that Slack
// (content.js) and Outlook (outlook.js) require.
//
// TWO TOKEN LAYERS, AND THE FORMATS DIFFER — this is the one real trap:
//
//   --rgb-*    bare "r, g, b" TRIPLETS (--rgb-ink: 35, 28, 51), composited at
//              the point of use as rgb(var(--rgb-ink)) or
//              rgba(var(--rgb-ink), 0.15). 193 such wrapped consumptions.
//   --color-*  REAL COLOURS, consumed bare, and 78% of them are *built from*
//              the --rgb-* layer.
//
// Feeding a colour into a triplet slot yields rgba(#7aa2f7, .15), which is
// invalid at computed-value time: the declaration is dropped and an inherited
// property like `color` silently unwinds to the UA default. See the warning over
// toTriplet() in omarchy-colors.js. So every --rgb-* value below goes through
// toTriplet() and every --color-* value is a real colour.
//
// Because the second layer derives from the first, overriding the --rgb-*
// primitives alone would cascade into most of the app. This pack nonetheless
// sets the --color-* semantics EXPLICITLY as well, for two reasons: several
// --color-* tokens are hardcoded literals that derive from nothing (e.g.
// --color-bg--surface-solid: #f3f1ef, --color-bg--tertiary-opaque: #E5DFFF),
// and several others are built per-mode from --rgb-almost-black /
// --rgb-almost-white rather than from the semantic --rgb-ink alias, so they
// would keep HEY's purple-tinted greys. The --rgb-* overrides then act as the
// backstop that keeps anything not enumerated here in-theme.
//
// Light/dark needs no automation, and HEY's own CSS explains why. Its colour
// scheme is selected by a JS-written attribute on <html>:
//
//   :root[data-color-scheme="dark"]                          { ...dark tokens }
//   @media (prefers-color-scheme: dark) {
//     :root:not([data-color-scheme="light"])                 { ...dark tokens }
//   }
//
// with HEY's comment on the second arm reading "Hey World doesn't use JS, so we
// need to rely on CSS media queries to detect color scheme." The app itself
// takes the FIRST arm: it reads matchMedia in JS and stamps the attribute, which
// the MAIN-world shim (inject-prefers-color-scheme.js) drives. That also makes
// the reverse direction safe — on a light omarchy theme the shim reports light,
// HEY stamps data-color-scheme="light", and the media-query arm is suppressed by
// its own :not() guard. Confirmed live in both directions.

OmarchyTheme.register({
  id: "hey",

  cssVars(theme, s) {
    // --rgb-* slots take bare triplets; --color-* take real colours.
    const tri = (c) => toTriplet(c);
    const step = (t) => mix(s.bg, s.fg, t);

    // Semantic status colours, resolved together so they stay mutually
    // distinguishable, with HEY's own shipped colours as the per-role fallback
    // for palettes that have nothing honest to offer (monochrome themes). This
    // matters more than usual here: --color-positive/--color-negative are built
    // from --rgb-green/--rgb-red, and reading `pal.green` directly would paint
    // HEY's "positive" amber on matte-black, whose `green` slot is #FFC107.
    // See the long note over STATUS_ROLES in omarchy-colors.js.
    const pal = theme.colors || {};
    const status = statusPalette(pal, {
      danger: s.isDark ? "#ff7878" : "#c92400",
      success: s.isDark ? "#69f0ae" : "#299850",
      attention: s.isDark ? "#ffb85c" : "#f87917",
      done: s.isDark ? "#867eff" : "#5522fa",
    });

    // --color-tertiary is the one role that is DECORATIVE rather than semantic,
    // and it needs a different fallback chain because of it. HEY spends it on the
    // calendar's Day/Week/Year mode switch, on
    // `linear-gradient(135deg, var(--color-secondary), var(--color-tertiary))`,
    // and on --color-workflow — none of which means anything the way "positive"
    // and "negative" do. So where statusPalette rightly DECLINES to invent a hue
    // and hands back HEY's own purple, that purple becomes the single most
    // off-theme thing on the page: on retro-82 (a teal-and-amber palette) the
    // mode switch rendered as an amber-to-indigo gradient belonging to nothing.
    //
    // Correct for a decorative role is to stay in the palette instead: try the
    // conventional magenta family first (kept distinct from the three status
    // hues), then the palette's most perceptually DISTANT real colour from the
    // accent — highlightColor(), the same helper outlook.js uses for its calendar
    // now-marker — and only then the accent itself. A monochrome theme therefore
    // ends up with tertiary == accent, which is honest, rather than importing a
    // purple from another design system.
    //
    // The fallback must stay clear of the colours already spoken for, which
    // highlightColor() alone cannot do — it only avoids ONE colour (the accent),
    // so on catppuccin, everforest, matte-black and osaka-jade it handed back the
    // exact colour already assigned to `negative`, making "delete" and the mode
    // switch the same red. Hence the explicit scan below, which maximises the
    // MINIMUM distance from every taken role.
    const taken = [s.accent, status.danger, status.success, status.attention];
    const farthestFrom = (avoid) => {
      let best = null;
      let bestScore = -Infinity;
      for (const slot of Object.keys(pal)) {
        if (STRUCTURAL_SLOTS.has(slot)) continue;
        const color = pal[slot];
        if (!color || chromaOf(color) < 18) continue;
        if (contrastRatio(color, s.bg) < 3) continue;
        let score = Infinity;
        for (const other of avoid) score = Math.min(score, deltaE(color, other));
        if (score > bestScore) {
          bestScore = score;
          best = color;
        }
      }
      return bestScore >= 18 ? best : null;
    };
    const tertiary =
      statusColor(pal, "done", [status.danger, status.success, status.attention], null) ||
      farthestFrom(taken) ||
      s.accent;

    // Status colours are spent on TEXT here, not just on fills: HEY ships
    // `.txt--unread { color: var(--color-unread) }`, and --color-negative alone
    // has ten `color:` declarations. A palette hue taken as-is fails that job on
    // light themes, because amber on a near-white page is inherently low
    // contrast — measured across the shipped themes, unread landed at 2.05:1
    // (rose-pine), 2.60:1 (lupine) and 2.64:1 (flexoki-light), and
    // catppuccin-latte's green at 2.96:1.
    //
    // So each role gets TWO forms. `ink` is walked away from the page until it
    // clears the AA floor, preserving hue — shade() with s.dir moves toward the
    // ink end in either polarity, i.e. darker on a light theme and lighter on a
    // dark one. `raw` keeps the palette value for the translucent --color-bg--*
    // washes, which only have to register as a tint and would look muddy if built
    // from the darkened form.
    const legible = (color, target) => {
      let out = color;
      // 24 steps of 3% covers the worst case with room to spare; the guard is a
      // backstop, not a limit reached in practice.
      for (let i = 0; i < 24 && contrastRatio(out, s.bg) < target; i++) {
        out = shade(out, s.dir * 0.03);
      }
      return out;
    };
    const ink = {
      danger: legible(status.danger, 4.5),
      success: legible(status.success, 4.5),
      attention: legible(status.attention, 4.5),
      done: legible(tertiary, 4.5),
    };

    // Ink that rides on a filled/reversed surface. HEY's reversed surface is the
    // foreground colour itself (--color-bg--main-reversed), so its ink is the
    // page; the accent fills get their own resolution because a mid-tone accent
    // reads against neither the page nor the foreground.
    const onReversed = inkOn(s.fg, [s.bg]);
    const onAccent = inkOn(s.accent, [s.bg, s.fg]);

    // Text levels. subtle (0.66) and placeholder (0.60) carry real copy — sender
    // names, subjects, dates, field placeholders — so their alphas are solved for
    // a contrast target rather than fixed, the same reasoning as sidebarMuted in
    // deriveSurfaces(). very-subtle (0.33) is decoration and only needs to be
    // perceptible.
    const subtle = s.sidebarMuted;
    const placeholder = withAlpha(s.fg, alphaForContrast(s.fg, [s.bg], 4.5, 0.55));
    const verySubtle = withAlpha(s.fg, alphaForContrast(s.fg, [s.bg], 2.2, 0.33));

    // HEY's elevation: the big content .sheet and the surface-glint-opaque family
    // sit one step above the page (measured rgb(38,47,58) over a
    // rgb(27,39,51) page in dark). sidebarBg is the engine's accent-tinted
    // equivalent; chromeBg gives the navbar omarchy's chromium.theme where the
    // theme ships one and collapses onto sidebarBg otherwise.
    const sheet = s.sidebarBg;
    const overlay = shade(s.sidebarBg, s.dir * 0.02);

    const vars = {
      // ===== layer 1: --rgb-* primitives (TRIPLETS) =====
      // The semantic trio first. HEY defines these as aliases
      // (--rgb-background: var(--rgb-white)), so setting them directly replaces
      // the alias and every rgb(var(--rgb-background)) downstream follows.
      "--rgb-background": tri(s.bg),
      "--rgb-ink": tri(s.fg),
      "--rgb-overlay": tri(overlay),
      // The named hue palette. Semantic roles go through statusPalette so a
      // slot merely NAMED green can't turn "positive" amber; the rest are
      // decorative and map by name.
      "--rgb-red": tri(status.danger),
      "--rgb-green": tri(status.success),
      "--rgb-light-green": tri(status.success),
      "--rgb-orange": tri(status.attention),
      "--rgb-gold": tri(status.attention),
      "--rgb-yellow": tri(status.attention),
      "--rgb-purple": tri(tertiary),
      "--rgb-blue": tri(s.accent),
      "--rgb-mint": tri(s.accent),
      "--rgb-teal": tri(pal.cyan || s.accent),
      "--rgb-pink": tri(pal.bright_magenta || pal.magenta || tertiary),
      "--rgb-coral": tri(status.danger),
      "--rgb-brown": tri(pal.brown || step(0.55)),
      // Neutral greys, as a ladder away from the page.
      "--rgb-gray": tri(step(0.45)),
      "--rgb-medium-gray": tri(step(0.16)),
      "--rgb-light-gray": tri(step(0.06)),
      "--rgb-neutral-light-gray": tri(step(0.07)),

      // ===== layer 2: core surfaces =====
      // --color-bg--main paints the page; the navbar reads main-thick, and the
      // big content sheet reads --color-bg--sheet (both verified by value on the
      // live DOM).
      "--color-bg--main": s.bg,
      "--color-bg--main-thick": withAlpha(s.bg, 0.95),
      "--color-bg--main-thin": withAlpha(s.bg, 0.5),
      "--color-bg--main-very-thin": withAlpha(s.bg, 0.25),
      "--color-bg--main-transparent": withAlpha(s.bg, 0),
      "--color-bg--main-reversed": s.fg,
      "--color-bg--sheet": sheet,
      "--color-bg--entry-sheet": sheet,
      "--color-bg--sheet-transparent": withAlpha(sheet, 0),
      "--color-bg--card": sheet,
      "--color-bg--overlay": overlay,
      "--color-bg--overlay-dark": withAlpha(s.bg, 0.95),
      "--color-bg--neutral": step(0.07),
      "--color-bg--thread": withAlpha(s.fg, 0.06),

      // The "surface" family: washes and their opaque twins.
      "--color-bg--surface": withAlpha(s.fg, 0.1),
      "--color-bg--surface-glint": withAlpha(s.fg, 0.05),
      "--color-bg--surface-light": withAlpha(s.fg, 0.05),
      "--color-bg--surface-dark": withAlpha(s.fg, 0.33),
      "--color-bg--surface-opaque": step(0.16),
      "--color-bg--surface-solid": step(0.1),
      "--color-bg--surface-glint-opaque": sheet,
      "--color-bg--surface-glint-thick": withAlpha(sheet, 0.9),
      "--color-bg--surface-glint-transparent": withAlpha(sheet, 0),
      "--color-bg--receded": withAlpha(s.fg, 0.05),
      "--color-bg--tooltip": step(0.25),

      // ===== borders =====
      "--color-border": withAlpha(s.fg, 0.15),
      "--color-border--light": withAlpha(s.fg, 0.05),
      "--color-border--medium": withAlpha(s.fg, 0.15),
      "--color-border--heavy": withAlpha(s.fg, 0.5),
      "--color-border--solid": s.fg,

      // ===== text =====
      "--color-txt": s.fg,
      "--color-txt--subtle": subtle,
      "--color-txt--very-subtle": verySubtle,
      "--color-txt--placeholder": placeholder,
      // "reversed" rides on --color-bg--main-reversed, which is the foreground.
      "--color-txt--reversed": onReversed,
      "--color-txt--subtle-reversed": withAlpha(onReversed, 0.66),
      // Links are TEXT, so the raw accent is not always enough: on rose-pine it
      // lands at 3.14:1, miasma 3.86:1, catppuccin-latte 4.34:1. The FILL tokens
      // (--color-primary / --color-secondary) deliberately keep the unmodified
      // accent — darkening those would change the colour of every primary button
      // and the calendar's mode switch — and their ink is resolved by inkOn().
      "--color-txt--action": legible(s.accent, 4.5),

      // ===== accent / brand =====
      // HEY's mint (--color-primary) and blue (--color-secondary) both become the
      // omarchy accent: mint is the brand fill and blue is the link/action colour,
      // and a theme has one accent. --color-tertiary keeps its own hue so the
      // three-way distinction HEY draws survives.
      "--color-primary": s.accent,
      "--color-bg--primary": withAlpha(s.accent, 0.15),
      "--color-bg--primary-glint": withAlpha(s.accent, 0.05),
      "--color-secondary": s.accent,
      "--color-bg--secondary": withAlpha(s.accent, 0.15),
      "--color-bg--secondary-glint": withAlpha(s.accent, 0.05),
      "--color-bg--secondary-opaque": mix(s.bg, s.accent, 0.18),
      "--color-bg--secondary-glint-opaque": mix(s.bg, s.accent, 0.08),
      "--color-focus-ring": s.accent,
      "--color-tertiary": ink.done,
      "--color-tertiary--contrast": ink.done,
      "--color-bg--tertiary": withAlpha(tertiary, 0.15),
      "--color-bg--tertiary-glint": withAlpha(tertiary, 0.05),
      "--color-bg--tertiary-opaque": mix(s.bg, tertiary, 0.18),

      // ===== semantic status =====
      "--color-positive": ink.success,
      "--color-bg--positive": withAlpha(status.success, 0.22),
      "--color-bg--positive-glint": withAlpha(status.success, 0.1),
      "--color-negative": ink.danger,
      "--color-bg--negative": withAlpha(status.danger, 0.3),
      "--color-bg--negative-glint": withAlpha(status.danger, 0.16),
      "--color-bg--negative-glint-thin": withAlpha(status.danger, 0.05),
      // The Imbox's unread marker — the single affordance HEY is built around.
      // Kept a WARM "new" colour rather than the accent, both to preserve HEY's
      // intent and so unread never reads as a link.
      "--color-unread": ink.attention,
      "--color-bg--warning": withAlpha(status.attention, 0.18),
      "--color-bg--warning-glint": withAlpha(status.attention, 0.1),
      "--color-bg--warning-opaque": mix(s.bg, status.attention, 0.2),
      "--color-bg--warning-glint-opaque": mix(s.bg, status.attention, 0.1),
      "--color-bg--warning-urgent": withAlpha(status.attention, 0.33),
      "--color-bg--highlight": withAlpha(status.attention, 0.35),
      // Collections / workflow / recycling: HEY's own semantics, kept distinct.
      "--color-collection": ink.success,
      "--color-bg--collection": withAlpha(status.success, 0.28),
      "--color-bg--collection-glint": withAlpha(status.success, 0.12),
      "--color-bg--collection-opaque": mix(s.bg, status.success, 0.22),
      "--color-bg--collection-glint-opaque": mix(s.bg, status.success, 0.1),
      "--color-recycling": ink.success,
      "--color-workflow": ink.done,
      "--color-disabled": withAlpha(s.fg, 0.38),

      // Named colour exports, for the handful of places HEY reaches for a hue
      // directly rather than through a role.
      "--color-yellow": ink.attention,
      "--color-orange": ink.attention,
      "--color-coral": ink.danger,
      "--color-peach": withAlpha(status.attention, 0.2),
      // Ink for text sitting on an accent FILL (primary buttons, selected chips).
      "--color-txt--on-primary": onAccent,
    };

    // DELIBERATELY UNMAPPED, each for its own reason:
    //
    //  - THE EMAIL PAPER FAMILY: --color-bg--message-content (#fff, and note it
    //    is one of the few tokens IDENTICAL in light and dark), plus
    //    --color-txt--on-message-content, --color-txt--subtle-on-message-content,
    //    --color-txt--action-on-message-content and
    //    --color-bg--receded-on-isolated-content. Unlike Outlook, HEY does NOT
    //    transform received mail for dark mode — it renders the sender's HTML
    //    as-authored on a white sheet, which is why it keeps that sheet white in
    //    both modes and pairs it with permanently dark ink. Retinting the paper
    //    while the sender's own inline colours stay put is how you get black text
    //    on a black background. The sender's design is theirs; see the same line
    //    drawn in outlook.js. (The rendered body is in an iframe anyway, which
    //    the manifest's all_frames: false already keeps us out of.)
    //  - --color-bg--note-opaque (#FFF6C8, also identical in both modes): the
    //    sticky-note paper. Yellow IS the affordance.
    //  - The `always` family — --color-always-white, --color-always-black,
    //    --color-black, --color-almost-black, --rgb-always-blue, --rgb-white,
    //    --rgb-black, --rgb-almost-black, --rgb-almost-white. HEY names these
    //    honestly: they are literals for icon fills, text over saturated
    //    buttons, and the fixed ends of its own scale. --color-always-black in
    //    particular is defined as rgb(var(--rgb-almost-black)), so remapping that
    //    primitive would break the "always" guarantee. Better self-documentation
    //    than Outlook's misleadingly-named --white.
    //  - --color-shadow / --shadow--light / --shadow--dark / --shadow--very-dark:
    //    shadows are meant to be dark, in either polarity.
    //  - --color-bg--nighttime / --nighttime-glint and --color-bg--world-*: HEY
    //    World and the calendar's night shading are their own brand surfaces,
    //    identical or near-identical across modes by design.
    //  - --color-quote-toggle (#0068c8): renders inside quoted mail, i.e. on the
    //    white paper above, so it must stay legible there rather than on ours.
    //  - THE ENTIRE --colorize-* FAMILY (30 tokens). These are not colours at
    //    all: they are CSS `filter` chains that recolour monochrome icon assets
    //    (--colorize-ink is `invert(11%) sepia(9%) saturate(2411%)
    //    hue-rotate(171deg) brightness(89%) contrast(85%)`). Hitting an arbitrary
    //    target hex needs a numerical solver over five filter functions, which is
    //    far more machinery than the result would justify — and it is not needed
    //    for correctness, because HEY swaps the whole set by mode, so icons are
    //    already the right POLARITY (near-white on a dark theme, near-black on a
    //    light one). They just aren't hue-matched to the palette.
    return vars;
  },

  // One thing the token layer cannot express: HEY pairs an ACCENT FILL with a
  // permanently-dark ink. From its buttons stylesheet —
  //
  //   @layer components .btn--primary {
  //     background: var(--color-primary);            <- becomes the omarchy accent
  //     border-color: var(--color-primary);
  //     color: var(--color-almost-black);            <- stays dark, always
  //     &.btn--icon::before { filter: var(--colorize-black); }   <- dark icon
  //   }
  //
  // and `mark` does the same (primary background, almost-black text). That works
  // for HEY because its own brand fills are a light mint and a light amber. It
  // breaks the moment the accent is DARK — catppuccin-latte's #1e66f5, lupine's
  // #3264eb — where a dark label on a dark blue button is unreadable.
  //
  // The fix cannot be to remap --color-almost-black, because its other consumers
  // genuinely want "always dark": the .sheet box-shadow in dark mode (a light
  // value would turn the shadow into a glow), the calendar's 2px day dividers,
  // and the print stylesheet's `color: ... !important` for text on paper.
  //
  // So it is scoped by selector instead. HEY's class names are hand-written and
  // stable — `btn btn--primary`, `navbar__inbox` — not hashed like Slack's, so a
  // class selector is the honest hook here rather than a fragile guess. Their
  // declaration is a NORMAL one inside @layer components, and an unlayered
  // !important beats any normal declaration in the same origin regardless of
  // layer order, so no layer gymnastics are needed. (Their few LAYERED
  // !important rules — .btn--reversed, .spinner__dot — would outrank an unlayered
  // !important, but those resolve through --color-txt--reversed, which cssVars
  // already themes, so they need nothing here.)
  apply(theme, s) {
    let style = document.getElementById("omarchy-hey-fills");
    if (!style) {
      style = document.createElement("style");
      style.id = "omarchy-hey-fills";
      (document.head || document.documentElement).appendChild(style);
    }

    const onAccent = inkOn(s.accent, [s.bg, s.fg]);
    // The button's leading glyph is a monochrome asset recoloured by a filter, and
    // this is the one corner where the --colorize-* family IS tractable: we don't
    // need to solve a filter chain for an arbitrary hue, only to choose between
    // the two HEY already ships — `none` leaves the asset black, `invert(100%)`
    // makes it white — so the icon simply follows the label's polarity.
    const iconFilter = relLuminance(hexToRgb(onAccent)) < 0.5 ? "none" : "invert(100%)";

    style.textContent = [
      "html .btn--primary, html mark { color: " + onAccent + " !important; }",
      "html .btn--primary.btn--icon::before," +
        " html .btn--primary.btn--icon-round::before," +
        " html .btn--primary.btn--plain-icon::before" +
        " { filter: " + iconFilter + " !important; }",
    ].join("\n");
  },
});
