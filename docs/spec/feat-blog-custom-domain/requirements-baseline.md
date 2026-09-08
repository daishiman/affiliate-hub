# 要求ベースライン — ブログ独自ドメイン

- feature: `feat-blog-custom-domain`
- 上位ゴール: G1 (一つのアフィリエイト URL を起点に、目的の異なる高品質コンテンツを安全に作成・公開・改善できる)
- アーキテクチャ: `architecture/arch-blog-operations-console.md` の**住所層**
- 参照仕様: `system-spec/infrastructure.md` (`qa-infra-web-custom-hostname`)

## この feature が引き受ける問題

ブログは既定住所 `/s/<URL名>` で必ず読める。しかし運営としては、ブログごとに
自分で取ったドメインで読者へ届けたい。ここで難しいのは、**住所の正本が 2 つに割れる**
ことである。「このドメインを使う」という意思は当方 (D1) が持ち、「所有権が確認できたか・
証明書が出たか」という事実は Cloudflare for SaaS が持つ。

この 2 つを 1 つの状態列へ潰すと、外部が落ちている間に写しが正本のように振る舞い、
証明書の無いホストへ読者を案内する経路ができる。

## 要求 (scope_in)

| id | 要求 |
|---|---|
| R1 | `site_custom_domains` に住所を持つ (workspace / ブログ / hostname / 検証状態 / 証明書状態 / 外部 id / 検証用値 / 失敗理由) |
| R2 | 接続: hostname を受け取り外部へ custom hostname として申し込み、DNS に置く設定を返す |
| R3 | 検証取り込み: 外部の検証・証明書状態を写し取り、状態を進める |
| R4 | 切断: 行を物理削除せず取り下げ状態にし、同じ hostname を再接続できる経路を残す |
| R5 | Host ヘッダ → active 行 → URL 名 の解決 (該当なしは既定住所の解決へ委譲) |
| R6 | active の間、正規の住所を独自ドメインへ切り替える |
| R7 | 接続・切断の権限を絞り、切断は確認入力を要求し、いずれも監査記録へ残す |
| R8 | 管理画面 `/admin/sites/[site]/domains` で手順・現在状態・失敗理由を出す |

## スコープ外

- ドメインの購入・レジストラ契約 (利用者が外部で取得する)
- 自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)
- 既定住所 `<URL名>.<基底ドメイン>` の導出とワイルドカード経路 (`feat-blog-subdomain-routing`)
- 状態の定期監視と期限警告の掲出順序 (`feat-blog-scoped-admin-console`)

## 受入条件 (正本 = `features/feat-blog-custom-domain.context.json`)

A1 未検証ホストは配信しない / A2 hostname UNIQUE / A3 active な独自ドメインが 200 /
A4 既定住所も同時に 200 / A5 canonical の切替 / A6 切断しても行が残る /
A7 権限と確認入力 / A8 監査記録 / A9 失敗理由の掲出 / A10 二度接続しても重複しない。

判定は `acceptance-report.md` に置く。
