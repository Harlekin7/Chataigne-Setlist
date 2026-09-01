#!/bin/bash
# ===========================================================================
#  Setlist Dashboard for Chataigne - Install (macOS)
#  Counterpart of INSTALL.bat. Double-click in Finder.
# ===========================================================================
cd "$(dirname "$0")" || exit 1

# Finder does not start a login shell, so Homebrew/nvm are not on PATH yet.
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin"
for d in "$HOME/.nvm/versions/node/"*/bin; do
  [ -d "$d" ] && PATH="$PATH:$d"
done

bold() { printf '\033[1m%s\033[0m\n' "$1"; }

echo "============================================================"
echo "  Setlist Dashboard for Chataigne - Install"
echo "============================================================"
echo

# ------------------------------------------------------------------
# 1. Is Node.js present?
# ------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found."
  echo
  echo "   Please install the LTS build from https://nodejs.org"
  echo "   (or 'brew install node') and run this file again."
  echo
  read -r -p "Press return to close. " _
  exit 1
fi

NODEVER="$(node --version)"
NODEMAJOR="$(echo "${NODEVER#v}" | cut -d. -f1)"
if [ "$NODEMAJOR" -lt 16 ] 2>/dev/null; then
  echo "[WARNING] Node $NODEVER is older than version 16. Please update."
else
  echo "[OK]      Node.js $NODEVER"
fi

# ------------------------------------------------------------------
# 2. Find the Chataigne module folder
# ------------------------------------------------------------------
DOCS="$HOME/Documents"
MODDIR="$DOCS/Chataigne/modules"

if [ ! -d "$DOCS/Chataigne" ]; then
  echo "[NOTE]    \"$DOCS/Chataigne\" does not exist yet."
  echo "          That is normal if Chataigne has never run here -"
  echo "          the folder will be created now."
fi

# ------------------------------------------------------------------
# 3. Copy the module
# ------------------------------------------------------------------
echo
echo "Copying the module \"Setlist Index\" to:"
echo "   $MODDIR/Setlist Index"
mkdir -p "$MODDIR/Setlist Index" || {
  echo "[ERROR] Could not create the module folder."
  read -r -p "Press return to close. " _
  exit 1
}
cp -R "chataigne-module/Setlist Index/." "$MODDIR/Setlist Index/" || {
  echo "[ERROR] Copying failed. Is Chataigne still running and locking the file?"
  read -r -p "Press return to close. " _
  exit 1
}

if [ ! -f "$MODDIR/Setlist Index/module.json" ] || \
   [ ! -f "$MODDIR/Setlist Index/setlistIndex.js" ]; then
  echo "[ERROR] Files are missing in the target folder after the copy."
  read -r -p "Press return to close. " _
  exit 1
fi
echo "[OK]      module.json + setlistIndex.js are in place."

# macOS marks anything that came out of a downloaded zip as quarantined.
# Chataigne reads the module as plain text, but clearing it avoids surprises.
xattr -dr com.apple.quarantine "$MODDIR/Setlist Index" 2>/dev/null

# ------------------------------------------------------------------
# 4. Self-test of the logic
# ------------------------------------------------------------------
echo
if [ -f "test/engine.test.js" ]; then
  echo "Self-test:"
  if ! node "test/engine.test.js"; then
    echo "[WARNING] The self-test failed. Install completed anyway."
  fi
else
  echo "[INFO]    No self-test bundled in this copy - skipping."
fi

# ------------------------------------------------------------------
# 5. Is Chataigne running? Then it needs a restart.
# ------------------------------------------------------------------
echo
if pgrep -x "Chataigne" >/dev/null 2>&1; then
  echo "[ATTENTION] Chataigne is running right now."
  echo "            New modules are only read at startup - please quit"
  echo "            Chataigne completely and open it again."
else
  echo "[OK]      Chataigne is not running - the module will be found on next start."
fi

# ------------------------------------------------------------------
# 6. Optional: shortcut on the desktop
# ------------------------------------------------------------------
echo
read -r -n 1 -p "Create a 'Setlist Dashboard' shortcut on the desktop? [y/N] " ANSWER
echo
case "$ANSWER" in
  y|Y)
    LINK="$HOME/Desktop/Start Setlist Dashboard.command"
    if ln -sfn "$PWD/START-DASHBOARD.command" "$LINK" 2>/dev/null; then
      echo "[OK]      The shortcut is on your desktop."
    else
      echo "[WARNING] The shortcut could not be created."
    fi
    ;;
esac

# ------------------------------------------------------------------
echo
echo "============================================================"
echo "  Install complete"
echo "============================================================"
echo
echo "Next steps:"
echo
echo "  1. Restart Chataigne, then:  Modules  >  +  >  Custom  >  Setlist Index"
echo "  2. Check the OSC output on the module:  Local = on,"
echo "     Remote Host = 127.0.0.1,  Remote Port = 8000"
echo "  3. Attach one consequence to every song state:"
echo "        Command  >  Setlist Index  >  Set Current Song  >  Index = song number"
echo "  4. Start the server with  START-DASHBOARD.command"
echo
read -r -p "Press return to close. " _
