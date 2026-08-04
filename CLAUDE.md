# CLAUDE.md

Guidance for working in this repo. Keep it short; update it when the architecture changes.

## What this is

A small **Manifest V3 browser extension** (Brave/Chrome/Chromium) that makes
web apps follow the current [Omarchy](https://omarchy.org/) theme. One
app-agnostic **engine** + one **pack per site**: Slack (`content.js`, the full
pack — repaints chrome/sidebar/message pane and auto-flips Slack's Light/Dark
Color Mode), WhatsApp Web (`whatsapp.js`, declarative), GitHub (`github.js`,
declarative Primer tokens), and Linear (`linear.js`, declarative). A **bash
native-messaging host** reads the active Omarchy theme from
`~/.local/state/omarchy/current/` and pushes theme changes to the extension
the moment they land. **Requires Omarchy 4+.**

This is end-user desktop tooling, not a web service. There is no build step, no
package manager, and no test suite — it's plain JS plus a dependency-free bash
script.

## Layout

- `extension/` — the unpacked extension
  - `omarchy-colors.js` / `omarchy-surfaces.js` / `omarchy-runtime.js` — the
    app-agnostic engine (loaded before `content.js`, shares its scope): color
    helpers (`relLuminance` linearizes channels per WCAG), `deriveSurfaces()`
    (the theme→surfaces contract), and the `OmarchyTheme` registry that receives
    themes and dispatches to the registered pack.
  - `content.js` — **the Slack pack**, and the bulk of the work. Builds the
    themed CSS from the derived surfaces and injects it; drives Slack's
    Preferences modal to flip Color Mode; registers via `OmarchyTheme.register()`.
    See "content.js structure" below.
  - `whatsapp.js` — **the WhatsApp pack** (declarative tier): just a `cssVars`
    table mapping WhatsApp's own CSS custom properties to the derived surfaces.
    Every name verified against the live WhatsApp DOM (2026-08-04); the chat
    list/header paint via the `--WDS-surface-*` semantic tokens, found by
    resolving every custom property at the element and matching the painted
    color. Requires WhatsApp's theme set to "System default".
  - `github.js` — **the GitHub pack** (declarative tier): maps Primer semantic
    tokens (`--bgColor-*`, `--fgColor-*`, `--borderColor-*`, `--header-*`,
    `--control-*`, `--overlay-*`) to derived surfaces. Verified via Playwright
    against public github.com (2026-08-04). `onColorMode` pins
    `data-color-mode`; Appearance → "Sync with system" is the supported setup.
    Matches `github.com` and `gist.github.com`.
  - `linear.js` — **the Linear pack**: semantic tokens (`--bg-*`, `--color-*`,
    `--focus-*`) plus a dynamic remap of Linear's hashed StyleX `--sx-*` slots,
    each classified by USAGE (which CSS property consumes it — background →
    surface, color/fill → text; grey-level guessing is under-determined and
    broke light mode) and re-stomped via a fast rAF paint path on re-renders.
    **Requires Linear's interface theme set to "System preference"** (Ctrl+K →
    "Change interface theme"; per-device, client-DB-backed — with a pinned
    Light/Dark theme Linear renders hardcoded lch() styles no override can
    reach). Matches `linear.app` and `*.linear.app`.
  - `background.js` — MV3 service worker. Holds the native-messaging port,
    rebroadcasts pushed themes to matched tabs (the site list is derived from
    the manifest's content-script matches — adding a pack never touches this
    file), answers `request-fresh-theme`.
  - `inject-prefers-color-scheme.js` — runs in the page's MAIN world at
    `document_start`; a near-complete `matchMedia('(prefers-color-scheme)')`
    polyfill so Slack's "Sync with OS" appearance follows omarchy, plus the
    Slack-only `omarchy:react-click` bridge that drives the Preferences radio.
  - `manifest.json` — permissions + content-script registration. Carries a
    **`key`** that pins the extension ID to `egagnaecglnnmbbnpbbccgajinplhckp`
    on every machine, so the host manifest's `allowed_origins` can be hardcoded.
    Never regenerate it — the ID is baked into the host manifest template and
    into users' installed copies.
- `native-host/` — `omarchy-webapp-theme-host` (bash; emits length-prefixed JSON
  over stdio) + the native-messaging manifest template.
