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
// NEVER REMAPPED AT :root: --white (401 uses) and --black (157 uses). Despite the
// names these are NOT literals — Outlook swaps them by mode (measured 2026-08-05
// on the live mailbox: --white is #FFFFFF in light and #000000 in dark, --black
// the reverse), so the pair behaves as page/ink. They are nonetheless still spent
// on icon fills, on text over brand-coloured buttons, and on borders across
// saturated fills, where a theme surface inverts contrast. So --white is
// redefined only inside Outlook's stable data-app-section regions (see apply()),
// which reaches the surfaces that need it and leaves the rest alone.
//
// Light/dark needs no automation: Outlook follows the system preference, which
// the MAIN-world shim (inject-prefers-color-scheme.js) flips on every omarchy
// theme apply.

// Outlook converts light HTML mail to dark ITSELF, before our tokens get a say.
// The transform rewrites every colour inline with !important and records what the
// sender originally specified in data-ogsb / data-ogsc ("original get style
// background/color"). A plain white email becomes a flat neutral #292929, which
// on a tinted omarchy theme reads as a grey slab floating inside the themed
// reading pane — the transform has no idea we repainted the surface around it.
//
// data-ogsb also draws the line between "backdrop" and "the sender's design":
//   - original white, or absent entirely → PAPER. Outlook invented this surface;
//     retinting it is what stops the clash, and costs the email nothing.
//   - original an actual colour (a #f5f5f5 band, a #f8f8f8 card) → the sender
//     drew that deliberately. Leave Outlook's transform alone; collapsing it onto
//     our background would erase the message's structure.
// Verified on live mail (2026-08-05): a newsletter body wrapper with NO original
// and five full-width tables originally #ffffff all became #292929, while the
// sender's #f5f5f5 band became #2e2e2e and stayed distinct.
// Two tiers rather than one cliff. A sender's pure white is paper and becomes the
// pane itself. But senders also band sections in off-whites (#f4f4f4, #f5f5f5,
// #f8f8f8), and Outlook turns those into their own neutral greys — #2e2e2e next
// to #292929 — which is still a grey slab sitting in a tinted card even once the
// paper around it is fixed. Treating them as paper too would erase the banding
// the sender intended, so they instead get a small step off the pane IN THE
// THEME'S HUE: the structure survives, the neutral clash doesn't. Anything
// genuinely coloured is the sender's design and is left to Outlook's transform.
const PAPER_LUMINANCE = 0.95;
const NEAR_PAPER_LUMINANCE = 0.85;

// Returns the colour to repaint with, or null to leave the transform alone.
function outlookPaperTarget(rgb, surfaces) {
  if (!rgb) return null;
  const lum = relLuminance(rgb);
  if (lum >= PAPER_LUMINANCE) return surfaces.paper;
  if (lum >= NEAR_PAPER_LUMINANCE) return surfaces.nearPaper;
  return null;
}

// data-ogsb holds whatever the SENDER wrote, in whatever CSS colour syntax they
// wrote it: "white", "#FFF", "rgb(255,255,255)". Let the browser normalise it
// instead of hand-parsing colour syntax — hexToRgb() understands hex and rgb()
// only, so a plain keyword returned null, every "white" signature failed the
// paper test, and quoted signatures stayed a grey slab inside the themed card.
let outlookColorProbe = null;

function resolveOutlookColor(value) {
  if (!outlookColorProbe) return hexToRgb(value);
  outlookColorProbe.style.color = "";
  outlookColorProbe.style.color = value; // invalid syntax leaves it empty
  if (!outlookColorProbe.style.color) return null;
  return hexToRgb(getComputedStyle(outlookColorProbe).color);
}

function outlookOriginalTarget(original, surfaces) {
  return outlookPaperTarget(resolveOutlookColor(original), surfaces);
}

