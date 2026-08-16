#!/usr/bin/env bash
# harness-hub-publisher: publish サブコマンドの薄いラッパー (PT5-B, AD-1)。
# package 収集・manifest 補完・Device Flow 認証・wrangler 実行のいずれも実装しない —
# 全て apps/publisher/src/cli/ (bin/harness-publisher.mjs) 側の実装を呼ぶだけ。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
LOCAL_BIN="$REPO_ROOT/apps/publisher/bin/harness-publisher.mjs"

if [[ -n "${HARNESS_HUB_PUBLISHER_BIN:-}" ]]; then
  if [[ ! -f "$HARNESS_HUB_PUBLISHER_BIN" ]]; then
    echo "HARNESS_HUB_PUBLISHER_BIN が指すPublisher CLIが見つかりません: $HARNESS_HUB_PUBLISHER_BIN" >&2
    exit 1
  fi
  exec node "$HARNESS_HUB_PUBLISHER_BIN" publish "$@"
fi

if command -v harness-publisher >/dev/null 2>&1; then
  exec harness-publisher publish "$@"
fi

if [[ -f "$LOCAL_BIN" ]]; then
  exec node "$LOCAL_BIN" publish "$@"
fi

cat >&2 <<'EOF'
Harness Hub Publisher CLIが見つかりません。
harness-publisherをPATHへ追加するか、次のようにHarnessHub checkout内のbinを指定してください。
  export HARNESS_HUB_PUBLISHER_BIN=/absolute/path/to/HarnessHub/apps/publisher/bin/harness-publisher.mjs
EOF
exit 1
