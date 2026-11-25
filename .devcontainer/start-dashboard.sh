#!/usr/bin/env bash
set -euo pipefail

dashboard_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$dashboard_directory"
dashboard_address="http://127.0.0.1:5173/sap-federal-dashboard/"

# Forwarded Codespaces ports default to private, requiring the owner to sign in.
# Reopening an already-running Codespace should not start a second server.
if ! curl --fail --silent --max-time 2 "$dashboard_address" >/dev/null; then
  nohup npm run dev -- --host 0.0.0.0 --port 5173 </dev/null > /tmp/federal-dashboard-vite.log 2>&1 &
fi

for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 "$dashboard_address" >/dev/null; then
    echo "Dashboard ready. Open port 5173 in the Ports tab; visibility defaults to Private."
    exit 0
  fi
  sleep 1
done

echo "Dashboard did not start. See /tmp/federal-dashboard-vite.log." >&2
exit 1
