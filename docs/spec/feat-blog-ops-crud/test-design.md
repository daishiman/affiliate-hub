# テスト設計 (P04)

## 単体 (domain) — `tests/domain/blog-ops.test.ts`

| 対象 | 確かめること |
|---|---|
| `validateArticleSlug` | 空・大文字・記号を断る |
| `requiredBlocksFor(template)` | T1–T4 それぞれの必須部品列が docs/spec/13 §4 と一致する |
| `missingBlocks` | 必須部品が欠けたときだけ欠けたものを返す |
| `clampScore` / `isValidScore` | 1–5 の外を断る |
| `summarizeRatings` | 0 件のとき平均を 0 と言わず `null` を返す |
| `freshnessOf` | 更新日から鮮度区分 (`fresh` / `aging` / `stale`) を出す |
| `LAYOUT_SLOT_KEYS` / `DELIVERY_PARTS` | 数と id が docs/spec/13 §3/§6 と一致する |

## 単体 (application) — `tests/application/blog-ops-usecases.test.ts`

| 対象 | 確かめること |
|---|---|
| 作成 | 権限が無いと `FORBIDDEN`、あると作られて監査記録が 1 件出る |
| 更新 | 変わった項目名だけが返る。同じ値なら空 |
| 削除 | 理由が空だと断る。子節点があると断る |
| 評価送信 | 同じ `readerKey` の再送で件数が増えず、点数が置き換わる |
| 保存先の不調 | `UPSTREAM_UNAVAILABLE` になり、例外の中身が画面へ出ない |

## 契約 (architecture) — 既存ゲートに乗る

`pnpm verify` の既存検査 (依存方向・単一定義・テナント境界・Editorial 遮断・
監査発行・server action export) が新設ファイルにもそのまま掛かる。新しい検査は足さない。

## 転用禁止ゲート — `scripts/check-reference-site-reuse.mjs`

参考サイトの固有名・ドメイン・テーマ名・色値が
`docs/spec/feat-blog-ops-crud/**` / `src/**` / `drizzle/**` / `scripts/seed/local-seed-data.ts`
に 1 件も無いことを検査し、見つかったら exit 1。

## 画面 (手動) — P09 で axe-core を掛ける 6 画面

`/admin/site-network`, `/admin/blog/layout`, `/admin/blog/articles`,
`/admin/blog/pages`, `/admin/blog/tags`, `/admin/blog/evaluate`

## 実preview・実ブラウザ — Playwright

`tests/e2e/public-site-lifecycle.spec.ts` は desktop/mobile に別々のサイトをseedし、
`/s/{site}`、`/s/{site}/blog`、記事詳細、固定ページを実際に開く。
active で200、hidden/論理削除で404、復元後は同じURL・同じ内容で200を要求する。
復元ボタンはServer Actionのpending表示に変わった時点を完了扱いせず、公開4URLの200と期待本文を
pollして事後条件を待つ。各testの後処理も管理画面から復元・active化した後に同じ事後条件を待ち、
途中失敗やretryが次のprojectへ状態を残さない。