- `hooks/omarchy-webapp-theme` — omarchy `theme-set` hook. Signals SIGUSR1 to
  every running host via pidfiles in `$XDG_RUNTIME_DIR/omarchy-webapp-theme/`.
- `install.sh` — takes no extension ID. Refuses on pre-Omarchy-4 (no
  `~/.local/state/omarchy/current`). Otherwise writes host manifests to all nine
  Chromium-family profile dirs, symlinks the hook into `hooks/theme-set.d/`, and
  adds `--load-extension` to the flags confs of installed browsers. `--no-flags`,
  `--uninstall`.

## Adding a site pack

The whole point of the engine/pack split. One extension, one pinned ID, one
host manifest — a new site needs **no new keys and no native-messaging changes**:

1. Create `extension/<site>.js` ending in `OmarchyTheme.register({ id: "<site>",
   ... })`. Start declarative: `cssVars(theme, s)` returning a map of the SITE'S
   OWN css custom properties → derived surfaces (see `whatsapp.js`). Only
   escalate to `apply()` + observers + `onColorMode()` if the site fights back
   (see `content.js` — Slack is the worst case).
2. In `manifest.json`: add the site's URL pattern to `host_permissions`, to the
   two shared entries (shim + engine), and add a new content-script entry
   loading just `<site>.js` for that pattern. Keep pack files flat in
   `extension/` — the AUR PKGBUILD installs with a flat `extension/*` glob.
3. Add the site's row to `SITES` in `extension/options.js` (the per-site
   enable/disable toggle; the `id` must match the register call — the engine
   gates on `chrome.storage.sync` `disabledSites[id]` and pends the theme until
   both the pack and the settings have arrived).
4. `background.js` and `install.sh` need nothing; the site list is derived from
   the manifest.
5. Verify against the live site (see Dev / test workflow). Read variable/class
   names off the live DOM — never guess.

The host's payload carries the stable named fields (`bg`, `fg`, `accent`,
`selection_bg`, `chrome`) plus `colors`: the theme's entire `colors.toml`
palette, for packs that want to map more than five values.

## Host design (why it looks like this)

The host is **push-only** — it never parses inbound messages, and `background.js`
never writes to the port. Reading Chromium's length-prefixed framing in bash
means blocking in `head -c4`, which a trap can't interrupt; going push-only
removes the need entirely. Consequences to preserve when editing:

- **Omarchy 4+ only.** The host reads `~/.local/state/omarchy/current/` and is
  driven entirely by SIGUSR1 from the theme-set hook — there is no polling
  fallback. `install.sh` symlinks the hook into `hooks/theme-set.d/` (the `.d`
  form has existed since Omarchy 3.8). Older Omarchy stays on the pre-0.3 release.
- The main loop `wait`s on the stdin watchdog; a SIGUSR1 interrupts the `wait`,
  the trap pushes the new theme, and the loop resumes. No `sleep` timers.
- The stdin watchdog **must** read via an explicit `<&3` dup. Bash gives every
  background job `/dev/null` as stdin, so a bare read loop EOFs instantly and
  kills the host right after its first push.

## content.js structure

1. **Engine** (`omarchy-colors.js` / `omarchy-surfaces.js` / `omarchy-runtime.js`,
   loaded before `content.js`) — color helpers (`hexToRgb`, `relLuminance`
   [linearized WCAG channels], `shade`, `withAlpha`, `mix`), `deriveSurfaces()`,
   and the `OmarchyTheme` registry. Dark vs. light is decided by **WCAG relative
   luminance** of the terminal bg (`< 0.5` = dark), *not* the day/night name.
   `content.js` is the Slack **pack**: it ends with `OmarchyTheme.register(...)`.
