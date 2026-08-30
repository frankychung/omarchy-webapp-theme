// Reddit pack for the Omarchy web-app theming engine — declarative tier.
//
// Reddit's current front end is "shreddit" (web components; the successor to the
// 2018 React redesign). It themes through a large, regular semantic token set,
// which is what makes a pure cssVars table practical here.
//
// Verified live 2026-08-31, logged in, against www.reddit.com — 376 colour-valued
// custom properties enumerated across both polarities. Three measurements decide
// the shape of this pack:
//
//   (1) ZERO triplet-valued tokens. Nothing here is consumed as
//       `rgb(var(--x))`, so every token takes a real colour and the format trap
//       that shaped the Slack and HEY packs simply does not exist on Reddit.
//   (2) Almost no inline painting: 20 of 2901 elements on the logged-in home
//       feed carry a colour-valued style attribute, and NOT ONE carries an
//       inline `!important`. The engine's inline-important redefinition wins
//       everywhere, so there is no observer or rAF repaint path.
//   (3) Light/dark rides prefers-color-scheme with no user setting and no
//       automation. Reddit stamps `theme-dark` on <html> from a matchMedia
//       listener, which the MAIN-world shim drives — verified by emulating the
//       media feature at boot and observing the class flip. Nothing to pin, so
//       this pack has no onColorMode hook.
//
// One methodology note for whoever edits this next: 7 of Reddit's 27
// stylesheets are CROSS-ORIGIN, so `cssRules` throws on them and the CSSOM walk
// documented in CLAUDE.md (written against Slack, whose sheets are same-origin)
// only sees a fraction of the token set. Enumerate by fetching the stylesheet
// hrefs over HTTP and parsing the text, then resolve each name through
// getComputedStyle on <html> for its per-polarity value.
//
// COMMUNITY THEMES ARE GONE. Subreddits used to carry a mod-chosen key colour.
// Sweeping eight heavily-branded subreddits (r/formula1, r/nba, r/wow,
// r/leagueoflegends, r/Genshin_Impact, r/superstonk, r/StarWars, r/Minecraft)
// while logged in returns an IDENTICAL --color-neutral-background on every one
// and no community-scoped declarations anywhere. What a subreddit still
// customises is its banner IMAGE and icon, which are media and left alone. So
// unlike GitHub's marketing site there is no per-page opt-out to build.

// Reddit's shipped vote colours, kept as the fallback when the theme's palette
// has nothing chromatic enough to spend. Sampled from the live app; the base
// and hover values are mode-invariant, only the *content* ink differs.
const REDDIT_UPVOTE = { base: "#D93900", content: { dark: "#FF4500", light: "#AE2C00" } };
const REDDIT_DOWNVOTE = { base: "#6A5CFF", content: { dark: "#9580FF", light: "#523DFF" } };

// Match the engine's own floor for a NAMED palette slot (omarchy-colors.js
// NAMED_MIN_CHROMA). Below this the slot is effectively grey, and a grey vote
// arrow destroys the one distinction on the page that has to survive: which way
// you voted. Monochrome themes (white, vantablack) therefore keep Reddit's
// orangered and periwinkle rather than getting two identical grey arrows.
const VOTE_MIN_CHROMA = 20;

function voteHue(palette, slot, fallback) {
  const c = (palette || {})[slot];
  return c && chromaOf(c) >= VOTE_MIN_CHROMA ? c : fallback;
}