// The transform has a SECOND mechanism, used in the composer and in quoted
// replies. Outlook builds a per-message substitution table as inline custom
// properties on the message container, keyed by the colour being replaced:
//
//   --darkColor_rgb_255__255__255_: rgb(41, 41, 41)   the sender's white → paper
//   --darkColor_rgb_0__0__0_:       rgb(255, 255, 255) their black ink → white
//
// and elements then reference var(--darkColor_rgb_255__255__255_, rgb(255,255,255)).
// Overriding the paper entry retints every element that references it at once,
// which is why signatures and quoted text stay neutral if only the data-ogsb
// path is handled. The name carries the ORIGINAL colour, so the same
// paper-vs-sender's-design test applies to it.
function substitutionTarget(name, surfaces) {
  if (name.includes("_white_")) return surfaces.paper;
  const m = name.match(/rgb_(\d+)__(\d+)__(\d+)_?$/);
  if (!m) return null;
  return outlookPaperTarget({ r: +m[1], g: +m[2], b: +m[3] }, surfaces);
}

function retintOutlookSubstitutionTable(surfaces) {
  for (const el of document.querySelectorAll('[style*="--darkColor"]')) {
    // Collect first: setProperty() while iterating el.style is asking for
    // trouble, and most elements here are var CONSUMERS with nothing to change.
    const edits = [];
    for (let i = 0; i < el.style.length; i++) {
      const name = el.style[i];
      if (!name.startsWith("--darkColor")) continue;
      const target = substitutionTarget(name, surfaces);
      if (target) edits.push([name, target]);
    }
    // Their table entries carry no priority, so inline-important beats them.
    for (const [name, target] of edits) el.style.setProperty(name, target, "important");
  }
}

function retintOutlookPaper(s, nowMarker) {
  // Exactly the reading pane's own colour, NOT a step off it. The message body
  // fills the pane edge to edge, so any offset — even a subtle one — reads as a
  // mismatched slab dropped into the pane rather than as elevation. Paper and
  // pane being the same surface is the whole point: the email should look like it
  // is printed on the pane, not floating above it.
  const surfaces = { paper: s.bg, nearPaper: shade(s.bg, s.dir * 0.03) };

  // Path 1: the substitution table (composer, signatures, quoted replies).
  retintOutlookSubstitutionTable(surfaces);

  // The calendar's now-marker — shape-anchored, see the helper.
  retintOutlookNowMarker(nowMarker);

  // Path 2: received mail, where the transform writes the resolved colour
  // straight onto the element as an inline literal and records the original in
  // data-ogsb. No var to intercept, so these are repainted individually.
  for (const root of document.querySelectorAll('[id^="UniqueMessageBody"]')) {
    const full = root.getBoundingClientRect().width;
    if (!full) continue;
    for (const el of [root, ...root.querySelectorAll("[data-ogsb]")]) {
      if (!el.hasAttribute("data-ogsb")) continue;
      const original = el.getAttribute("data-ogsb");
      let target;
      if (original) {
        // A recorded original settles it on its own — size must NOT enter into it
        // here. Signature and quoted-reply paragraphs are white-on-paper but only
        // ~85% of the body width, and a width test drops them, leaving grey bands
        // down the bottom of every reply.
        target = outlookOriginalTarget(original, surfaces);
      } else {
        // No original: Outlook invented the fill. Only a full-width surface is a
        // backdrop; it invents fills for link chips and buttons too (88x34 in the
        // wild), and those are the sender's controls, not paper.
        target = el.getBoundingClientRect().width >= full * 0.9 ? surfaces.paper : null;
      }
      if (!target) continue;
      // Inline + important, because the transform's own inline !important beats
      // any stylesheet we could add.
      el.style.setProperty("background-color", target, "important");
    }
  }
}

