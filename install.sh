#!/bin/bash
# Install the Omarchy Slack Theme extension: native-messaging host manifests,
# the omarchy theme-set hook, and the browser --load-extension wiring.
#
# Usage:
#   ./install.sh [--no-flags] [--uninstall]
#
#   --no-flags   Skip editing ~/.config/<browser>-flags.conf. Use this if you'd
#                rather load extension/ by hand via Developer mode.
#   --uninstall  Reverse everything this script installs.
#
# No extension ID argument: extension/manifest.json pins the ID with a "key",
# so it's the same on every machine and is baked into the host manifest.

set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
HOST_SCRIPT="$REPO/native-host/omarchy-slack-theme-host"
HOST_TEMPLATE="$REPO/native-host/com.omarchy.slack_theme.json.template"
HOOK_SCRIPT="$REPO/hooks/omarchy-slack-theme"
EXT_DIR="$REPO/extension"

HOST_NAME="com.omarchy.slack_theme"
MARKER="omarchy-slack-theme"
BEGIN_MARK="# >>> $MARKER >>>"
END_MARK="# <<< $MARKER <<<"

HOOKS_DIR="$HOME/.config/omarchy/hooks"

DO_FLAGS=1
DO_UNINSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
  --no-flags) DO_FLAGS=0 ;;
  --uninstall) DO_UNINSTALL=1 ;;
  -h | --help)
    sed -n '2,14p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown argument: $1" >&2
    exit 2
    ;;
  esac
  shift
done

# Every Chromium-family profile root that supports native messaging. Mirrors
# omarchy's own bin/omarchy-install-chromium-copy-url — we write to all of them
# unconditionally so the host is registered whichever browser you end up using.
BROWSER_PROFILE_DIRS=(
  "$HOME/.config/chromium"
  "$HOME/.config/google-chrome"
  "$HOME/.config/google-chrome-beta"
  "$HOME/.config/google-chrome-unstable"
  "$HOME/.config/BraveSoftware/Brave-Browser"
  "$HOME/.config/BraveSoftware/Brave-Browser-Beta"
  "$HOME/.config/BraveSoftware/Brave-Browser-Nightly"
  "$HOME/.config/microsoft-edge"
  "$HOME/.config/microsoft-edge-dev"
)

# Arch's browser launchers read ~/.config/<name>-flags.conf. The conf name doesn't
# map 1:1 onto profile dirs, so this is a separate list — the same one omarchy's
# yt-dlp migration uses, paired with the binaries that prove the browser exists.
#
# Detect by BINARY, not profile dir: omarchy's own chromium-extension installers
# mkdir all nine profile dirs on every machine, so "the dir exists" would be true
# for browsers you've never installed and we'd litter confs for all of them.
FLAGS_TARGETS=(
  "chromium:chromium"
  "chrome:google-chrome-stable google-chrome"
  "google-chrome:google-chrome-stable google-chrome"
  "brave:brave brave-browser"
  "brave-beta:brave-beta brave-browser-beta"
  "brave-nightly:brave-nightly brave-browser-nightly"
  "brave-origin-beta:brave-origin-beta"
  "microsoft-edge-stable:microsoft-edge-stable microsoft-edge"
)

browser_installed() {
  local bin
  for bin in $1; do
    command -v "$bin" >/dev/null 2>&1 && return 0
  done
  return 1
}

# ------------------------------------------------------------ host manifests --

install_host_manifests() {
  local manifest dir count=0
  manifest=$(sed "s|__HOST_PATH__|$HOST_SCRIPT|g" "$HOST_TEMPLATE")
  for dir in "${BROWSER_PROFILE_DIRS[@]}"; do
    mkdir -p "$dir/NativeMessagingHosts"
    printf '%s\n' "$manifest" >"$dir/NativeMessagingHosts/$HOST_NAME.json"
    count=$((count + 1))
  done
  echo "  native-messaging host registered in $count profile dir(s)"
}

remove_host_manifests() {
  local dir count=0
  for dir in "${BROWSER_PROFILE_DIRS[@]}"; do
    if [[ -f "$dir/NativeMessagingHosts/$HOST_NAME.json" ]]; then
      rm -f "$dir/NativeMessagingHosts/$HOST_NAME.json"
      count=$((count + 1))
    fi
  done
  echo "  removed $count host manifest(s)"
}

# --------------------------------------------------------------------- hook --

# Where is omarchy-hook, and does it support hooks/<name>.d/ directories?
# The .d form landed in Omarchy v3.8.0; v3.1.0-v3.7.x only run the single
# hooks/<name> file, and anything older has no hooks at all.
find_omarchy_hook() {
  local c
  for c in "$(command -v omarchy-hook 2>/dev/null || true)" \
    "${OMARCHY_PATH:-}/bin/omarchy-hook" \
    "/usr/share/omarchy/bin/omarchy-hook"; do
    [[ -n $c && -f $c ]] && {
      printf '%s' "$c"
      return 0
    }
  done
  return 1
}

