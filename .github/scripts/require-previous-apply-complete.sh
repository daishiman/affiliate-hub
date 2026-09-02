#!/usr/bin/env bash
#
# 前回の公開が「データの形を合わせる」の**最中に**終わっていないかを見る。
#
# --- なぜ要るか（2026-09-02） ---
#
# 控えを取ることは「戻れる」ことしか言わない。「戻るべきか」を判断するには、
# 途中で止まったことが見えていなければならない。
#
# 上限が適用の最中に発火すると、1 つの移行ファイルの中の statement の途中で
# 切れることがある。そこまでの変更は D1 に残るが、台帳には載らない。
# 次の公開は「未適用がある」と見て同じファイルを頭から当て直し、
# `duplicate column name` で止まる（2026-08-24 の run #22 がこれ）。
# 落ちること自体は正しいが、**なぜ落ちたのかが run の見た目から分からない。**
#
# --- なぜ印を D1 に置かないか ---
#
# 「適用の直前に行を書き、終わったら消す」が素直に見える。だが印の表は
# `db:drift`（実 DB と移行ファイルの突合）に**余り**として出る。
# アプリのスキーマへ運用用の表を混ぜるか、drift を緩めるかの二択になり、
# どちらも守りたいものを削る。
#
# 代わりに、**すでに残っている記録**を印として読む。適用ステップに step 上限を
# 置いてあるので、切れたときそのステップは `cancelled` として run に確定して残る。
# 次の run はそれを見て止まる。成功していれば印は無い——消したのと同じ形になる。
#
# --- 判定 ---
#
#   前の run が無い            → 通す（初回）
#   適用ステップが cancelled   → **落とす**（途中で終わった疑いがある）
#   適用ステップが結論を持たない → **落とす**（開始したが終わっていない）
#   それ以外                   → 通す
#   測れなかった               → **落とす**（緑にしない）
#
# 最後の 1 行が要点である。「測れなかった」を通すと、この検査は
# 資格情報が切れた日から静かに何も見なくなる。
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN が要ります}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY が要ります}"
: "${GITHUB_REF_NAME:?GITHUB_REF_NAME が要ります}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID が要ります}"
: "${GITHUB_WORKFLOW_REF:?GITHUB_WORKFLOW_REF が要ります}"

# 適用ステップの表示名。deploy.yml の `- name:` と一字一句そろえる。
# ずれると「見つからない」に落ちるが、それは下で**落とす**側へ倒してある。
APPLY_STEP_NAME="${APPLY_STEP_NAME:-データの形を合わせる}"
RELEASE_JOB_NAME="${RELEASE_JOB_NAME:-公開}"

workflow_file="${GITHUB_WORKFLOW_REF%%@*}"
workflow_file="${workflow_file#"${GITHUB_REPOSITORY}"/}"

fail() {
  echo "::error::$1"
  exit 1
}

runs_json=""
if ! runs_json="$(
  gh api \
    "repos/${GITHUB_REPOSITORY}/actions/workflows/$(basename "$workflow_file")/runs" \
    -f branch="${GITHUB_REF_NAME}" -f per_page=20 --jq '.workflow_runs' 2>&1
)"; then
  fail "前回の公開を読めませんでした（${runs_json}）。測れなかったので止めます。"
fi

# 自分より前に始まった run のうち、いちばん新しいもの。
previous_id="$(
  printf '%s' "$runs_json" |
    jq -r --argjson me "${GITHUB_RUN_ID}" \
      '[.[] | select(.id < $me)] | sort_by(.id) | last | .id // empty'
)"

if [ -z "$previous_id" ]; then
  echo "前回の公開はありません（この枝では初回）。通します。"
  exit 0
fi

jobs_json=""
if ! jobs_json="$(
  gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${previous_id}/jobs" \
    --jq '.jobs' 2>&1
)"; then
  fail "前回の公開 (${previous_id}) の中身を読めませんでした（${jobs_json}）。測れなかったので止めます。"
fi

# 前回の run に公開の job が無いこともある（検査で止まった回）。それは通す。
release_job="$(printf '%s' "$jobs_json" | jq -c --arg n "$RELEASE_JOB_NAME" \
  '[.[] | select(.name == $n)] | last // empty')"
if [ -z "$release_job" ]; then
  echo "前回の公開 (${previous_id}) は公開の手前で終わっています。適用は始まっていません。"
  exit 0
fi

apply_step="$(printf '%s' "$release_job" | jq -c --arg n "$APPLY_STEP_NAME" \
  '[.steps[]? | select(.name == $n)] | last // empty')"
if [ -z "$apply_step" ]; then
  # 名前を変えた・ステップを消した、のどちらでもここへ来る。
  # 「見つからない」を通すと、名前がずれた日からこの検査は何も見なくなる。
  fail "前回の公開 (${previous_id}) に「${APPLY_STEP_NAME}」が見当たりません。名前がずれた可能性があります。測れなかったので止めます。"
fi

status="$(printf '%s' "$apply_step" | jq -r '.status // "unknown"')"
conclusion="$(printf '%s' "$apply_step" | jq -r '.conclusion // "none"')"

case "$conclusion" in
  cancelled)
    fail "前回の公開 (${previous_id}) は「${APPLY_STEP_NAME}」の最中に打ち切られました。$(
      printf '\n'
    )D1 に途中までの変更が残っている可能性があります。控えは残っているので、
まず docs/spec/11-CI-CD・品質ゲート仕様.md §4-1-3 の手順で実際の形を確かめてください。
確かめずにこの公開をやり直すと、部分的に当たった移行の上へ同じ移行を当て直します。"
    ;;
  none)
    if [ "$status" != "completed" ]; then
      fail "前回の公開 (${previous_id}) の「${APPLY_STEP_NAME}」が終わっていません（status=${status}）。測れなかったので止めます。"
    fi
    fail "前回の公開 (${previous_id}) の「${APPLY_STEP_NAME}」に結論がありません。測れなかったので止めます。"
    ;;
  *)
    echo "前回の公開 (${previous_id}) の「${APPLY_STEP_NAME}」は ${conclusion} で終わっています。通します。"
    exit 0
    ;;
esac
