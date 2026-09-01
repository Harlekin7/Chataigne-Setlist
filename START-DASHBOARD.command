#!/bin/bash
# ===========================================================================
#  Setlist Dashboard - Server (macOS)
#  Counterpart of START-DASHBOARD.bat. Double-click in Finder.
#  Leave the Terminal window open - closing it stops the server.
# ===========================================================================
cd "$(dirname "$0")/companion" || exit 1

# Finder does not start a login shell, so Homebrew/nvm are not on PATH yet.
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin"
for d in "$HOME/.nvm/versions/node/"*/bin; do
  [ -d "$d" ] && PATH="$PATH:$d"
done

HTTP_PORT="${HTTP_PORT:-8080}"
OSC_IN_PORT="${OSC_IN_PORT:-8000}"
export HTTP_PORT OSC_IN_PORT

echo "============================================================"
echo "  Setlist Dashboard - Server"
echo "============================================================"
echo

# ------------------------------------------------------------------
# Is Node.js present?
# ------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found."
  echo "        Please run INSTALL.command first."
  echo
  read -r -p "Press return to close. " _
  exit 1
fi

# ------------------------------------------------------------------
# Is a server already running here? Avoid a double start.
# ------------------------------------------------------------------
if lsof -nP -iTCP:"$HTTP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[ATTENTION] Something is already running on port $HTTP_PORT."
  echo "            The server is probably up in another window already."
  echo "            Dashboard:  http://localhost:$HTTP_PORT"
  echo
  read -r -n 1 -p "Try to start anyway? [y/N] " ANSWER
  echo
  case "$ANSWER" in
    y|Y) ;;
    *) exit 0 ;;
  esac
fi

# ------------------------------------------------------------------
# Is another program holding the OSC input? The most common trip-up.
# ------------------------------------------------------------------
OSCOWNER="$(lsof -nP -iUDP:"$OSC_IN_PORT" 2>/dev/null | awk 'NR==2 { print $1 " / PID " $2 }')"
if [ -n "$OSCOWNER" ]; then
  echo "[NOTE]    UDP port $OSC_IN_PORT is held by:  $OSCOWNER"
  echo "          If that is not this server, no OSC data from Chataigne"
  echo "          will arrive."
  echo
fi

# ------------------------------------------------------------------
# Open the browser after a short delay, then run the server in front
# ------------------------------------------------------------------
echo "Dashboard:  http://localhost:$HTTP_PORT"
echo "OSC in:     port $OSC_IN_PORT   Chataigne sends here"
echo
echo "Leave this window open - closing it stops the server."
echo "Stop with Ctrl+C."
echo

( sleep 2; open "http://localhost:$HTTP_PORT" ) >/dev/null 2>&1 &

node server.js

echo
echo "Server stopped."
read -r -p "Press return to close. " _