// The calendar's "now" marker: a dashed line across today's column with a round
// knob at its left edge. Outlook draws both from --themePrimary, which the pack
// maps to the accent — so the one marker you scan the grid for ended up the same
// colour as everything else on it. Unthemed Outlook draws it red, and that reads
// as "now" precisely because nothing else in the grid is red.
//
// This CANNOT be done in the stylesheet, and the two obvious attempts both fail:
//
//   - Re-scoping --themePrimary to the day grid also recolours the SELECTED TIME
//     SLOT, which reads the same token and lives in the same grid (measured: the
//     other consumer sits under an element labelled "5:30 PM to 6:00 PM,
//     Monday"). A selection turning red is worse than the bug.
//   - Widening to [data-app-section^="calendar-view"] is worse still: it also
//     matches "calendar-view-header-0", the header strip, taking the date
//     numbers, the new-event "+" and the today-column border red with it.
//
// The marker's own classes are hashed (tWCGp / lJS6W), so they can't be named.
// What IS stable is its shape, which only JS can test: inside the day grid there
// is exactly ONE element with a circular ::before (the knob) and exactly ONE with
// a dashed top border (the line), and they are siblings. Anchor on the circle,
// paint it and its dashed sibling, touch nothing else.
//
// Inline + important because Outlook's own rules set these through the token.
function retintOutlookNowMarker(color) {
  if (!color) return;
  const grid = document.querySelector(
    '[data-app-section^="calendar-view"][class*="inDayContentChild"]',
  );
  if (!grid) return;
  for (const el of grid.querySelectorAll("div")) {
    const before = getComputedStyle(el, "::before");
    if (!before || before.content === "none") continue;
    const radius = before.borderRadius || "";
    if (!(radius.includes("100%") || radius.includes("50%"))) continue;
    if (before.backgroundColor === "rgba(0, 0, 0, 0)") continue;
    // The knob paints via its own background; ::before inherits it.
    el.style.setProperty("background-color", color, "important");
    const parent = el.parentElement;
    if (!parent) continue;
    for (const sib of parent.children) {
      if (sib === el) continue;
      if (getComputedStyle(sib).borderTopStyle !== "dashed") continue;
      sib.style.setProperty("border-top-color", color, "important");
    }
  }
}

let outlookPaperObserver = null;
let outlookPaperQueued = false;

