// Notion pack for the Omarchy web-app theming engine — declarative tier.
//
// Notion paints almost entirely from CSS custom properties, but reaches them by
// an unusual route, verified against the live app (2026-08-18: 1,332 declared
// properties, 776 resolving on <html>, 14 stylesheets, no shadow DOM):
//
//   1. React writes INLINE styles that CONSUME the tokens —
//      `background: var(--c-bacPri)`, `color: var(--c-texPri)` — 1,719 var
//      references across 1,908 inline-styled elements. Nothing we could put in a
//      stylesheet would beat an inline `background`, but we don't have to: the
//      inline declaration only *consumes* the property, so redefining the
//      property itself (which the engine does, inline-important on every
//      element) changes what that inline rule resolves to.
//
//   2. A StyleX layer sits in between. Elements carry hashed slots like
//      `--x-umghl: var(--ca-bacIntTra)` inline, and StyleX's own rules then read
//      `background: var(--x-umghl)`. This looked like Linear's problem — see
//      linear.js, where the hashed `--sx-*` slots hold LITERAL colours and have
//      to be classified and remapped one by one. Notion's don't: of 781 slot
//      declarations on a loaded page, every colour-valued one resolves to a
//      semantic `--c-*` / `--ca-*` token and the only literal is `transparent`
//      (74 of them). The indirection therefore passes straight through the
//      tokens below, and this pack needs no observers, no repaint path, and no
//      knowledge of the hashes.
//
// FORMAT: every token holds a real colour and is consumed bare. Measured, not
// assumed — `rgb(var(--x))` appears exactly ZERO times in 157KB of Notion CSS
// and zero times across every inline style on the page. So no triplets here,
// unlike Slack's `--sk_*` (see the warning in omarchy-colors.js).
//
// Notion's naming is abbreviated but completely regular, which is what makes a
// declarative table practical:
//   slot:   Bac background · Tex text · Ico icon · Bor border · Sha shadow
//   level:  Pri · Sec · Ter · Ele (elevated) · Int (interactive) · Str (strong)
//           Acc (accent) · Inv (inverse, i.e. ink for an emphasis fill) · Dis
//   prefix: --c-  opaque colour        --ca- alpha wash
//           --cl- / --cd- two legacy sets, see the note above cssVars
//
// Light/dark needs no automation. Notion swaps `notion-light-theme` /
// `notion-dark-theme` on <body> from a matchMedia listener, which the MAIN-world
// shim (inject-prefers-color-scheme.js) drives on every omarchy theme apply.
// **Requires Notion's appearance set to "Use system setting"** (Settings → My
// settings → Appearance) — pinned to Light or Dark, Notion's class stops
// following the shim and its own light values fight a dark omarchy theme.

// ===== code-block syntax highlighting ======================================
//
// Notion highlights code with Prism, and Prism's palette is the one part of the
// page body that no token remap can reach: it ships as class-scoped LITERALS,
// two full sets, selected by Notion's own theme class —
//
//   .notion-dark-theme  .token.keyword { color:#66a2cc }
//   .notion-light-theme .token.keyword { color:#07a }
//
// with no custom property anywhere in the chain. Left alone, a code block keeps
// Prism's stock blue/green/amber regardless of the omarchy theme, which is the
// most conspicuous off-theme thing left in a Notion doc once the surfaces and
// body copy are themed.
//
// An omarchy palette is unusually well suited to fixing this, because a terminal
// palette IS a syntax palette — colors.toml ships exactly the red/green/yellow/
// blue/magenta/cyan set (plus bright twins) that Prism's roles want.
//
// Two guards, both learned elsewhere in this repo:
//
//  - A SLOT'S NAME DOES NOT PROMISE ITS HUE (see the statusColor() note in
//    omarchy-colors.js: matte-black's `green` is an amber). For syntax colours
//    that matters far less than it does for a pass/fail badge — a string being
//    amber instead of green is a style choice, not a misreported state — so the
//    named slots are taken in preference order rather than hue-tested. What DOES
//    get enforced is that a candidate is a real colour and is legible.
//  - SOME PALETTES HAVE NO COLOURS AT ALL (`white`, `vantablack` are monochrome
//    by design). There, every role correctly declines and falls back to the
//    theme's own foreground: uncoloured code on a monochrome theme, which is
//    what that theme is for, rather than an invented rainbow.
const NOTION_SYNTAX_MIN_CHROMA = 12;
const NOTION_SYNTAX_MIN_CONTRAST = 3.5;

