#!/usr/bin/env bash
#
# HarnessHub の plugins/ を .claude/plugins/ へ再同期する。
#
#   ./.claude/scripts/sync-plugins.sh                 # 全 plugin を同期
#   ./.claude/scripts/sync-plugins.sh dev-graph       # 指定 plugin だけ同期
#   ./.claude/scripts/sync-plugins.sh --dry-run       # 差分だけ表示して何も書かない
#   ./.claude/scripts/sync-plugins.sh --force ...     # ローカル変更を握り潰して上書き
#   HARNESS_HUB=/path/to/HarnessHub ./.claude/scripts/sync-plugins.sh
#
# 同期対象は HarnessHub 側で git 追跡されているファイルのみ。
# node_modules / playwright-browsers など 672MB の生成物は元リポジトリでも
# .gitignore 対象なので、追跡ファイルだけ引くのが「HarnessHub と一致」の定義になる。

set -euo pipefail

HARNESS_HUB="${HARNESS_HUB:-/Users/dm/dev/dev/個人開発/HarnessHub}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST_ROOT="$REPO_ROOT/.claude/plugins"
STATE_FILE="$DEST_ROOT/.sync-state.json"

DRY_RUN=0
FORCE=0
TARGETS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run|-n) DRY_RUN=1 ;;
    --force|-f)   FORCE=1 ;;
    -h|--help)    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)           echo "不明なオプション: $1" >&2; exit 2 ;;
    *)            TARGETS+=("$1") ;;
  esac
  shift
done

[[ -d "$HARNESS_HUB/.git" ]] || { echo "error: HarnessHub が見つからない: $HARNESS_HUB" >&2; exit 1; }

SRC_SHA="$(git -C "$HARNESS_HUB" rev-parse HEAD)"
SRC_DIRTY="$(git -C "$HARNESS_HUB" status --porcelain -- plugins | head -c 1)"
[[ -n "$SRC_DIRTY" ]] && echo "warn: HarnessHub の plugins/ に未コミット変更あり。作業ツリーの現状を同期する。" >&2

# affiliate-hub では使わないと判断して削除した plugin。HarnessHub には残っているので、
# 除外しないと同期のたびに復活する。使いたくなったらここから外して同期すれば戻る。
EXCLUDED="company-master contract-generator mf-kessai-invoice-check notion-gmail-send ubm-goal-setting"

is_excluded() {
  local p="$1" e
  for e in $EXCLUDED; do [[ "$p" == "$e" ]] && return 0; done
  return 1
}

# 対象 plugin 一覧を決める。macOS 標準の bash 3.2 には mapfile が無いので while-read で読む。
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  while IFS= read -r line; do
    is_excluded "$line" && continue
    TARGETS+=("$line")
  done < <(git -C "$HARNESS_HUB" ls-files plugins | awk -F/ 'NF>1 {print $2}' | sort -u)
else
  # 明示指定された場合は除外リストを無視しない。意図せず復活させないため止める。
  for t in "${TARGETS[@]}"; do
    if is_excluded "$t"; then
      echo "error: $t は削除済み plugin。戻すなら sync-plugins.sh の EXCLUDED から外す。" >&2
      exit 2
    fi
  done
fi

# ---------------------------------------------------------------------------
# ローカル変更ポリシー
#
# affiliate-hub 側で plugin を直接いじった状態で同期をかけると、rsync --delete が
# その変更を黙って消す。git 追跡済みファイルの変更・削除を「ローカル変更」とみなし、
# どう扱うかをここで決める。
#
# 引数: $1 = plugin 名, $2 = 変更のあるパスの改行区切りリスト (空でないことは呼び出し側で保証)
# 戻り値: 0 = この plugin を同期する / 1 = スキップする
# ---------------------------------------------------------------------------
resolve_local_changes() {
  local plugin="$1" changed="$2"

  if [[ $FORCE -eq 1 ]]; then
    echo "  [force] ローカル変更を上書きする"
    return 0
  fi

  # 何を消そうとしているのかを必ず見せる。黙って上書きしない。
  echo "$changed" | sed 's/^/    /'

  # 端末が繋がっていれば都度確認する。CI や非対話実行では止まらずスキップに倒す。
  if [[ -t 0 ]]; then
    local answer=""
    read -r -p "  $plugin を HarnessHub の内容で上書きする? [y/N] " answer
    case "$answer" in
      [yY]|[yY][eE][sS]) return 0 ;;
    esac
  fi

  echo "  スキップ。上書きするなら: $(basename "${BASH_SOURCE[0]}") --force $plugin"
  echo "  ローカル変更を残すなら、先に HarnessHub 側へ還元してから同期する。"
  return 1
}

