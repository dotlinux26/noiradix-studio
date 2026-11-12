#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' "Python 3 is required. Install Python 3, then run this script again." >&2
  exit 1
fi

if command -v open >/dev/null 2>&1; then
  OPEN_COMMAND="open"
elif command -v xdg-open >/dev/null 2>&1; then
  OPEN_COMMAND="xdg-open"
else
  printf '%s\n' "Could not find a browser opener (open or xdg-open). Open http://127.0.0.1 manually." >&2
  exit 1
fi

PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
URL="http://127.0.0.1:${PORT}/"

cd "$APP_DIR"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

ready=0
for _ in {1..50}; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    printf '%s\n' "The local web server stopped before it was ready." >&2
    exit 1
  fi
  if python3 -c 'import sys, urllib.request; urllib.request.urlopen(sys.argv[1], timeout=0.3).close()' "$URL" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.1
done

if [[ "$ready" -ne 1 ]]; then
  printf '%s\n' "The local web server did not become ready at $URL" >&2
  exit 1
fi

printf 'NOIRADIX Studio is running at %s\nPress Ctrl+C to stop it.\n' "$URL"
"$OPEN_COMMAND" "$URL" >/dev/null 2>&1 || printf 'Open this URL in your browser: %s\n' "$URL"
wait "$SERVER_PID"