// Pick the first palette slot that is a real colour AND readable on the code
// block's surface; otherwise the caller's fallback.
function notionSyntaxColor(palette, slots, surface, fallback) {
  for (const slot of slots) {
    const color = palette[slot];
    if (!color) continue;
    if (chromaOf(color) < NOTION_SYNTAX_MIN_CHROMA) continue;
    if (contrastRatio(color, surface) < NOTION_SYNTAX_MIN_CONTRAST) continue;
    return color;
  }
  return fallback;
}

// The Prism rules, as an array of CSS strings. Notion's own selectors carry
// three classes (0,3,0) and no !important, so a plain !important declaration on
// the token classes alone wins — and dropping Notion's theme-class prefix is
// deliberate: it means the same rule applies whichever mode Notion is in, so a
// mid-flip page can't briefly show the other set.
function notionCodeCss(theme, s) {
  const pal = theme.colors || {};
  // Notion's code block is a faint wash over the page rather than its own
  // surface, so contrast is judged against roughly the page colour.
  const surface = mix(s.bg, s.fg, 0.04);
  const pick = (slots) => notionSyntaxColor(pal, slots, surface, s.fg);

  const keyword = pick(["blue", "bright_blue", "cyan", "magenta"]);
  const string = pick(["green", "bright_green", "cyan", "yellow"]);
  const constant = pick(["magenta", "bright_magenta", "orange", "red"]);
  const fn = pick(["yellow", "bright_yellow", "orange", "cyan"]);
  const operator = pick(["cyan", "bright_cyan", "blue", "magenta"]);
  const regex = pick(["orange", "bright_yellow", "yellow", "red"]);
  const deleted = pick(["red", "bright_red", "magenta"]);
  const inserted = pick(["green", "bright_green", "cyan"]);
  // Comments must RECEDE — that is their whole job — so this one is deliberately
  // not a palette hue but a dimmed foreground, solved for a 3:1 floor so it
  // stays readable on low-headroom themes without ever competing with the code.
  const comment = withAlpha(s.fg, alphaForContrast(s.fg, [surface], 3, 0.45));
  const punctuation = withAlpha(s.fg, 0.7);

  // INLINE code (`like this` inside a paragraph). Notion paints it with two
  // inline declarations: `background: var(--ca-bacIntTra)`, which cssVars already
  // themes, and `color: var(--c-redTexSec)` — a red that belongs to no omarchy
  // palette and, on a green or blue theme, is the loudest wrong note left on the
  // page (551 spans on one real doc).
  //
  // The fix cannot be to remap --c-redTexSec: that token is ALSO what a user's
  // deliberately red TEXT resolves to, and flattening the two would erase a real
  // authoring choice. What separates them is that inline code is the only thing
  // Notion gives a monospace stack to inline, so the stable hook is an
  // attribute-substring match on that stack — the same technique content.js uses
  // for Slack's hashed classes, and stable for the same reason: the font stack is
  // part of Notion's design, not a build artifact. Verified that code BLOCKS are
  // unaffected: their spans carry no inline font-family at all (the block sets it
  // on a container div), so restricting the selector to `span` misses them.
  //
  // Colour: keep Notion's intent — a warm accent, distinct from body copy — but
  // take it from the palette. Requires enough perceptual distance from fg that it
  // cannot collapse into plain text, then falls back to the accent, then fg.
  const warm = ["orange", "bright_yellow", "red", "bright_red", "magenta", "bright_magenta", "yellow"];
  let inlineCode = null;
  for (const slot of warm) {
    const c = pal[slot];
    if (!c || chromaOf(c) < NOTION_SYNTAX_MIN_CHROMA) continue;
    if (contrastRatio(c, surface) < NOTION_SYNTAX_MIN_CONTRAST) continue;
    if (deltaE(c, s.fg) < 20) continue;
    inlineCode = c;
    break;
  }
  if (!inlineCode) {
    inlineCode =
      contrastRatio(s.accent, surface) >= NOTION_SYNTAX_MIN_CONTRAST &&
      deltaE(s.accent, s.fg) >= 20
        ? s.accent
        : s.fg;
  }

  const rule = (sel, color) => sel + " { color: " + color + " !important; }";
  return [
    rule(".token.comment, .token.prolog, .token.doctype, .token.cdata", comment),
    rule(".token.punctuation", punctuation),
    rule(
      ".token.property, .token.tag, .token.boolean, .token.number," +
        " .token.constant, .token.symbol",
      constant
    ),
    rule(
      ".token.selector, .token.attr-name, .token.string, .token.char," +
        " .token.builtin",
      string
    ),
    rule(".token.inserted", inserted),
    rule(".token.deleted", deleted),
    rule(".token.operator, .token.entity, .token.url", operator),
    rule(".token.atrule, .token.attr-value, .token.keyword", keyword),
    rule(".token.function, .token.class-name", fn),
    rule(".token.regex, .token.important, .token.variable", regex),
    // Notion gives .token.operator its own translucent white background in
    // light mode (`background:rgba(255,255,255,.5)`), which reads as a pale
    // smear behind every operator once the page is themed. Operators need no
    // fill at all — Notion's own dark rule already sets `background:0 0`.
    ".token.operator, .token.operator.operator { background: none !important; }",
    // Inline code — see the note above. `span` only, so code blocks are untouched.
    'span[style*="SFMono-Regular"] { color: ' + inlineCode + " !important; }",
  ];
}

