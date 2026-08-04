const HOST = "com.omarchy.slack_theme";

// Every site a pack supports, straight from the manifest's content-script
// matches — adding a pack never touches this file.
const MATCH_PATTERNS = [
  ...new Set(chrome.runtime.getManifest().content_scripts.flatMap((cs) => cs.matches)),
];
// Bare hostnames for the cheap onUpdated filter ("*://*.slack.com/*" → slack.com).
const MATCH_HOSTS = [
  ...new Set(
    MATCH_PATTERNS.map((p) =>
      p.replace(/^\*:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "")
    )
  ),
];

function isThemedUrl(url) {
  try {
    const host = new URL(url).hostname;
    return MATCH_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch (_) {
    return false;
  }
}

let port = null;
let reconnectTimer = null;

function connect() {
  // The service worker can reach this from three directions at once: the
  // module-level call below, onInstalled, and onStartup. Without this guard each
  // one opens its own port, and every port spawns a separate long-lived native
  // host — so the theme-set hook then signals N hosts and every theme change
  // gets broadcast to the same tabs N times.
  if (port) return;
  try {
    port = chrome.runtime.connectNative(HOST);
    console.log("[omarchy] native port connected");
  } catch (e) {
    console.warn("[omarchy] connectNative threw:", e);
    scheduleReconnect();
    return;
  }

  port.onMessage.addListener((theme) => {
    if (!theme || theme.error) {
      console.warn("[omarchy] native host error:", theme && theme.error);
      return;
    }
    console.log("[omarchy] theme pushed by native host:", theme.theme_name, theme.bg);
    chrome.storage.local.set({ theme });
    broadcast(theme);
  });

  port.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError;
    console.warn("[omarchy] native host disconnected:", err && err.message);
    port = null;
    scheduleReconnect();
  });

  // No request needed: the host is push-only. It emits the current theme as soon
  // as it starts, then again on every theme change (driven by omarchy's
  // theme-set hook). We never write to the port.
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function broadcast(theme) {
  chrome.tabs.query({ url: MATCH_PATTERNS }, (tabs) => {
    console.log("[omarchy] broadcasting theme to", tabs.length, "themed tab(s)");
    for (const t of tabs) {
      chrome.tabs.sendMessage(t.id, { type: "omarchy-theme", theme }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "request-theme") {
    chrome.storage.local.get("theme").then(({ theme }) => sendResponse(theme || null));
    return true;
  }
  // Kept for content.js, which asks for a guaranteed-current theme right before
  // driving Slack's Color Mode radio. Storage is already current: omarchy fires
  // its theme-set hook after the new theme's files are final, the host pushes
  // immediately, and we write storage on that push — all before the content
  // script gets the broadcast that makes it ask. So there's nothing to go fetch.
  if (msg && msg.type === "request-fresh-theme") {
    chrome.storage.local.get("theme").then(({ theme }) => sendResponse(theme || null));
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!tab.url || !isThemedUrl(tab.url)) return;
  chrome.storage.local.get("theme").then(({ theme }) => {
    if (theme) chrome.tabs.sendMessage(tabId, { type: "omarchy-theme", theme }).catch(() => {});
  });
});

chrome.runtime.onInstalled.addListener(connect);
chrome.runtime.onStartup.addListener(connect);

connect();
