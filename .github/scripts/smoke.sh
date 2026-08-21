#!/usr/bin/env bash
# 公開したものが本当に動いているかを、間隔を空けて 2 回確かめる。
#
# なぜ 2 回か:
# Cloudflare Workers は公開後も古い実行環境を数十秒〜1〜2 分保持する。
# 1 回だけ見ると、「直っているのに直っていない」と「壊れているのに大丈夫」の
# どちらにも誤判定する。1 回目で古い応答、2 回目で新しい応答を見る。
#
# 手元でも同じように実行できる:
#   APP_URL=https://example.workers.dev bash .github/scripts/smoke.sh
#
# 規範: docs/spec/11-CI-CD・品質ゲート仕様.md
set -euo pipefail

if [ -z "${APP_URL:-}" ]; then
  echo "::error::APP_URL が設定されていません。GitHub の Variables に本番URLを登録してください（gh variable set APP_URL）。"
  exit 1
fi

ORIGIN="${APP_URL%/}"
FIRST_WAIT="${SMOKE_FIRST_WAIT:-30}"
SECOND_WAIT="${SMOKE_SECOND_WAIT:-90}"

# 「この経路が、この状態で返る」だけを見る。中身の網羅はテスト側の仕事。
# 認証が要る経路を 200 期待にすると、鍵の登録漏れで常に赤くなり無視される。
#
# `/api/tools` に 401 を期待しているのは、断ること自体を確かめるため。
# ここが **503** で落ちたときは、壊れたのではなく `MCP_TOKEN` が本番に未登録である
# （api-token.ts は未登録のとき開けっ放しにせず閉じる）。
# 登録手順は docs/product/ci-cd-guide.md ⑧。
#
# `/admin` が 307 なのは壊れているからではない。src/middleware.ts が
# 「ログインしていない人を /signin へ送る」と決めており、**それが通っている証拠**である。
# ここを 200 にすると、門が外れて誰でも入れる状態が緑になってしまう。
#
# 4 つ目の欄は「どこへ送られるべきか」。空なら飛び先を見ない。
# 状態だけを見ると、飛び先が外部のアドレスに差し替わっても 307 のまま緑になる。
# middleware は戻り先を付けない作りなので、飛び先は /signin ちょうどに定まる。
CASES=(
  "/|200||入口"
  "/admin|307|/signin|管理の入口（ログインしていなければサインインへ送る）"
  "/api/tools|401||道具の一覧（合言葉なしでは断る）"
)

check_once() {
  local label="$1"
  local failed=0

  echo "--- ${label}"
  for c in "${CASES[@]}"; do
    IFS='|' read -r path expected expected_location name <<<"$c"
    # 本文は取り出さない。応答の中身を持ち出すと、実行ログに情報が残る。
    # 飛び先だけは取る（`%{redirect_url}` は 3xx でないとき空になる）。
    response="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "${ORIGIN}${path}" || echo "000 ")"
    actual="${response%% *}"
    location="${response#* }"

    if [ "$actual" != "$expected" ]; then
      echo "  NG   ${name} (${path}) → ${actual}（期待: ${expected}）"
      failed=1
      continue
    fi

    # 飛び先を見ないケースはここで終わり。空同士の比較で偶然通す形にはしない。
    if [ -z "$expected_location" ]; then
      echo "  OK   ${name} (${path}) → ${actual}"
      continue
    fi

    # **末尾一致では見ない。** それだと https://悪意のある宛先/signin も通ってしまう。
    # 自分の入口に付けた形と丸ごと比べる。
    if [ "$location" = "${ORIGIN}${expected_location}" ]; then
      echo "  OK   ${name} (${path}) → ${actual}（${expected_location} へ送っています）"
    else
      echo "  NG   ${name} (${path}) → ${actual}（送り先が違います。期待: ${ORIGIN}${expected_location} / 実際: ${location:-なし}）"
      failed=1
    fi
  done
  return $failed
}

echo "確認先: ${ORIGIN}"

echo "${FIRST_WAIT} 秒待ちます（公開直後は古い実行環境が残っているため）"
sleep "$FIRST_WAIT"
first_status=0
check_once "1 回目" || first_status=1

echo "${SECOND_WAIT} 秒待ちます（新しい版に入れ替わるのを待つ）"
sleep "$SECOND_WAIT"
second_status=0
check_once "2 回目" || second_status=1

# 判定は 2 回目で行う。1 回目の失敗は古い版を見ている可能性がある。
# ただし 1 回目だけ落ちた場合も黙って通さず、記録として残す。
if [ "$second_status" -ne 0 ]; then
  echo "::error::2 回目の確認で落ちました。公開したものが動いていません。"
  echo "戻すには: wrangler rollback"
  exit 1
fi

if [ "$first_status" -ne 0 ]; then
  echo "::warning::1 回目は落ちましたが 2 回目は通りました（入れ替わり待ちと考えられます）。"
fi

echo "動作確認に通りました。"