install_hook() {
  local hook_bin
  if ! hook_bin=$(find_omarchy_hook); then
    echo "  omarchy-hook not found — skipping hook install."
    echo "  The host will fall back to a 1s poll, so theming still works."
    return 0
  fi

  if grep -q 'HOOK_DIR' "$hook_bin"; then
    mkdir -p "$HOOKS_DIR/theme-set.d"
    ln -sfn "$HOOK_SCRIPT" "$HOOKS_DIR/theme-set.d/$MARKER"
    echo "  hook symlinked into hooks/theme-set.d/ (Omarchy 3.8+/4)"
    return 0
  fi

  # Legacy single-file hook. This file may already be the user's own, so append a
  # marked block rather than overwriting — uninstall strips exactly that block.
  local target="$HOOKS_DIR/theme-set"
  mkdir -p "$HOOKS_DIR"
  if [[ -f $target ]] && grep -qF "$MARKER" "$target"; then
    echo "  hook already present in hooks/theme-set"
    return 0
  fi
  if [[ ! -f $target ]]; then
    printf '#!/bin/bash\n' >"$target"
  fi
  {
    printf '\n%s\n' "$BEGIN_MARK"
    printf '"%s" "$@" || true\n' "$HOOK_SCRIPT"
    printf '%s\n' "$END_MARK"
  } >>"$target"
  chmod +x "$target"
  echo "  hook appended to hooks/theme-set (Omarchy 3.1-3.7, no .d support)"
}

remove_hook() {
  local target="$HOOKS_DIR/theme-set"
  if [[ -L "$HOOKS_DIR/theme-set.d/$MARKER" || -f "$HOOKS_DIR/theme-set.d/$MARKER" ]]; then
    rm -f "$HOOKS_DIR/theme-set.d/$MARKER"
    echo "  removed hooks/theme-set.d/$MARKER"
  fi
  if [[ -f $target ]] && grep -qF "$MARKER" "$target"; then
    sed -i "\|^$BEGIN_MARK\$|,\|^$END_MARK\$|d" "$target"
    echo "  stripped the $MARKER block from hooks/theme-set"
  fi
}

# ---------------------------------------------------------------- browser flags --

install_flags() {
  local entry name bins file count=0
  for entry in "${FLAGS_TARGETS[@]}"; do
    name="${entry%%:*}"
    bins="${entry#*:}"
    file="$HOME/.config/$name-flags.conf"
    # Only touch a conf that already exists, or one whose browser is installed.
    [[ -f $file ]] || browser_installed "$bins" || continue
    [[ -f $file ]] || : >"$file"

    grep -qF "$EXT_DIR" "$file" && continue
    if grep -q '^--load-extension=' "$file"; then
      sed -i --follow-symlinks "s|^--load-extension=\(.*\)\$|--load-extension=\1,$EXT_DIR|" "$file"
    else
      printf '%s\n' "--load-extension=$EXT_DIR" >>"$file"
    fi
    count=$((count + 1))
  done
  echo "  --load-extension added to $count browser flags file(s)"
}

remove_flags() {
  local entry name file count=0
  for entry in "${FLAGS_TARGETS[@]}"; do
    name="${entry%%:*}"
    file="$HOME/.config/$name-flags.conf"
    [[ -f $file ]] || continue
    grep -qF "$EXT_DIR" "$file" || continue
    # Drop our path from the comma list; delete the line if we were the only one.
    sed -i --follow-symlinks \
      -e "s|^\(--load-extension=.*\),$EXT_DIR\$|\1|" \
      -e "s|^\(--load-extension=.*\),$EXT_DIR,|\1,|" \
      -e "s|^--load-extension=$EXT_DIR,|--load-extension=|" \
      -e "\|^--load-extension=$EXT_DIR\$|d" \
      "$file"
    # If we created this conf and our line was all it held, don't leave an empty
    # file behind.
    [[ -s $file ]] || rm -f "$file"
    count=$((count + 1))
  done
  echo "  --load-extension removed from $count browser flags file(s)"
}

# --------------------------------------------------------------------- main --

if ((DO_UNINSTALL)); then
  echo "Uninstalling Omarchy Slack Theme..."
  remove_host_manifests
  remove_hook
  remove_flags
  echo
  echo "Done. Fully restart your browser to finish."
  exit 0
fi

for f in "$HOST_SCRIPT" "$HOST_TEMPLATE" "$HOOK_SCRIPT"; do
  [[ -f $f ]] || {
    echo "Error: missing $f" >&2
    exit 1
  }
done
chmod +x "$HOST_SCRIPT" "$HOOK_SCRIPT" 2>/dev/null || true

echo "Installing Omarchy Slack Theme..."
install_host_manifests
install_hook
if ((DO_FLAGS)); then
  install_flags
else
  echo "  skipped browser flags (--no-flags)"
fi

echo
echo "Done. Now:"
echo "  1. Fully quit your browser (pkill brave), don't just close the window."
if ((DO_FLAGS)); then
  echo "  2. If you previously loaded extension/ by hand via Developer mode,"
  echo "     remove it first — it and the --load-extension copy share the pinned"
  echo "     ID $(grep -o 'chrome-extension://[a-p]*' "$HOST_TEMPLATE" | head -1 | sed 's|chrome-extension://||')"
  echo "     and only one of them will load."
else
  echo "  2. Load $EXT_DIR unpacked via Developer mode."
fi
echo "  3. Open app.slack.com and switch omarchy themes."
