// Omarchy web-app theming — generic engine runtime (app-agnostic).
//
// Owns the theme channel to the native host (via background.js) and drives
// whichever app pack registered itself with OmarchyTheme.register(). An app
// pack provides:
//   apply(theme, surfaces)      — paint the app (required)
//   onColorMode(isDark, theme)  — flip the app's own light/dark mode (optional)
// This file knows nothing about Slack (or any specific app); all app-specific
// DOM work lives behind register().

const OmarchyTheme = {
  _pack: null,
  _lastKey: null, // JSON of the last applied theme; de-dups repeat pushes
  _lastIsDark: null, // last light/dark state; onColorMode fires only on a crossing
  current: null, // { theme, surfaces } — app packs read this for re-paints

  register(pack) {
    this._pack = pack;
  },

  // Re-run the current theme, bypassing the de-dup guard. App packs call this
  // when something has clobbered their paint and they need a fresh apply.
  reapply() {
    if (!this.current) return;
    this._lastKey = null;
    this.apply(this.current.theme);
  },

  apply(theme) {
    if (!theme || !theme.bg) return;
    const surfaces = deriveSurfaces(theme);
    if (!surfaces) return;

    // Skip if nothing changed since last apply.
    const key = JSON.stringify(theme);
    if (key === this._lastKey) return;
    this._lastKey = key;
    this.current = { theme, surfaces };

    const isDark = surfaces.isDark;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    // Harmless if an app ever adds an OS-sync option.
    document.dispatchEvent(
      new CustomEvent("omarchy:set-color-scheme", { detail: { dark: isDark } })
    );

    // Drive the app's own Color Mode only when the mode crosses light↔dark.
    if (this._lastIsDark !== isDark) {
      this._lastIsDark = isDark;
      // Re-read the last pushed theme before touching the app — guards against
      // acting on a stale in-page value when the user switches omarchy themes
      // just before/during a reload. The native host pushes on omarchy's
      // theme-set hook, so what the service worker holds is already current.
      chrome.runtime.sendMessage({ type: "request-fresh-theme" }, (freshTheme) => {
        if (freshTheme && freshTheme.bg) {
          const freshRgb = hexToRgb(freshTheme.bg);
          if (freshRgb) {
            const freshIsDark = relLuminance(freshRgb) < 0.5;
            if (freshIsDark !== isDark) {
              console.log(
                "[omarchy] stale theme; fresh says",
                freshIsDark ? "dark" : "light",
                "(was",
                isDark ? "dark" : "light",
                ") — re-applying"
              );
              // Re-run with the fresh data; that re-triggers onColorMode.
              this._lastKey = null;
              this._lastIsDark = null;
              this.apply(freshTheme);
              return;
            }
          }
        }
        if (this._pack && this._pack.onColorMode) {
          this._pack.onColorMode(isDark, theme);
        }
      });
    }

    if (this._pack && this._pack.apply) {
      this._pack.apply(theme, surfaces);
    }
  },
};

// Themes arrive two ways: pushed live by background.js on an omarchy theme-set,
// and fetched once on load. Both funnel through OmarchyTheme.apply(). The async
// callback fires after the whole content-script list has run, so the app pack
// has always registered by the time either path dispatches.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "omarchy-theme") OmarchyTheme.apply(msg.theme);
});
chrome.runtime.sendMessage({ type: "request-theme" }, (theme) => {
  if (theme) OmarchyTheme.apply(theme);
});
