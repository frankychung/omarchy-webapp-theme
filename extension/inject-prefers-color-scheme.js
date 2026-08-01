// Runs in the page's MAIN world at document_start.
// Spoofs window.matchMedia('(prefers-color-scheme: ...)') so Slack's
// "Sync with OS" appearance follows the omarchy theme instead of the OS.

(function () {
  if (window.__omarchyPCSInstalled) return;
  window.__omarchyPCSInstalled = true;

  const orig = window.matchMedia.bind(window);
  let isDark = orig("(prefers-color-scheme: dark)").matches;
  const listeners = new Set();
  const owners = new Set();

  function makeProxy(query) {
    const wantsDark = /dark/i.test(query);
    const wantsLight = /light/i.test(query);
    const target = orig(query);
    // Registrations live in one shared Set, so they have to record which
    // MediaQueryList they came from. Without that, an app that hands the same
    // callback to both the dark and the light query and later detaches one
    // would silently detach the other too, and the query it still holds would
    // stop hearing theme changes. `addListener` is a legacy alias of
    // `addEventListener("change")`, so the two share a registration space and
    // either remover cancels either add.
    const owner = {};
    let onchange = null;
    let proxy = null;

    function captureFrom(options) {
      return typeof options === "boolean" ? options : !!options?.capture;
    }

    function has(cb, capture) {
      for (const e of listeners)
        if (e.owner === owner && e.cb === cb && e.capture === capture) return true;
      return false;
    }

    function add(cb, options = false) {
      // Native listeners dedupe on identity; adding twice must not fire twice.
      const capture = captureFrom(options);
      if (
        (typeof cb !== "function" && typeof cb?.handleEvent !== "function") ||
        options?.signal?.aborted ||
        has(cb, capture)
      )
        return;
      const entry = {
        owner,
        cb,
        capture,
        once: !!options?.once,
        signal: options?.signal,
        wantsDark,
        wantsLight,
      };
      listeners.add(entry);
      if (entry.signal) {
        entry.abort = () => listeners.delete(entry);
        entry.signal.addEventListener("abort", entry.abort, { once: true });
      }
    }

    function remove(cb, options = false) {
      const capture = captureFrom(options);
      for (const e of listeners) {
        if (e.owner !== owner || e.cb !== cb || e.capture !== capture) continue;
        listeners.delete(e);
        if (e.signal) e.signal.removeEventListener("abort", e.abort);
      }
    }

    proxy = new Proxy(target, {
      get(_t, prop) {
        if (prop === "matches") {
          if (wantsDark) return isDark;
          if (wantsLight) return !isDark;
          return target.matches;
        }
        if (prop === "media") return query;
        if (prop === "onchange") return onchange;
        if (prop === "addEventListener") {
          return (evt, cb, options) => {
            if (evt === "change") add(cb, options);
          };
        }
        if (prop === "removeEventListener") {
          return (evt, cb, options) => {
            if (evt === "change") remove(cb, options);
          };
        }
        if (prop === "addListener") {
          // deprecated API — single callback arg
          return (cb) => add(cb);
        }
        if (prop === "removeListener") {
          return (cb) => remove(cb);
        }
        const v = target[prop];
        return typeof v === "function" ? v.bind(target) : v;
      },
      set(_t, prop, value) {
        if (prop === "onchange") {
          onchange = typeof value === "function" ? value : null;
          if (onchange) owners.add(owner);
          else owners.delete(owner);
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    });
    owner.proxy = proxy;
    owner.onchange = () => onchange;
    owner.wantsDark = wantsDark;
    owner.wantsLight = wantsLight;
    return proxy;
  }

  window.matchMedia = function (query) {
    if (typeof query === "string" && /prefers-color-scheme/i.test(query)) {
      return makeProxy(query);
    }
    return orig(query);
  };

  // Bridge: content script asks us (main world) to invoke React's onClick
  // directly. Tries multiple strategies because Slack attaches handlers
  // inconsistently (sometimes on a wrapper div, sometimes on a hidden input,
  // sometimes on a parent radiogroup).
  function findReactProps(el) {
    for (const k of Object.keys(el)) {
      if (k.startsWith("__reactProps$")) return el[k];
    }
    return null;
  }

  function fakeEvt(target, currentTarget) {
    return {
      target,
      currentTarget: currentTarget || target,
      preventDefault() {},
      stopPropagation() {},
      nativeEvent: new MouseEvent("click", { bubbles: true }),
      bubbles: true,
      cancelable: true,
      type: "click",
    };
  }

  function tryReactHandler(el, eventType) {
    const props = findReactProps(el);
    if (!props) return false;
    const handlerName = eventType === "click" ? "onClick" : "onChange";
    if (typeof props[handlerName] !== "function") return false;
    try {
      props[handlerName](fakeEvt(el, el));
      console.log(`[omarchy bridge] called ${handlerName} on`, el.tagName, el.className.toString().slice(0, 80));
      return true;
    } catch (e) {
      console.warn("[omarchy bridge] handler threw:", e);
      return false;
    }
  }

  document.addEventListener("omarchy:react-click", (ev) => {
    const marker = ev.detail && ev.detail.marker;
    if (!marker) return;
    const el = document.querySelector(`[data-omarchy-target="${marker}"]`);
    if (!el) {
      console.warn("[omarchy bridge] target element not found");
      return;
    }

    // 0. If the target is (or wraps) a native radio/checkbox, drive it with a
    //    real click. That sets .checked AND fires the event Slack's delegated
    //    React listener responds to (target.checked correct). This beats
    //    calling onChange with a fabricated event, which leaves .checked false
    //    — Slack's current handler reads target.checked and ignores it.
    const nativeInput = el.matches('input[type="radio"], input[type="checkbox"]')
      ? el
      : el.querySelector('input[type="radio"], input[type="checkbox"]');
    if (nativeInput) {
      console.log("[omarchy bridge] native click on radio/checkbox input");
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "checked"
      ).set;
      try { setter.call(nativeInput, true); } catch (_) {}
      nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
      try { nativeInput.click(); } catch (_) {}
      return;
    }

    // 1. Try element itself + walk up to the radiogroup / dialog boundary
    let cur = el;
    for (let i = 0; i < 6 && cur; i++) {
      if (tryReactHandler(cur, "click")) return;
      if (tryReactHandler(cur, "change")) return;
      if (cur.getAttribute && (cur.getAttribute("role") === "dialog")) break;
      cur = cur.parentElement;
    }

    // 2. Walk down to find a descendant with a handler (e.g. hidden <input>)
    const descendants = el.querySelectorAll("*");
    for (const d of descendants) {
      if (tryReactHandler(d, "click")) return;
      if (tryReactHandler(d, "change")) return;
    }

    // 3. If there's a real radio/checkbox input inside, set it directly
    const input = el.querySelector('input[type="radio"], input[type="checkbox"]');
    if (input) {
      console.log("[omarchy bridge] using native radio input");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
      setter.call(input, true);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return;
    }

    console.warn("[omarchy bridge] no React handler found on element or its tree");
    // Diagnostic dump of all expando keys so we know what React names to look for
    console.warn("[omarchy bridge] expando keys on target:", Object.keys(el).filter(k => k.startsWith("__")));
  });

  document.addEventListener("omarchy:set-color-scheme", (ev) => {
    const next = !!(ev.detail && ev.detail.dark);
    if (next === isDark) return;
    isDark = next;
    for (const entry of listeners) {
      const { owner, cb, wantsDark, wantsLight } = entry;
      const matches = wantsDark ? isDark : wantsLight ? !isDark : false;
      const media = wantsDark
        ? "(prefers-color-scheme: dark)"
        : wantsLight
        ? "(prefers-color-scheme: light)"
        : "";
      try {
        if (entry.once) listeners.delete(entry);
        if (entry.signal) entry.signal.removeEventListener("abort", entry.abort);
        // Shaped like a MediaQueryListEvent; apps read .matches. The legacy
        // addListener callback takes the same argument, so there is nothing to
        // branch on here.
        const event = { matches, media, target: owner.proxy, currentTarget: owner.proxy };
        if (typeof cb === "function") cb.call(owner.proxy, event);
        else cb.handleEvent(event);
      } catch (_) {}
    }
    for (const owner of owners) {
      const cb = owner.onchange();
      if (!cb) continue;
      const matches = owner.wantsDark ? isDark : owner.wantsLight ? !isDark : false;
      const media = owner.wantsDark
        ? "(prefers-color-scheme: dark)"
        : owner.wantsLight
        ? "(prefers-color-scheme: light)"
        : "";
      try {
        cb.call(owner.proxy, {
          matches,
          media,
          target: owner.proxy,
          currentTarget: owner.proxy,
        });
      } catch (_) {}
    }
  });
})();