# ---------------------------------------------------------------------------

synced=(); skipped=(); missing=()

for plugin in "${TARGETS[@]}"; do
  src="$HARNESS_HUB/plugins/$plugin"
  dest="$DEST_ROOT/$plugin"

  if [[ ! -d "$src" ]]; then
    echo "!! $plugin: HarnessHub に存在しない"; missing+=("$plugin"); continue
  fi

  # 追跡済みファイルで、内容が変わっている / 消えているものを拾う (?? の新規追加は除外)
  changed=""
  if [[ -d "$dest" ]] && git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    changed="$(git -C "$REPO_ROOT" status --porcelain -- ".claude/plugins/$plugin" \
      | grep -v '^??' || true)"
  fi

  if [[ -n "$changed" ]]; then
    echo "== $plugin: ローカル変更あり"
    if ! resolve_local_changes "$plugin" "$changed"; then
      skipped+=("$plugin"); continue
    fi
  fi

  rsync_opts=(-a --delete)
  [[ $DRY_RUN -eq 1 ]] && rsync_opts+=(--dry-run --itemize-changes)

  # --files-from のパスは plugins/<name>/... 形式なので、送出元は HarnessHub ルート、
  # 受け側は .claude/ にして .claude/plugins/<name>/... へ落とす。
  # --delete を効かせるため、削除対象の探索範囲を当該 plugin に限定する。
  mkdir -p "$dest"
  out="$(git -C "$HARNESS_HUB" ls-files -z "plugins/$plugin" \
    | rsync "${rsync_opts[@]}" --files-from=- --from0 \
        "$HARNESS_HUB/" "$REPO_ROOT/.claude/" 2>&1)" || {
    echo "!! $plugin: rsync 失敗"; echo "$out"; exit 1
  }

  if [[ $DRY_RUN -eq 1 ]]; then
    if [[ -n "$out" ]]; then echo "== $plugin (dry-run)"; echo "$out" | sed 's/^/   /'; fi
  else
    synced+=("$plugin")
  fi
done

if [[ $DRY_RUN -eq 1 ]]; then
  echo "dry-run のため書き込みなし"
  exit 0
fi

# 同期状態を記録する。どの HarnessHub コミットから引いたかを後から追えるようにする。
# bash 3.2 では set -u 下の空配列展開が落ちるので、件数を見てから展開する。
if [[ ${#synced[@]} -gt 0 ]]; then
  SYNCED_JSON="$(printf '%s\n' "${synced[@]}" | python3 -c 'import json,sys; print(json.dumps([l for l in sys.stdin.read().split("\n") if l]))')"
else
  SYNCED_JSON="[]"
fi
python3 - "$STATE_FILE" "$SRC_SHA" "$HARNESS_HUB" "$SYNCED_JSON" <<'PY'
import json, os, subprocess, sys
state_file, sha, source, synced_json = sys.argv[1:5]
synced = json.loads(synced_json)
state = {}
if os.path.exists(state_file):
    state = json.load(open(state_file))
state["source"] = source
state.setdefault("plugins", {})
stamp = subprocess.run(
    ["git", "-C", source, "show", "-s", "--format=%cI", sha],
    capture_output=True, text=True,
).stdout.strip()
for p in synced:
    state["plugins"][p] = {"harnesshub_commit": sha, "committed_at": stamp}
os.makedirs(os.path.dirname(state_file), exist_ok=True)
with open(state_file, "w") as f:
    json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)
    f.write("\n")
PY

# 削除した plugin へ向いた symlink が同期で復活すると dangling になる。
# 例: harness-creator の run-contract-* は実体が contract-generator 側にある。
dangling="$(find "$DEST_ROOT" -type l ! -exec test -e {} \; -print)"
if [[ -n "$dangling" ]]; then
  echo "削除済み plugin を指す symlink を除去:"
  echo "$dangling" | sed "s|^$DEST_ROOT/|  |"
  echo "$dangling" | while IFS= read -r l; do rm -f "$l"; done
fi

python3 "$REPO_ROOT/.claude/scripts/gen-marketplace.py"

echo
echo "同期: ${#synced[@]} 件"
[[ ${#skipped[@]} -gt 0 ]] && echo "スキップ: ${skipped[*]}"
[[ ${#missing[@]} -gt 0 ]] && echo "元に無い: ${missing[*]}"
echo "HarnessHub commit: ${SRC_SHA:0:12}"
exit 0
