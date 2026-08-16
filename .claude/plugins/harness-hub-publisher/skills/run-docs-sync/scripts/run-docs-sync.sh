#!/usr/bin/env bash
# Harness Hub Docs同期の薄いランチャー。認証・同期・競合判定はPublisher CLIだけが持つ。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
LOCAL_BIN="$REPO_ROOT/apps/publisher/bin/harness-publisher.mjs"

if [[ -n "${HARNESS_HUB_PUBLISHER_BIN:-}" ]]; then
  if [[ ! -f "$HARNESS_HUB_PUBLISHER_BIN" ]]; then
    echo "HARNESS_HUB_PUBLISHER_BIN が指すPublisher CLIが見つかりません: $HARNESS_HUB_PUBLISHER_BIN" >&2
    exit 1
  fi
  exec node "$HARNESS_HUB_PUBLISHER_BIN" docs "$@"
fi

if command -v harness-publisher >/dev/null 2>&1; then
  exec harness-publisher docs "$@"
fi

if [[ -f "$LOCAL_BIN" ]]; then
  exec node "$LOCAL_BIN" docs "$@"
fi

cat >&2 <<'EOF'
Harness Hub Publisher CLIが見つかりません。
harness-publisherをPATHへ追加するか、次のようにHarnessHub checkout内のbinを指定してください。
  export HARNESS_HUB_PUBLISHER_BIN=/absolute/path/to/HarnessHub/apps/publisher/bin/harness-publisher.mjs
EOF
exit 1