2. **`applySlackTheme(theme, s)`** (the pack's `apply` hook) — takes the surfaces
   `s` the engine derived (`sidebarBg`, `chromeBg`, `hoverBg`, `selectedBg`, …).
   **Destructure every field the CSS/`directPaint` uses — a missing one is a
   silent runtime ReferenceError** (this bit us with `chromeBg`). Then it builds
   one big CSS template string and injects it into a `<style id="omarchy-slack-style">`.
3. **Inline-important overrides** — Slack sets its own high-specificity inline
   styles (CSS custom props like `--rainbow-*`, `--saf-*`, and direct
   `background-color` on the rail/sidebar/nav on blur). External `!important` CSS
   loses to inline styles, so we re-write the same vars + direct paints
   **inline with `setProperty(..., "important")`** to win the cascade.
4. **`paintActiveRows()`** — paints the selected-channel pill inline because
   Slack's React re-render stomps our CSS; a MutationObserver re-runs it.
5. **MutationObservers** — re-inject the style if Slack removes it, keep active-row
   paint current, etc.
6. **Color-mode automation** — `ensureSlackColorMode(isDark)` opens
   Preferences → Appearance and toggles the radio via a MAIN-world React bridge
   (synthetic clicks don't fire Slack's handler reliably).

## How the CSS rules are written (important conventions)

- Selectors use **attribute-substring matches** like `[class*="p-activity_ia4_page"]`
  because Slack ships **hashed/minified class names** that change between builds.
  Never hard-code a full class name; match a stable substring prefix.
- Almost every rule needs `html body …` prefixes and `!important` to beat Slack's
  specificity. Follow the existing pattern.
- Rules are grouped into annotated `/* ===== section ===== */` blocks (main pane,
  tab rail, channel sidebar, top nav, message hover, DMs/Activity list, badges,
  text readability). Add new work to the matching block or a new annotated block.
- Theme-derived values come from CSS vars (`--omarchy-bg`, `--omarchy-fg`,
  `--omarchy-accent`, `--omarchy-sidebar-bg`, `--omarchy-hover-bg`,
  `--omarchy-selected-bg`, `--omarchy-fg-strong`). Use these rather than literals.
- The whole CSS block is a **JS template literal** (backtick-delimited string).
  Never put a backtick `` ` `` or `${` inside it — *including inside `/* */`
  comments*. They're live template-literal syntax even in a comment, so a stray
  backtick silently terminates the string and the entire content script fails to
  parse (symptom: `Uncaught SyntaxError` and **all** theming disappears).
- Some surfaces (e.g. the rail/sidebar, and the Activity/Threads `All|VIP` tab
  strip — `p-activity_ia4_page__tab_menu` / `__tab_container`) are painted by
  Slack **inline with `!important`**, which beats even our high-specificity
  `!important` CSS. Those can't be fixed in the stylesheet — paint them inline
  via `setProperty(..., "important")` and re-run on the MutationObserver. See
  `paintTabStrips()` / `paintActiveRows()`.

## Dev / test workflow

There's no automated harness — changes are verified by hand against live Slack:

1. Edit files under `extension/`.
2. Reload the unpacked extension at `brave://extensions` (or Chrome equivalent).
3. Reload the Slack tab. Filter the DevTools console by `omarchy` to see logs.
4. To find selectors for a Slack UI element, **inspect the live DOM in DevTools**
   (Slack's class names are hashed, so you must read them off the running app —
   don't guess). The repo can't be inspected locally because the markup is Slack's.

Note: Brave normally runs **without** a remote-debugging port, so an automated
browser (Playwright) can't attach to the logged-in session. Inspect via DevTools
in the user's own browser, or have the user paste DOM/console output.

The **native host and install.sh**, unlike the CSS, *are* testable headlessly —
do that rather than asking the user to click through a browser. Both honor
`$HOME` and `$XDG_RUNTIME_DIR`, so point them at a scratch dir:

```sh
# host: hold stdin open, or the watchdog exits immediately
( sleep 5 ) | HOME=/tmp/fake XDG_RUNTIME_DIR=/tmp/run ./native-host/omarchy-webapp-theme-host > out.bin
head -c4 out.bin | od -An -v -tu4 --endian=little   # must equal the JSON byte length

# install.sh: sandbox the whole thing
HOME=/tmp/fake ./install.sh && HOME=/tmp/fake ./install.sh --uninstall
```

Point `~/.local/state/omarchy/current/theme` at any dir under
`/usr/share/omarchy/themes/` to exercise a specific palette.

## Conventions

- Vanilla JS only (no framework, no bundler). Keep the heavy inline comments —
  they explain *why* a given hack beats Slack's cascade; preserve that context.
- Don't open PRs or push without confirming with the user.
