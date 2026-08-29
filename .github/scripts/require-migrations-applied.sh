#!/usr/bin/env bash
# 公開する前に、その環境のデータの形が**もう新しくなっているか**を確かめる。
#
# なぜ要るか:
# 順番は「データの形の変更 (migrate.yml) → 公開 (deploy.yml)」で固定と決めてある。
# ところが migrate は人が起動する手動、deploy は main への push で自動である。
# この非対称のせいで、実際には**マージした瞬間に公開だけが先に走る**。
# 2026-08-21 にこれが起きた（公開 09:31 → 移行 09:37）。
# そのときは列の追加だったので無害だったが、列を消す・改名する変更で同じ順になると、
# 新しいコードが存在しない列を読んで本番が全面エラーになる。
#
# 決めごとを人の記憶に預けるのをやめ、機械に見張らせるのがこのファイルである。
#
# 未適用だったときにどうするかは `PENDING_ACTION` で切り替える:
#   fail   … 落とす（既定。**本番はこれ以外を使わない**）
#   report … 書き出して通す。dev で「このあと自分で適用する」と決まっているときだけ
#
# `report` を足したのは、dev で公開の前に自動適用するようにしたからである。
# 自動適用の**前**に置く見張りは、未適用を見つけても落としてはいけない。
# 落とすと、直そうとしている当のステップへ辿り着けない。
# **`report` が緩めるのは pending だけで、`unknown` は変わらず落とす。**
# 「測れなかった」を通す道はどちらの設定でも作らない。
#
# 手元でも同じように実行できる:
#   D1_ENV=dev bash .github/scripts/require-migrations-applied.sh
#
# 規範: docs/spec/11-CI-CD・品質ゲート仕様.md / docs/product/ci-cd-guide.md
set -euo pipefail

if [ -z "${D1_ENV:-}" ]; then
  echo "::error::D1_ENV が設定されていません（dev または production）。"
  exit 1
fi

# 既定は落とすほう。**書き忘れたら厳しい側に倒れる**ようにしてある。
# 逆にすると、変数を書き損じた回だけ見張りが消えて、しかも緑で気づけない。
pending_action="${PENDING_ACTION:-fail}"
if [ "$pending_action" != "fail" ] && [ "$pending_action" != "report" ]; then
  echo "::error::PENDING_ACTION には fail か report を指定してください（入力値: '${pending_action}'）。"
  exit 1
fi

# 指定するのは D1 の名前ではなく**バインディング名 `DB`**。
# package.json の db:migrate:* と migrate.yml も同じ指定にしてある。
# ここだけ別の呼び方にすると、片方の環境でだけ「そんなデータベースは無い」で落ちる。
#
# `|| true` で受けているのは、失敗を握り潰すためではない。
# `set -e` に即殺されると **wrangler が何と言って落ちたのかを読めない**。
# 終了状態は下の判定へそのまま渡し、そこで落とす。
set +e
output="$(pnpm exec wrangler d1 migrations list DB --env "$D1_ENV" --remote 2>&1)"
wrangler_status=$?
set -e

echo "--- wrangler の出力"
echo "$output"
echo "---"

# 出力から「公開してよいか」を決める。
#
# 返す言葉は 3 つのどれか:
#   applied  … 未適用は無い。公開してよい
#   pending  … 未適用が残っている。公開を止める
#   unknown  … 判断が付かない（wrangler が落ちた、出力の形が変わった、など）
#
# 呼び出し側は unknown を **pending と同じ扱いで落とす**。
# 「測れなかった」を「大丈夫だった」に読み替えないためで、
# これは `verify` 側で「黙って測らない道は作らない」と決めているのと同じ考え方である。
judge_output() {
  local output="$1"
  local wrangler_status="$2"

  # wrangler がまともに終わっていないなら、出力の中身を読む価値がない。
  # 認証切れ・DB 名違い・接続不能はすべてここに来る。
  if [ "$wrangler_status" -ne 0 ]; then
    echo unknown
    return
  fi

  # **絵文字も罫線も見ない。** `✅` や `├──` は locale や端末の設定で化ける。
  # 化けた日に判定が変わる文字へ、本番を止めるかどうかの判断を預けない。
  # 見るのは英語の平文 2 つだけで、これは wrangler が版を跨いで保っている文面である。
  local has_pending=0
  local has_applied=0
  if printf '%s' "$output" | grep -qi 'Migrations to be applied'; then
    has_pending=1
  fi
  if printf '%s' "$output" | grep -qi 'No migrations to apply'; then
    has_applied=1
  fi

  # 片方だけが出たときにしか答えを出さない。
  # 両方出た／どちらも出なかったは「文面が変わった」の合図であって、
  # 「未適用は無かった」ではない。読み替えずに unknown で止める。
  if [ "$has_pending" -eq 1 ] && [ "$has_applied" -eq 0 ]; then
    echo pending
  elif [ "$has_applied" -eq 1 ] && [ "$has_pending" -eq 0 ]; then
    echo applied
  else
    echo unknown
  fi
}

verdict="$(judge_output "$output" "$wrangler_status")"

case "$verdict" in
  applied)
    echo "未適用の移行はありません（${D1_ENV}）。公開へ進みます。"
    ;;
  pending)
    if [ "$pending_action" = "report" ]; then
      echo "::notice::${D1_ENV} に未適用の移行があります。このあとの自動適用で合わせます。"
      exit 0
    fi
    echo "::error::${D1_ENV} に未適用の移行が残っています。先に「データの形の変更」を実行してください。"
    echo "  gh workflow run migrate.yml -f environment=${D1_ENV} -f confirm=APPLY"
    exit 1
    ;;
  *)
    echo "::error::${D1_ENV} の移行の状態を確かめられませんでした（判定: ${verdict:-なし} / wrangler の終了状態: ${wrangler_status}）。"
    echo "確かめられないまま公開すると、順番の取り違えに気づけません。上の出力を読んでください。"
    exit 1
    ;;
esac