OmarchyTheme.register({
  id: "notion",

  cssVars(theme, s) {
    // Opaque step off the page, walking the correct way for the theme's polarity.
    // Notion's own dark ladder is bacPri #191919 → bacSec/bacEle #202020 →
    // bacInt #262626 → bacTer #383836, and it inverts in light, so every step
    // below is expressed as a mix toward fg rather than as a literal.
    const step = (t) => mix(s.bg, s.fg, t);

    // Hover/press washes. Notion spends --ca-bacIntTra on 439 elements — the
    // universal hover — at rgba(255,255,255,.055) in dark and rgba(33,27,23,.05)
    // in light: a low-alpha INK wash, not a tint. Keeping the alpha near Notion's
    // matters, because "background interactive" also lands on resting surfaces
    // (code blocks, table headers, toggles) where the engine's own hoverBg
    // (accent at 0.20) would read as a permanent accent smear. So: Notion's
    // weight, with the ink leaned toward the accent so hover still feels themed.
    const hoverInk = mix(s.fg, s.accent, 0.55);
    const hoverWash = withAlpha(hoverInk, 0.09);
    const pressWash = withAlpha(hoverInk, 0.16);

    // Popovers/menus/cards sit above BOTH the page and the sidebar, and pick up
    // the sidebar's accent tint rather than a flat grey.
    const popBac = shade(s.sidebarBg, s.dir * 0.02);

    // Ink for the emphasis fill (see the --c-bacAccPri block below). The page
    // background is the conventional and most theme-coherent choice, with the
    // foreground as the second try — but on a mid-tone accent neither clears AA
    // (rose-pine bottoms out at 3.14:1), and this ink lands on the primary
    // button's LABEL. inkOn() escalates to white/black only for those palettes.
    const onAccent = inkOn(s.accent, [s.bg, s.fg]);
    const onAccentSoft = withAlpha(onAccent, 0.75);

    // The tertiary ink level (texTer / icoTer): timestamps, placeholders, "Add a
    // comment…". A flat fraction of fg fails the same way it did for
    // sidebarMuted — at 0.55 the two lowest-headroom light themes land at 2.47:1
    // (rose-pine) and 2.53:1 (catppuccin-latte), which is below the 3:1 floor
    // even incidental copy should hold. So solve the alpha for 3:1 against the
    // page and keep a low floor, so themes with headroom still read as properly
    // tertiary rather than being dragged up toward secondary.
    // Solved against the PAGE only, for the reason spelled out in
    // deriveSurfaces()'s sidebarMuted note: also demanding the target on the
    // accent-tinted sidebar drives the alpha to 1.0 on low-headroom themes and
    // collapses the level onto fg. The cost is that tertiary copy sitting on the
    // sidebar runs a little under 3:1 (worst measured: everforest 2.55:1) — the
    // same trade the engine already accepts, and this level carries timestamps
    // and placeholders rather than anything a user has to read.
    const terAlpha = alphaForContrast(s.fg, [s.bg], 3, 0.5);
    const terInk = withAlpha(s.fg, terAlpha);
    // Notion's texAccPri/icoAccPri sit BETWEEN secondary and primary (dark
    // #bcbab6, against texSec #ada9a3 and texPri #f0efed), so this is real copy
    // and gets the full AA target rather than a fixed fraction — at a flat 0.75
    // the two lowest-headroom light themes came in at 3.70:1 and 3.85:1.
    const accInk = withAlpha(s.fg, alphaForContrast(s.fg, [s.bg], 4.5, 0.75));

    const vars = {
      // ===== core surfaces =====
      // Verified by value against the live DOM: the main pane and
      // .notion-cursor-listener paint from --c-bacPri, the sidebar container
      // from --c-bacSec.
      "--c-bacPri": s.bg,
      "--c-bacSec": s.sidebarBg,
      // "Elevated" tracks the PAGE in light (#fff, same as bacPri) and the
      // SIDEBAR in dark (#202020, same as bacSec) — it is elevation, not a third
      // panel. chromeBg gives it omarchy's chromium.theme where the theme ships
      // one (so it matches Brave's toolbar) and collapses onto sidebarBg
      // otherwise, which is exactly Notion's own dark behaviour.
      "--c-bacEle": s.chromeBg,
      "--c-bacInt": step(0.06),
      "--c-bacTer": step(0.09),
      "--c-popBac": popBac,
      "--c-timBac": s.bg,
      "--c-peeTimBac": s.sidebarBg,
      "--c-sitBuiBac": shade(s.bg, s.dir * 0.02),
      "--c-hovMarDisBac": s.sidebarBg,
      "--c-selMarDisBac": popBac,
      "--c-homScrButBacBas": popBac,
      "--c-butGroBac": step(0.1),
      "--c-calIteBac": step(0.1),
      // Banners. Notion gives both the same value in dark (#373c3f) — a slab a
      // little further off the page than bacTer.
      "--c-darBanBac": step(0.12),
      "--c-beiBanBac": step(0.12),
      "--c-keyActBarBac": step(0.07),
      "--c-keyDonBarBac": step(0.07),

      // The emphasis fill and its ink. --c-bacAccPri is #2c2c2b in BOTH modes —
      // an always-dark chip (Notion's primary button) — and --c-texInvPri
      // (#f0efed, also both modes) is the light ink that rides on it. They are a
      // pair, so they move together: the fill becomes the accent and the ink is
      // resolved against it, the same "ink on emphasis" convention outlook.js
      // uses for its filled search button. Retinting one without the other is
      // what inverts contrast.
      "--c-bacAccPri": s.accent,
      "--c-bacAccSec": mix(s.accent, s.bg, 0.35),
      "--c-texInvPri": onAccent,
      "--c-texInvSec": onAccentSoft,
      "--c-icoInvPri": onAccent,
      "--c-icoInvSec": onAccentSoft,
      "--c-borInvPri": withAlpha(onAccent, 0.3),

      // ===== text =====
      // texSec carries real secondary copy (103 inline uses plus 71 through the
      // StyleX layer), which is what sidebarMuted's contrast-targeted alpha is
      // for — a flat fraction of fg drops several shipped themes under AA. See
      // deriveSurfaces().
      "--c-texPri": s.fg,
      "--c-texSec": s.sidebarMuted,
      "--c-texTer": terInk,
      "--c-texAccPri": accInk,
      "--c-texDis": withAlpha(s.fg, 0.38),
      // Sidebar section headings ("Private", "Teamspaces").
      "--c-sidSecCol": s.sidebarMuted,

      // ===== icons =====
      // --c-icoSec is the single most-consumed ink in the app (215 inline + 194
      // StyleX): the icon colour for nearly every control.
      "--c-icoPri": s.fg,
      "--c-icoSec": s.sidebarMuted,
      "--c-icoTer": terInk,
      "--c-icoAccPri": accInk,
      "--c-icoDis": withAlpha(s.fg, 0.38),

      // ===== borders =====
      // Notion's own dark order is Sec #2c2c2b < Pri #383836 < Str #5f5e59, so
      // borPri (111 inline uses — the main divider) sits between the two.
      "--c-borSec": withAlpha(s.fg, 0.06),
      "--c-borPri": withAlpha(s.fg, 0.12),
      "--c-borStr": withAlpha(s.fg, 0.28),
      "--c-borAccPri": withAlpha(s.fg, 0.45),
      "--c-tabFroFilDivCol": withAlpha(s.fg, 0.2),
      "--c-tabFroSelDivCol": withAlpha(s.accent, 0.45),

      // ===== literal-looking tokens that actually FLIP by mode =====
      // --c-whi is #fff in light and #000 in dark; --c-priBla and --c-regEmoCol
      // are the reverse. Despite the names none of the three is a literal — the
      // pair behaves as page/ink, exactly like Outlook's --white/--black. Unlike
      // Outlook's, these are safe to remap at the root: their only consumers are
      // --crop-mask-color (the image cropper's mask) and 16 `color`
      // declarations on emoji glyphs, none of them ink over a saturated fill.
      "--c-whi": s.bg,
      "--c-priBla": s.fg,
      "--c-regEmoCol": s.fg,
      // The neutral button family ("white button" is a misnomer for the same
      // reason — #252525/#2f2f2f in dark).
      "--c-whiButBac": step(0.055),
      "--c-whiButHovBac": step(0.1),
      "--c-whiButPreBac": step(0.055),

      // ===== alpha washes =====
      // Notion's `Tra` suffix ("transparent") marks ink-over-surface washes:
      // rgba(255,255,255,α) in dark, rgba(33,27,23,α) in light. Preserve the
      // alphas and swap the ink to the theme's fg, so each keeps adapting to
      // whichever surface it lands on.
      "--ca-bacIntTra": hoverWash,
      "--ca-bacSecTra": withAlpha(s.fg, 0.03),
      "--ca-bacTerTra": withAlpha(s.fg, 0.08),
      // MUST stay fully transparent — Notion ships this at alpha 0 in both modes
      // (it is the "no background" end of the ladder, used to animate into).
      "--ca-bacPriTra": withAlpha(s.bg, 0),
      "--ca-conBacTra": withAlpha(s.bg, 0),
      "--ca-carConBacTra": withAlpha(s.bg, 0),
      "--ca-borPriTra": withAlpha(s.fg, 0.1),
      "--ca-borSecTra": withAlpha(s.fg, 0.08),
      "--ca-borStrTra": withAlpha(s.fg, 0.3),
      "--ca-texDisTra": withAlpha(s.fg, 0.3),
      "--ca-opaLinDecCol": withAlpha(s.fg, 0.35),

      // Hover / press, across buttons, rows, menus and tables.
      "--ca-butHovBac": hoverWash,
      "--ca-butPreBac": pressWash,
      "--ca-butPreBacLig": withAlpha(hoverInk, 0.12),
      "--ca-outButHovBac": hoverWash,
      "--ca-staHov": hoverWash,
      "--ca-staPre": pressWash,
      "--ca-tabRowHovBac": withAlpha(hoverInk, 0.055),
      "--ca-calEveHovBac": withAlpha(hoverInk, 0.04),
      "--ca-ligGraButHovBac": hoverWash,
      "--ca-ligGraButPreBac": pressWash,
      "--ca-tokInpMenIteBac": withAlpha(s.fg, 0.04),
      // The selected page in the sidebar — the one row that should read as
      // "you are here", so this gets the engine's accent-tinted selection
      // rather than the neutral wash Notion uses for it.
      "--ca-sidIteSelBac": s.selectedBg,
      "--ca-sidSecBac": withAlpha(s.fg, 0.024),

      // Translucent "glass" surfaces (sticky headers, home tiles). Notion builds
      // these from the surface they overlay at 80-90% — bg for the page, the
      // sidebar surface for the wash/tile variants.
      "--ca-glaPag": withAlpha(s.bg, 0.8),
      "--ca-glaWas": withAlpha(s.sidebarBg, 0.8),
      "--ca-palPagGla0": withAlpha(s.bg, 0.8),
      "--ca-palWasGla0": withAlpha(s.sidebarBg, 0.8),
      "--ca-homTilBac": withAlpha(s.sidebarBg, 0.9),
      "--ca-popWaxPapBac": withAlpha(s.sidebarBg, 0.9),

      // ===== the UI accent (Notion blue #2383e2) =====
      // Distinct from the `blu` BLOCK colour family below — palUiBlu is the
      // product's own accent: focus rings, links, primary buttons, selection.
      "--c-palUiBlu600": s.accent,
      // Notion's 700 is darker in light and LIGHTER in dark, i.e. a step further
      // from the page either way.
      "--c-palUiBlu700": shade(s.accent, s.dir * 0.08),
      "--ca-palUiBlu50": withAlpha(s.accent, 0.035),
      "--ca-palUiBlu75": withAlpha(s.accent, 0.05),
      "--ca-palUiBlu100": withAlpha(s.accent, 0.07),
      "--ca-palUiBlu200": withAlpha(s.accent, 0.14),
      "--ca-palUiBlu300": withAlpha(s.accent, 0.21),
      "--ca-palUiBlu400": withAlpha(s.accent, 0.35),
      "--ca-palUiBlu500": withAlpha(s.accent, 0.57),
      // Focus rings are box-shadow VALUES, not colours, so they have to be
      // rebuilt rather than pointed at a token.
      "--c-focSha":
        withAlpha(s.accent, 0.57) + " 0px 0px 0px 1px inset, " +
        withAlpha(s.accent, 0.35) + " 0px 0px 0px 2px",
      "--c-inpBluFocRin":
        "0px 0px 0px 1px " + s.accent + " inset, 0px 0px 0px 1px " + s.accent,
      "--c-butBluFocRin":
        "0px 0px 0px 2px " + s.bg + ", 0px 0px 0px 4px " + s.accent +
        ", 0px 0px 0px 6px " + withAlpha(s.fg, 0.25),

      // ===== the neutral grey ramp =====
      // Two prefixes cover one continuous ladder: --c-palGra holds 0/50 and
      // 500-900, --cl-palGra fills in 30-400. In dark it runs #000 → #191919
      // (the page) → #fff (the ink); in light it inverts. So it is a straight
      // page→ink ramp and mixes cleanly — but note the two modes are NOT
      // symmetric (light reaches ink far faster: palGra500 is 67% of the way
      // there in light versus 30% in dark). The high end below therefore leans
      // toward the light figures, because erring bright costs a little
      // flatness while erring dim costs legibility.
      "--c-palGra0": shade(s.bg, -s.dir * 0.05),
      "--c-palGra50": s.bg,
      "--c-palGra500": step(0.5),
      "--c-palGra600": step(0.62),
      "--c-palGra700": step(0.75),
      "--c-palGra800": step(0.92),
      "--c-palGra900": s.fg,
      "--cl-palGra30": shade(s.bg, -s.dir * 0.015),
      "--cl-palGra75": step(0.015),
      "--cl-palGra90": step(0.025),
      "--cl-palGra100": step(0.035),
      "--cl-palGra200": step(0.06),
      "--cl-palGra300": step(0.1),
      "--cl-palGra400": step(0.14),
      // The selection-highlight ramp. Notion makes it solid in dark and a
      // 50%-alpha grey in light, but both amount to "a grey at level N", so the
      // same opaque ladder serves — and it is what stops selected rows reading
      // as neutral slabs dropped into a tinted page.
      "--cl-selLigGra30": shade(s.bg, -s.dir * 0.015),
      "--cl-selLigGra50": s.bg,
      "--cl-selLigGra100": step(0.035),
      "--cl-selLigGra200": step(0.06),
      "--cl-selLigGra300": step(0.1),
      "--cl-selLigGra400": step(0.14),
      "--cl-selLigGra500": step(0.3),
      "--cl-selLigGra700": step(0.6),
      // Neutral ink washes (--ca-palTraGra, "transparent gray").
      "--ca-palTraGra30": withAlpha(s.fg, 0.02),
      "--ca-palTraGra50": withAlpha(s.fg, 0.03),
      "--ca-palTraGra75": withAlpha(s.fg, 0.035),
      "--ca-palTraGra100": withAlpha(s.fg, 0.045),
      "--ca-palTraGra200": withAlpha(s.fg, 0.06),
      "--ca-palTraGra300": withAlpha(s.fg, 0.1),
      "--ca-palTraGra400": withAlpha(s.fg, 0.14),
      "--ca-palTraGra500": withAlpha(s.fg, 0.3),
      "--ca-palTraGra600": withAlpha(s.fg, 0.46),
      "--ca-palTraGra700": withAlpha(s.fg, 0.6),
      "--ca-palTraGra800": withAlpha(s.fg, 0.81),
      "--ca-palTraGra850": withAlpha(s.fg, 0.88),
      "--ca-palTraGra900": withAlpha(s.fg, 0.97),
      "--cl-palTraGra30": withAlpha(s.fg, 0.015),
      "--cl-palTraGra50": withAlpha(s.fg, 0.04),

      // ===== legacy `--cd-` washes =====
      // Solid in light (#f7f6f3), alpha in dark (rgba(255,255,255,.03)) — the
      // same "barely off the page" surface expressed two ways. An ink wash
      // covers both: over white it lands on Notion's own light value.
      "--cd-codBloBac": withAlpha(s.fg, 0.035),
      "--c-codStiBloBac": withAlpha(s.fg, 0.04),
      "--cd-tabHeaRowColBac": withAlpha(s.fg, 0.035),
      "--cd-timDarBac": withAlpha(s.fg, 0.03),
      "--cd-embPlaBac": withAlpha(s.fg, 0.03),
      "--cd-boaIteDefBac": withAlpha(s.fg, 0.055),
      "--cd-colGalPreCarBac": withAlpha(s.fg, 0.055),
      "--cd-homCarBacBas": withAlpha(s.fg, 0.05),
      "--cd-homCarBacHov": hoverWash,
      "--cd-homCarTemCarBacBas": withAlpha(s.fg, 0.05),
      "--cd-homCarTemCarBacHov": hoverWash,
      "--ca-homCarBacPre": pressWash,
      "--ca-homCarCovPhoBas": withAlpha(s.fg, 0.04),
      "--ca-homCarTemCarBacPre": pressWash,
      "--cd-aiChaButSel": withAlpha(s.fg, 0.04),
      "--cd-aiChaButSelHov": withAlpha(s.fg, 0.06),
      "--cd-aiChaButPre": withAlpha(s.fg, 0.12),
      "--c-UIUseAvaIdlOut": withAlpha(s.fg, 0.3),

      // ===== the neutral `gra` block-colour family =====
      // Notion's block colours ship as ten families (blu/bro/gre/ora/pin/pur/
      // red/tea/yel and gra) x Bac/Tex/Ico/Bor x levels, ~340 tokens. The nine
      // CHROMATIC families are deliberately left alone below; `gra` is the one
      // that must follow the theme, because a "gray background" callout is
      // asking for a neutral and a fixed #202020 reads as a grey slab dropped
      // into a tinted page.
      "--c-graBacPri": s.sidebarBg,
      "--c-graBacSec": step(0.09),
      "--c-graBacTer": step(0.2),
      "--c-graBacEle": step(0.075),
      "--c-graBacInt": step(0.06),
      "--c-graBorPri": withAlpha(s.fg, 0.12),
      "--c-graBorSec": withAlpha(s.fg, 0.06),
      "--c-graBorStr": withAlpha(s.fg, 0.28),
      "--c-graBorAccPri": withAlpha(s.fg, 0.45),
      "--c-graTexPri": s.fg,
      "--c-graTexSec": s.sidebarMuted,
      "--c-graTexTer": terInk,
      "--c-graTexAccPri": accInk,
      "--c-graTexDis": withAlpha(s.fg, 0.38),
      "--c-graIcoPri": s.fg,
      "--c-graIcoSec": s.sidebarMuted,
      "--c-graIcoTer": terInk,
      "--c-graIcoAccPri": accInk,
      "--c-graIcoDis": withAlpha(s.fg, 0.38),
      "--c-graTexInvPri": onAccent,
      "--c-graTexInvSec": onAccentSoft,
      "--c-graIcoInvPri": onAccent,
      "--c-graIcoInvSec": onAccentSoft,
      "--c-graBorInvPri": withAlpha(onAccent, 0.3),
      "--c-graBacAccPri": s.accent,
      "--c-graBacAccSec": mix(s.accent, s.bg, 0.35),
      // The `gra` family's ALPHA arm, easy to miss because the solid arm above
      // looks like the whole family. It isn't: --ca-graBacTerTra is what paints
      // the block drag-handle grips beside every paragraph, and with only the
      // solid tokens mapped those stayed Notion's rgba(255,252,235,.306) — a warm
      // off-white with no relation to the theme — on 37 elements per page.
      "--ca-graBacIntTra": hoverWash,
      "--ca-graBacPriTra": withAlpha(s.fg, 0.03),
      "--ca-graBacSecTra": withAlpha(s.fg, 0.08),
      "--ca-graBacTerTra": withAlpha(s.fg, 0.3),
      "--ca-graBorPriTra": withAlpha(s.fg, 0.1),
      "--ca-graBorSecTra": withAlpha(s.fg, 0.08),
      "--ca-graBorStrTra": withAlpha(s.fg, 0.3),
      "--ca-graTexDisTra": withAlpha(s.fg, 0.22),
    };

    // DELIBERATELY UNMAPPED, and each for its own reason:
    //
    //  - The nine chromatic block-colour families (--c-blu* / --c-bro* /
    //    --c-gre* / --c-ora* / --c-pin* / --c-pur* / --c-red* / --c-tea* /
    //    --c-yel*, plus their --ca- / --cd- / --cl- twins). A user who coloured a
    //    callout red chose red; that is content, not chrome, and flattening it
    //    into the omarchy palette would erase the distinction the colours exist
    //    to carry. Same line outlook.js draws between the paper it invents and
    //    the design a sender actually specified.
    //  - Scrims: --ca-modUndBac, --ca-oveSmo, --ca-popOveBac,
    //    --ca-embBloResInnBg, all rgba(15,15,15,.6-.8) in BOTH modes. A scrim's
    //    job is to darken whatever is behind it, so it is correct as shipped
    //    even under a light theme — tying it to the theme would make it a
    //    lightening wash on light themes and stop it reading as a scrim.
    //  - --c-shaCol and the --c-sha* / --c-*BoxSha families: shadow colours and
    //    multi-layer box-shadow strings. Shadows are meant to be dark.
    //  - --c-inpRedFocRin: the error ring. Red means invalid; the accent doesn't.
    //  - --c-marStaSel / --ca-marStaDef / --c-topFav: the star and highlighter
    //    golds, which read as "marked" precisely because nothing else is gold.
    //  - --c-assCorButBac: an always-light chip (#fff light, #d3d3d3 dark) whose
    //    ink is not exposed as a token, so retinting the fill alone could invert
    //    its contrast.
    //  - --c-palGra100..400 do not exist; that stretch of the ramp is --cl-.
    return vars;
  },

  // The one thing the token layer cannot reach: Notion's BOOT STYLESHEET.
  //
  // Notion inlines a ~3.4KB <style> in the document head, before any of its token
  // sheets, holding the pre-hydration loading skeleton — and every colour in it is
  // a HARDCODED LITERAL, not a var:
  //
  //   body{background:#fff}            body.dark{background:#191919}
  //   #skeleton{background:#fff}       body.dark #skeleton{background:#191919}
  //   #skeleton-sidebar{background-color:#f9f8f7; box-shadow:inset ... #f0efed}
  //   .startup-shimmer{...}            #skeleton .chevron{fill:...}
  //   #initial-loading-spinner .spinner__circle{border:2px solid rgba(28,19,1,.11)}
  //
  // Two distinct symptoms, which is why this is worth a hook rather than being
  // written off as a load-time detail:
  //
  //  1. `body` keeps #191919 (or #fff) for the WHOLE SESSION. Notion's panes cover
  //     it, so it is easy to miss — until an overscroll rubber-band exposes it, or
  //     a pane leaves a gap. body's background is also what propagates to the
  //     viewport canvas, so this is the colour the browser paints outside the
  //     document as well.
  //  2. Every page load flashes Notion's own greys — a #191919 page with a #202020
  //     rail — before hydration swaps in the themed app.
  //
  // These live in a normal stylesheet with no !important and no inline styles, so
  // unlike the surfaces Slack and Outlook paint inline, an ordinary !important
  // rule is enough; no observer, no inline painting. The skeleton nodes are gone
  // after hydration, so most of this only ever matters for the first second.
  apply(theme, s) {
    let style = document.getElementById("omarchy-notion-boot");
    if (!style) {
      style = document.createElement("style");
      style.id = "omarchy-notion-boot";
      (document.head || document.documentElement).appendChild(style);
    }
    const codeCss = notionCodeCss(theme, s);

    // The skeleton's own ladder is page → rail → shimmer bar, so keep three
    // distinguishable steps rather than flattening it to one colour: a skeleton
    // that is all one shade reads as a broken page rather than a loading one.
    const shimmer = mix(s.sidebarBg, s.fg, 0.12);
    const railEdge = withAlpha(s.fg, 0.12);

    style.textContent = [
      // Both arms of Notion's rule (plain and .dark) are overridden, because
      // which one applies depends on Notion's OWN class, and the omarchy theme
      // that has to win is ours either way — a light omarchy theme with Notion
      // still in dark mode mid-flip would otherwise keep #191919.
      "html body, html body.dark { background: " + s.bg + " !important; }",
      "html body #skeleton, html body.dark #skeleton { background: " + s.bg + " !important; }",
      // The signed-out/front-page variant hardcodes its own near-white.
      "html.notion-front-page, html.notion-front-page body," +
        " html.notion-front-page #notion-app { background: " + s.bg + " !important; }",
      "html body #skeleton-sidebar, html body.dark #skeleton-sidebar {" +
        " background-color: " + s.sidebarBg + " !important;" +
        " box-shadow: inset calc(var(--direction, 1) * -1px) 0 0 0 " + railEdge + " !important; }",
      "html body .startup-shimmer, html body.dark .startup-shimmer {" +
        " background: " + shimmer + " !important; }",
      "html body #skeleton .chevron, html body.dark #skeleton .chevron {" +
        " fill: " + shimmer + " !important; }",
      // The boot spinner: a faint ring with a brighter arc sweeping it. The arc
      // has to stay clearly stronger than the ring or the spinner reads as a
      // static circle.
      "html body #initial-loading-spinner .spinner__circle," +
        " html body.dark #initial-loading-spinner .spinner__circle {" +
        " border-color: " + withAlpha(s.fg, 0.12) + " !important; }",
      "html body #initial-loading-spinner .spinner__arc," +
        " html body.dark #initial-loading-spinner .spinner__arc {" +
        " border-top-color: " + s.fg + " !important;" +
        " border-right-color: " + s.fg + " !important;" +
        " border-bottom-color: transparent !important;" +
        " border-left-color: transparent !important; }",
    ].concat(codeCss).join("\n");
  },
});