function watchOutlookPaper(s, nowMarker) {
  if (!document.body) return;
  // Create the colour probe BEFORE the observer exists. It has to live in the
  // document to have a computed style, and the observer watches body's subtree
  // for childList changes — appending it afterwards would feed our own insertion
  // back in as a mutation.
  if (!outlookColorProbe) {
    outlookColorProbe = document.createElement("span");
    outlookColorProbe.style.display = "none";
    document.body.appendChild(outlookColorProbe);
  }
  retintOutlookPaper(s, nowMarker);
  if (outlookPaperObserver) outlookPaperObserver.disconnect();
  // childList/subtree ONLY. Our repaint writes the style attribute, so observing
  // attributes would feed our own change straight back in as a mutation loop.
  outlookPaperObserver = new MutationObserver(() => {
    if (outlookPaperQueued) return;
    outlookPaperQueued = true;
    requestAnimationFrame(() => {
      outlookPaperQueued = false;
      retintOutlookPaper(s, nowMarker);
    });
  });
  outlookPaperObserver.observe(document.body, { childList: true, subtree: true });
}

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

    // Fluent's own light ladder steps each panel further from the page:
    // #ffffff reading pane → #f5f5f5 message list → #f0f0f0 rail/header. The rail
    // therefore needs to sit a step off the LIST, not share its colour.
    //
    // s.chromeBg can't carry that on its own: it is theme.chrome || sidebarBg, and
    // only 5 of the 22 shipped omarchy themes provide a chromium.theme. On the
    // other 17 it collapses onto sidebarBg, so rail, ribbon, header and message
    // list all paint one flat colour and the nested panels read as a single slab.
    // Keep chromeBg when the theme really ships one (that's what makes the app
    // match Brave's toolbar tint); otherwise step off the list surface instead.
    const railBg = theme.chrome || shade(s.sidebarBg, s.dir * 0.04);

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
      "--colorNeutralBackground4": railBg,
      "--colorNeutralBackground5": bg5,
      "--colorNeutralBackground6": bg6,
      "--colorNeutralBackgroundDisabled": bg2,

      // Subtle (transparent-by-default) button surfaces.
      "--colorSubtleBackgroundHover": s.hoverBg,
      "--colorSubtleBackgroundPressed": s.selectedBg,
      "--colorSubtleBackgroundSelected": s.selectedBg,
      // The LightAlpha trio is Fluent's overlay set for controls sitting on a
      // BRANDED fill, and the app rail's own <FluentProvider> re-declares it on
      // its wrapper — where :root can't reach, though the engine's
      // "html, html *" !important sweep can. Left alone, the selected app tile
      // paints #1aebff: a saturated cyan that belongs to no omarchy palette and
      // reads as a highlighter smear down the rail.
      "--colorSubtleBackgroundLightAlphaSelected": s.selectedBg,
      "--colorSubtleBackgroundLightAlphaHover": s.hoverBg,
      "--colorSubtleBackgroundLightAlphaPressed": s.selectedBg,

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
      "--neutralTertiarySurface": railBg,
      // The calendar grid's past / out-of-range time slots. Outlook offsets them
      // slightly from the live area rather than matching it (white vs #fafafa),
      // so keep a gentle offset instead of collapsing them onto the background —
      // otherwise past and upcoming hours become indistinguishable.
      "--neutralLighterAlt": shade(s.bg, s.dir * 0.03),
      "--headerBackground": railBg,
      "--headerBackgroundSearch": railBg,
      "--headerButtonsBackground": railBg,
      "--headerButtonsBackgroundSearch": railBg,

      // ----- Suite-header INK -----
      // The header's own foreground family ships as #000000 across the board
      // (--headerTextIcons alone drives 11 declarations: the waffle, the mail and
      // settings glyphs, the avatar ring). Outlook's stock header is a saturated
      // brand fill, so black-on-blue is legible for THEM; painted onto a themed
      // bar it lands at about 1.9:1 and the icons all but vanish. Mapping only the
      // header backgrounds — which is what the pack did — repaints the bar and
      // leaves its contents black, so the ink has to move with it.
      // fgStrong, not fg: the rail is a step off the page, so plain fg lands under
      // the AA floor on low-headroom themes (rose-pine 4.38:1). fgStrong clears
      // every shipped theme, worst case 6.24:1 — and chrome glyphs want to read
      // as firmly as the app's own ink anyway.
      "--headerTextIcons": s.fgStrong,
      "--headerBrandText": s.fgStrong,
      "--headerSearchIcon": s.fgStrong,
      // Search well: a darker inset on the bar, so it still reads as a field.
      "--headerSearchBoxBackground": s.bg,
      "--headerSearchBoxIcon": s.sidebarMuted,
      "--headerSearchPlaceholderText": s.sidebarMuted,
      // The filled search/submit button and the unread badge are emphasis fills,
      // so their ink is the background colour, not the foreground.
      "--headerSearchButtonBackground": s.accent,
      "--headerSearchButtonIcon": s.bg,
      "--headerSearchFilters": s.accent,
      "--headerBadgeBackground": s.accent,
      "--headerBadgeText": s.bg,
      "--headerButtonsBackgroundHover": s.hoverBg,
      "--headerButtonsBackgroundSearchHover": s.hoverBg,
      "--headerSearchButtonBackgroundHover": shade(s.accent, -s.dir * 0.06),
      "--headerSearchFiltersHover": s.hoverBg,
      "--neutralLight": railBg,
      "--neutralLighter": s.sidebarBg,
    };
  },

  // The message-list rows are the one surface the token layer can't reach: they
  // paint from --white. That token is not the literal its name suggests — Outlook
  // swaps it with --black by mode — but it is still spent on icon fills and on
  // text over brand-coloured buttons, so remapping it at :root inverts contrast
  // where it matters.
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
    // A band inside the message list, a step off the rows rather than a step off
    // the chrome — see the rule below for why it can't just be sidebarBg.
    const listBand = shade(s.bg, s.dir * 0.04);
    // Recessive scrollbar: present when you look for it, not competing with the
    // message list. Alpha, so it works over whichever surface it is drawn on.
    const thumb = withAlpha(s.fg, 0.15);
    const thumbHover = withAlpha(s.fg, 0.3);

    // "Now" marker on the calendar — see retintOutlookNowMarker().
    //
    // A highlight drawn from the theme rather than a hardcoded red: amber reads
    // as "look here" without implying an error. Resolved by HUE so a slot merely
    // NAMED yellow can't hand back a green, and the ACCENT is passed as `taken`
    // so the result must be perceptually distinct from it (>= 18 dE) — otherwise
    // a theme whose accent is already amber would put the marker right back to
    // blending into the grid, which is the bug being fixed.
    //
    // Falls through amber -> red -> the palette's most distant colour -> a real
    // red. The third step matters on palettes with no warm hue at all: on
    // spacex-terrafab every slot is a blue or a violet (its "red" is #9c8ba9),
    // so amber and red both correctly decline, and without it the marker would
    // land on a hardcoded red that belongs to no part of the theme. There, the
    // palette's own #bcfbff sits 50 dE from the accent and reads at a glance.
    const pal = theme.colors || {};
    const nowMarker =
      statusColor(pal, "attention", [s.accent], null) ||
      statusColor(pal, "danger", [s.accent], null) ||
      highlightColor(pal, s.accent, s.bg) ||
      (s.isDark ? "#f85149" : "#d20f39");

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

      // Date-group headers ("Today", "Yesterday") paint from Background3 — and so
      // does the folder pane, so the two came out the SAME colour while sitting
      // directly next to each other, reading as one continuous slab rather than
      // two panels. They can't be separated through the token layer alone because
      // they share the token, so redefine it just inside the message list: the
      // band drops toward the rows it belongs to, and the folder pane keeps the
      // sidebar surface. Custom properties inherit, so this reaches the generated
      // class names without naming any of them. !important and an attribute
      // selector are both required to beat the engine's own
      // "html, html * { ... !important }" sweep.
      // The descendant arm is NOT redundant. The engine writes cssVars as
      // "html, html * { ... !important }" — every element gets its own copy — so
      // a declaration on the section alone never inherits down; each descendant
      // already carries an important one of its own. Re-declaring on the
      // descendants wins on specificity: (0,1,0) for the attribute selector plus
      // universal, against (0,0,1) for "html *".
      '[data-app-section="MessageList"], [data-app-section="MessageList"] * {' +
        "  --colorNeutralBackground3: " + listBand + " !important;" +
        "  --neutralSecondarySurface: " + listBand + " !important;" +
        "}",

      // NB: the calendar's current-time marker is NOT handled here — it can't be.
      // See retintOutlookNowMarker() for why a stylesheet can't express it.

      // Scrollbars. Outlook points the thumb at --colorNeutralStroke1, a 22%
      // foreground wash built for BORDERS, which makes the bar the brightest
      // thing in a quiet list. Give it its own recessive value instead of
      // dragging every border darker with it. scrollbar-color covers the
      // standard property; the -webkit- pseudos beat Outlook's own
      // class-scoped rules (theirs carry no !important).
      "html, body { scrollbar-color: " + thumb + " transparent; }",
      "::-webkit-scrollbar-track { background: transparent !important; }",
      "::-webkit-scrollbar-thumb { background-color: " + thumb + " !important; border-radius: 4px !important; }",
      "::-webkit-scrollbar-thumb:hover { background-color: " + thumbHover + " !important; }",
    ].join("\n");

    // Retint the backdrop Outlook's dark-mode transform invents for a message
    // body. Inline + observed rather than declared, for the reasons above the
    // helper: the transform writes inline !important, and it re-runs whenever the
    // reading pane swaps to another message.
    watchOutlookPaper(s, nowMarker);
  },
});
