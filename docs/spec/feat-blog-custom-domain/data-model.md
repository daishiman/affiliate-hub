# データモデル — `site_custom_domain`

正本: `src/db/schema.ts` (`siteCustomDomains`) / 移行: `drizzle/0044_funny_groot.sql`

## 列

| 列 | 型 | 意味 |
|---|---|---|
| `id` | text PK | 行の識別子 |
| `workspace_id` | text NOT NULL | 所有境界。あらゆる読み書きの述語に入る |
| `site_slug` | text NOT NULL | どのブログの住所か。層をまたぐ唯一の結合キー (AD-5) |
| `hostname` | text NOT NULL | 小文字へ正規化済みの完全修飾ホスト名 |
| `status` | text NOT NULL default `pending` | 検証段階 (`domain-state-machine.md`) |
| `certificate_status` | text NOT NULL default `none` | 証明書の状態 |
| `canonical` | boolean NOT NULL default false | 正規の住所として使うか |
| `external_hostname_id` | text NULL | Cloudflare 側の custom hostname id。写しの出どころ |
| `verification_token` | text NULL | DNS に置いてもらう検証用の値 |
| `synced_at` | timestamp NULL | 外部の状態を最後に写し取った時刻。null は未同期 |
| `last_error` | text NULL | 検証が失敗したときに運用者へ見せる理由 |
| `created_at` / `updated_at` | timestamp NOT NULL | |
| `deleted_at` | timestamp NULL | 論理削除 |

**既定住所はこの表に行を持たない。** 行が無いことが既定住所であり、独自ドメインは
常に追加である。既定住所を行にすると、その行を消したときにブログが読めなくなる経路ができる。

## 索引

```sql
-- 生きている住所は世界に 1 つ
UNIQUE (hostname) WHERE status <> 'revoked' AND deleted_at IS NULL
-- 正規の住所はブログごとに 1 つ
UNIQUE (workspace_id, site_slug) WHERE canonical = 1 AND status = 'active' AND deleted_at IS NULL
-- 一覧の引き方
INDEX (workspace_id, site_slug, status)
```

`revoked` と論理削除済みを除外するのは、取り下げた住所を**同じ行の復活ではなく新しい行
として登録し直す**ためである (遷移表で `revoked` を終端にしたことの帰結)。
除外しないと、一度取り下げたドメインを二度と登録できない。

canonical の一意制約は、読み取り側の `resolveCanonicalHost` (複数立っていたら既定住所へ倒す)
と**二重**になっている。片側だけだと「画面上は正常なのに検索エンジンへ送る正規化情報だけが
揺れる」状態を作れてしまう。

## 仕様書の列名との対応

要求ベースラインは planner 段階の名前で書かれている。実装の名前と次の対応にある。

| 要求側 | 実装 |
|---|---|
| `provider_hostname_id` | `external_hostname_id` |
| `verified_at` / `last_checked_at` | `synced_at` に 1 本化 |
| `cert_status` | `certificate_status` |
| `failure_reason` | `last_error` |

`verified_at` と `last_checked_at` を分けなかったのは、当方が持つのは**写しを取った時刻**
だけであり、「検証された時刻」は外部の事実だからである。2 列にすると、片方が外部由来・
片方が当方由来という混ざった意味を持つ。