OmarchyTheme.register({
  id: "reddit",

  cssVars(theme, s) {
    const palette = theme.colors || {};
    const dir = s.dir;

    // Recessed vs. raised. Reddit's ladder runs BOTH ways from the page: `weak`
    // is the outer canvas behind the feed (darker than the page on dark themes,
    // #000000 vs #0E1113) while `container`/`strong` are the post cards on top
    // of it. So `weak` shades AGAINST dir and the rest shade with it.
    const recessed = shade(theme.bg, -dir * 0.02);
    const raised1 = shade(theme.bg, dir * 0.03);
    const raised2 = shade(theme.bg, dir * 0.05);
    const raised3 = shade(theme.bg, dir * 0.08);
    const raised4 = shade(theme.bg, dir * 0.12);

    // Post cards sit on the accent-tinted sidebar surface, the same aesthetic
    // choice the Slack and Discord packs make for their chrome.
    const card = s.sidebarBg;
    const cardHover = shade(card, dir * 0.04);
    const cardStrong = shade(card, dir * 0.06);

    // Ink that rides on an accent fill (primary buttons, vote pills). Solved
    // rather than assumed: a light omarchy accent needs dark ink, and
    // catppuccin-latte's accent would make white text unreadable.
    const onAccent = inkOn(s.accent, [theme.bg, s.fg]);

    // Status roles come from the theme where it has a defensible hue and fall
    // back to Reddit's own otherwise — statusPalette declines to invent one.
    const status = statusPalette(palette, {
      danger: "#EB001F",
      success: "#008A10",
      attention: "#FFBF0B",
      done: "#1870F4",
    });
    const danger = status.danger;
    const success = status.success;
    const caution = status.attention;
    const onDanger = inkOn(danger, [theme.bg, s.fg]);
    const onSuccess = inkOn(success, [theme.bg, s.fg]);
    const onCaution = inkOn(caution, [theme.bg, s.fg]);

    // Votes keep their MEANING but take the theme's own hue, the same treatment
    // discord.js gives the red ping badge. Red for upvote is the closest palette
    // role to orangered; magenta is the honest match for the new periwinkle
    // downvote (Reddit moved it off blue).
    const up = voteHue(palette, "red", REDDIT_UPVOTE.base);
    const down = voteHue(palette, "magenta", REDDIT_DOWNVOTE.base);
    const upContent = up === REDDIT_UPVOTE.base
      ? REDDIT_UPVOTE.content[s.isDark ? "dark" : "light"]
      : shade(up, dir * 0.1);
    const downContent = down === REDDIT_DOWNVOTE.base
      ? REDDIT_DOWNVOTE.content[s.isDark ? "dark" : "light"]
      : shade(down, dir * 0.1);
    const onUp = inkOn(up, [theme.bg, s.fg]);
    const onDown = inkOn(down, [theme.bg, s.fg]);

    return {
      // ===== neutral surfaces =====
      "--color-neutral-background": theme.bg,
      "--color-neutral-background-weak": recessed,
      "--color-neutral-background-weak-hover": raised1,
      "--color-neutral-background-hover": s.hoverBg,
      "--color-neutral-background-selected": s.selectedBg,
      "--color-neutral-background-container": card,
      "--color-neutral-background-container-hover": cardHover,
      "--color-neutral-background-container-strong": cardStrong,
      "--color-neutral-background-container-strong-hover": shade(card, dir * 0.09),
      "--color-neutral-background-strong": raised2,
      "--color-neutral-background-strong-hover": raised3,
      "--color-neutral-background-medium": raised1,
      "--color-neutral-background-canvas": s.chromeBg,
      "--color-neutral-background-pinned": card,
      "--color-neutral-background-highlighted": withAlpha(s.accent, 0.12),
      "--color-neutral-background-highlighted-strong": withAlpha(s.accent, 0.2),
      // The gold "gilded" wash. Left semantic but re-tinted from the theme's
      // attention hue, so it does not sit on a dark theme as Reddit's neutral
      // grey (its dark value is #181C1F, which would read as an unthemed patch).
      "--color-neutral-background-gilded": mix(theme.bg, caution, 0.12),
      "--color-neutral-background-gilded-hover": mix(theme.bg, caution, 0.18),
      "--shreddit-content-background": theme.bg,
      "--color-ui-canvas": theme.bg,
      "--color-ui-modalbackground": card,
      "--styled-scrollbar-background": withAlpha(s.fg, 0.2),

      // ===== neutral ink =====
      "--color-neutral-content-strong": s.fgStrong,
      "--color-neutral-content": s.fg,
      "--color-neutral-content-weak": s.sidebarMuted,
      "--color-neutral-content-disabled": withAlpha(s.fg, 0.3),
      "--color-plain-onBackground": s.fg,
      "--color-label-default": s.fg,

      // ===== borders =====
      "--color-neutral-border-weak": s.borderColor,
      "--color-neutral-border": withAlpha(s.fg, 0.2),
      "--color-neutral-border-medium": withAlpha(s.fg, 0.5),
      "--color-neutral-border-strong": s.fg,
      "--color-neutral-border-divider": withAlpha(s.fg, 0.15),
      "--color-divider-default": withAlpha(s.fg, 0.15),

      // ===== primary (accent) =====
      // Reddit's stock primary button is inverted-neutral rather than a brand
      // colour — black on light, near-white on dark. Repointing it at the accent
      // is the whole point of the extension, and matches what the Discord pack
      // does with its brand ladder.
      "--color-primary": s.accent,
      "--color-primary-hover": shade(s.accent, dir * 0.08),
      "--color-primary-background": s.accent,
      "--color-primary-background-hover": shade(s.accent, dir * 0.08),
      "--color-primary-background-selected": shade(s.accent, -dir * 0.08),
      "--color-primary-background-highlighted": withAlpha(s.accent, 0.15),
      "--color-primary-onBackground": onAccent,
      "--color-primary-onBackground-selected": onAccent,
      "--color-primary-border": s.accent,
      "--color-primary-border-hover": shade(s.accent, dir * 0.08),
      "--color-primary-plain": s.accent,
      "--color-primary-plain-hover": shade(s.accent, dir * 0.1),
      "--color-primary-plain-selected": s.fgStrong,
      "--color-primary-plain-visited": voteHue(palette, "magenta", "#CF5FFF"),
      "--color-primary-visited": voteHue(palette, "magenta", "#CF5FFF"),
      "--color-primary-switchBackground": raised3,
      "--color-primary-switchBackground-hover": raised4,
      "--color-primary-switchBackground-selected": s.accent,
      "--color-primary-switchBackground-selected-hover": shade(s.accent, dir * 0.08),
      "--color-action-primary": s.accent,
      // Links in prose and the legacy anchor set.
      "--color-a-default": s.accent,
      "--color-a-hover": shade(s.accent, dir * 0.1),
      "--color-a-visited": voteHue(palette, "magenta", "#CF5FFF"),
      // --color-primarynext-* is the same family mid-migration; mirror it or the
      // two generations disagree on the same button.
      "--color-primarynext-background": s.accent,
      "--color-primarynext-background-hover": shade(s.accent, dir * 0.08),
      "--color-primarynext-border": s.accent,
      "--color-primarynext-border-hover": shade(s.accent, dir * 0.08),
      "--color-primarynext-onBackground": onAccent,
      "--color-primarynext-plain": s.accent,
      "--color-primarynext-plain-hover": shade(s.accent, dir * 0.1),
      "--color-primarynext-plain-selected": s.fgStrong,
      "--color-primarynext-plain-visited": voteHue(palette, "magenta", "#CF5FFF"),

      // ===== secondary (raised neutral + its ink) =====
      "--color-secondary": s.fg,
      "--color-secondary-weak": s.sidebarMuted,
      "--color-secondary-hover": s.fgStrong,
      "--color-secondary-background": raised3,
      "--color-secondary-background-hover": raised4,
      "--color-secondary-background-selected": s.selectedBg,
      "--color-secondary-onBackground": s.fgStrong,
      "--color-secondary-plain": s.fg,
      "--color-secondary-plain-weak": s.sidebarMuted,
      "--color-secondary-plain-hover": s.fgStrong,
      "--color-action-secondary": s.fg,

      // ===== buttons =====
      "--color-button-primary-background-hover": shade(s.accent, dir * 0.08),
      "--color-button-primary-background-activated": shade(s.accent, -dir * 0.08),
      "--color-button-primary-background-disabled": withAlpha(s.fg, 0.05),
      "--color-button-primary-text-activated": onAccent,
      "--color-button-primary-text-disabled": withAlpha(s.fg, 0.25),
      "--color-button-primary-border-active": s.accent,
      "--color-button-primary-border-hover": shade(s.accent, dir * 0.08),
      "--color-button-secondary-background": raised3,
      "--color-button-secondary-background-focus": raised3,
      "--color-button-secondary-background-hover": raised4,
      "--color-button-secondary-background-activated": shade(theme.bg, dir * 0.15),
      "--color-button-secondary-background-disabled": withAlpha(s.fg, 0.05),
      "--color-button-secondary-text": s.fgStrong,
      "--color-button-secondary-text-activated": s.fgStrong,
      "--color-button-secondary-text-disabled": withAlpha(s.fg, 0.25),
      "--color-button-secondary-border-active": raised4,
      "--color-button-secondary-border-hover": raised3,
      "--color-button-plain-text": s.fg,
      "--color-button-plain-text-hover": s.fgStrong,
      "--color-button-plain-text-activated": s.fgStrong,
      "--color-button-plain-text-weak": s.sidebarMuted,
      "--color-button-plain-text-disabled": withAlpha(s.fg, 0.25),
      "--color-button-plain-background-hover": s.hoverBg,
      "--color-button-plain-background-activated": s.selectedBg,
      "--color-button-plain-border-active": raised4,
      "--color-button-plain-border-hover": raised3,
      "--color-button-tertiary-text": s.fg,
      "--color-button-tertiary-text-activated": onAccent,
      "--color-button-tertiary-text-disabled": withAlpha(s.fg, 0.25),
      "--color-button-tertiary-background-hover": s.hoverBg,
      "--color-button-tertiary-background-activated": s.accent,
      "--color-button-tertiary-border-active": raised4,
      "--color-button-tertiary-border-hover": raised3,
      "--color-button-caution-background": caution,
      "--color-button-caution-background-hover": shade(caution, dir * 0.08),
      "--color-button-caution-background-disabled": withAlpha(s.fg, 0.05),
      "--color-button-caution-text": onCaution,
      // The legacy flat --button-color-* set, still consumed 26 times.
      "--button-color-background-default": raised3,
      "--button-color-background-focus": raised3,
      "--button-color-background-hover": raised4,
      "--button-color-background-activated": shade(theme.bg, dir * 0.15),
      "--button-color-background-disabled": withAlpha(s.fg, 0.05),
      "--button-color-text-default": s.fgStrong,
      "--button-color-text-activated": s.fgStrong,
      "--button-color-text-disabled": withAlpha(s.fg, 0.25),

      // ===== inputs =====
      "--color-input-default": raised1,
      "--color-input-hover": raised2,
      "--color-input-pressed": withAlpha(s.fg, 0.15),
      "--color-input-text": s.fgStrong,
      "--color-input-helper-text": s.sidebarMuted,
      "--color-input-secondary": raised3,
      "--color-input-secondary-hover": raised4,
      "--color-input-secondary-text": s.fg,
      "--color-input-bordered-hover": raised1,
      "--color-input-bordered-text": s.fg,
      "--color-input-radio": s.sidebarMuted,
      "--color-input-radio-hover": s.fg,

      // ===== interactive states =====
      "--color-interactive-content-disabled": withAlpha(s.fg, 0.25),
      "--color-interactive-background-disabled": withAlpha(s.fg, 0.05),
      "--color-interactive-pressed": withAlpha(s.fg, 0.15),
      "--color-interactive-focused": s.accent,
      "--color-transparent-background-hover": s.hoverBg,

      // ===== switches =====
      "--color-switch-input-background-default": raised3,
      "--color-switch-input-background-default-hover": raised4,
      "--color-switch-input-background-checked": s.accent,
      "--color-switch-input-background-checked-hover": shade(s.accent, dir * 0.08),
      "--color-switch-input-background-handle": inkOn(raised3, [s.fg, theme.bg]),
      "--color-switch-input-background-hover": raised4,
      "--color-switch-input-background-disabled": withAlpha(s.fg, 0.05),
      "--color-switch-input-background-pressed-scrim": withAlpha(s.fg, 0.15),

      // ===== inverted surfaces (tooltips, popovers) =====
      "--color-inverted-neutral-background": s.fg,
      "--color-inverted-neutral-background-hover": s.fgStrong,
      "--color-inverted-neutral-content": theme.bg,
      "--color-inverted-neutral-content-strong": theme.bg,
      "--color-inverted-neutral-border": withAlpha(theme.bg, 0.2),
      "--color-inverted-secondary-plain": theme.bg,
      "--color-inverted-secondary-plain-hover": theme.bg,
      "--color-inverted-secondary-onBackground": theme.bg,
      "--color-inverted-secondary-background": s.fg,
      "--color-inverted-secondary-background-hover": s.fgStrong,
      "--color-inverted-secondary-background-selected": s.sidebarMuted,
      "--color-tooltip-bg-neutral": s.fg,
      "--color-tooltip-text-neutral": theme.bg,
      "--color-tooltip-bg-inverted": theme.bg,
      "--color-tooltip-text-inverted": s.fg,
      "--color-tooltip-bg-primary": s.accent,
      "--color-tooltip-text-primary": onAccent,

      // ===== legacy tone ladder (1 = strongest ink ... 7 = deepest surface) =====
      "--color-tone-1": s.fgStrong,
      "--color-tone-2": s.fg,
      "--color-tone-3": s.sidebarMuted,
      "--color-tone-4": raised4,
      "--color-tone-5": raised2,
      "--color-tone-6": raised1,
      "--color-tone-7": recessed,

      // ===== votes =====
      "--color-upvote-background": up,
      "--color-upvote-background-hover": shade(up, dir * 0.08),
      "--color-upvote-background-disabled": withAlpha(up, 0.3),
      "--color-upvote-content": upContent,
      "--color-upvote-content-weak": up,
      "--color-upvote-plain": upContent,
      "--color-upvote-plain-weaker": up,
      "--color-upvote-plain-disabled": withAlpha(upContent, 0.3),
      "--color-upvote-disabled": withAlpha(upContent, 0.3),
      "--color-upvote-onBackground": onUp,
      "--color-action-upvote": up,
      "--color-downvote-background": down,
      "--color-downvote-background-hover": shade(down, dir * 0.08),
      "--color-downvote-background-disabled": withAlpha(down, 0.3),
      "--color-downvote-content": downContent,
      "--color-downvote-content-weak": down,
      "--color-downvote-plain": downContent,
      "--color-downvote-plain-weaker": down,
      "--color-downvote-plain-disabled": withAlpha(downContent, 0.3),
      "--color-downvote-disabled": withAlpha(downContent, 0.3),
      "--color-downvote-onBackground": onDown,
      "--color-action-downvote": down,

      // ===== status =====
      "--color-danger-background": danger,
      "--color-danger-background-hover": shade(danger, dir * 0.08),
      "--color-danger-background-weaker": mix(theme.bg, danger, 0.18),
      "--color-danger-background-highlighted": mix(theme.bg, danger, 0.12),
      "--color-danger-background-disabled": mix(theme.bg, danger, 0.1),
      "--color-danger-content": danger,
      "--color-danger-content-hover": shade(danger, dir * 0.1),
      "--color-danger-onBackground": onDanger,
      "--color-danger-plain": danger,
      "--color-danger-plain-hover": shade(danger, dir * 0.1),
      "--color-alert-negative": danger,
      "--color-success-background": success,
      "--color-success-background-hover": shade(success, dir * 0.08),
      "--color-success-background-highlighted": mix(theme.bg, success, 0.12),
      "--color-success-content": success,
      "--color-success-hover": shade(success, dir * 0.1),
      "--color-success-onBackground": onSuccess,
      "--color-success-plain": success,
      "--color-success-plain-hover": shade(success, dir * 0.1),
      "--color-alert-positive": success,
      "--color-caution-background": caution,
      "--color-caution-background-hover": shade(caution, dir * 0.08),
      "--color-caution-background-highlighted": mix(theme.bg, caution, 0.12),
      "--color-caution-onBackground": onCaution,
      "--color-caution-plain": caution,
      "--color-caution-plain-hover": shade(caution, dir * 0.1),
      "--color-alert-caution": caution,
      "--color-warning-background": caution,
      "--color-warning-background-hover": shade(caution, dir * 0.08),
      "--color-warning-content": caution,
      "--color-warning-content-hover": shade(caution, dir * 0.1),
      "--color-warning-onBackground": onCaution,
      "--color-banner-plain": card,
      "--color-banner-plain-text": s.fg,
      "--color-banner-plain-inverted": s.fg,
      "--color-banner-plain-inverted-text": theme.bg,

      // ===== moderator highlighting =====
      // Reported/filtered row washes. Semantic (they encode queue state), so
      // they keep their meaning but are re-composited against OUR background —
      // Reddit ships them pre-composited against its own, which leaves a
      // mismatched block on any other surface.
      "--shreddit-color-mods-reported-background": mix(theme.bg, caution, 0.14),
      "--shreddit-color-mods-reported-background-hover": mix(theme.bg, caution, 0.2),
      "--shreddit-color-mods-reported-onBackground": caution,
      "--shreddit-color-mods-filtered-background": mix(theme.bg, danger, 0.14),
      "--shreddit-color-mods-filtered-background-hover": mix(theme.bg, danger, 0.2),
      "--shreddit-color-mods-filtered-onBackground": danger,

      // ===== DELIBERATELY UNMAPPED =====
      // --color-global-*     Reddit's literal constants (orangered, white, black,
      //                      alienblue, online/offline, admin, moderator, nsfw,
      //                      gold). These are the same shape as Outlook's
      //                      --white and Slack's constants-white: repointing
      //                      them inverts icon fills and text-on-brand.
      // --color-tags-*       User and mod flair (40 tokens). Authoring choices,
      //                      the same line notion.js draws around block colours.
      // --color-identity-*   admin / moderator / coins / self badges — identity,
      // --color-category-*   live / nsfw / spoiler — content warnings. Both
      //                      encode who or what something is, not chrome.
      // --color-media-*      Overlay controls that ride ON media. They are white
      //                      on a dark scrim by construction and must stay so
      //                      whatever the photo underneath looks like.
      // --color-scrim*       Modal backdrops. Stay dark by design, the same call
      //                      notion.js makes for --ca-modUndBac.
      // --color-elevation-*  Shadow ramps, not surfaces.
      // --shreddit-color-wordmark  The Reddit logo. Branding.
    };
  },
});
