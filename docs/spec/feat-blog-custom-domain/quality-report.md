# 非機能検査 — 住所層

## 所有境界 (multi-tenant)

`tests/architecture/tenant-scoped-schema.test.ts` が、住所表を触る全クエリに
`workspace_id` の述語があることを機械で検査する。例外として登録されているのは
公開経路の 2 本だけで、それぞれ理由が表に書かれている。

- `custom-domain-repository.ts::siteCustomDomains::findActiveByHostname`
- `custom-domain-repository.ts::siteCustomDomains::resolveSiteSlugByHost`

この 2 本は「どの workspace のものか分かる前に引く」照会であり、hostname が
世界で一意 (部分ユニーク索引) であることが所有境界の代わりを果たしている。

`tests/architecture/tenant-scoped-ports.test.ts` がポート側でも同じ検査をする。

## 秘密の扱い

Cloudflare の API トークンはコードにも設定ファイルにも置かない。
`src/infrastructure/domains/cloudflare-custom-hostname.ts` は実行環境の binding から
読む。監査記録に載せるのは hostname と状態だけで、トークン・検証用の値は載せない。

## 可用性

| 落ちたもの | 起きること |
|---|---|
| Cloudflare API (登録時) | D1 への保存は済む。`notice` で「申し込めていない」と伝える。あとで「状態を確認」で再開 |
| Cloudflare API (取り下げ時) | 配信は止まる (D1 を先に落とすため)。外部の登録が残ることを `notice` で伝える |
| D1 | 操作は失敗する。既定住所での配信は住所表に依存しないので継続する |
| 監査記録 | 操作を成功として返さない (意図的に厳しい側へ倒している) |

## 個人情報

住所層は読者の情報を一切扱わない。監査記録に載る主体は運用者である。

## 性能

- 一覧は `(workspace_id, site_slug, status)` の索引で引く。
- 公開照会は `hostname` の一意索引で 1 行に当たる。
- **入口の往復は写しで抑える。** 配線により要求ごとに 1 回の照会が入りうるが、
  寿命 60 秒・上限 512 件の写しを通す。同じホストへの連続した要求は 1 回にまとまる。
  見つからなかったことも写すので、独自ドメインを使っていない環境では
  60 秒に 1 回だけ引いて、あとは写しで返す。
- **画面の部品は住所表を引く前に落とす** (`/_next/`, `/cdn-cgi/`)。1 ページの表示で
  何十件も届くため、ここを落とさないと往復が跳ね上がる。
- **公開ページの canonical も同じ写しを通る** (逆向きの照会)。引けなければ既定の住所へ
  倒すので、D1 の不調が公開ページの描画を止めることはない。

## 依存の向き (AD-1)

住所層は観測層 (`site_daily_metrics` ほか)・改善層 (SEO/AEO)・提示層のどれにも依存しない。
逆に提示層 `/admin/sites/[site]/domains` が住所層を読む。向きは崩れていない。
