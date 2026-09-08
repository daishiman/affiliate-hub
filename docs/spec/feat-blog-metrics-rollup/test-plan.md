# テスト計画 — 日次集計 (feat-blog-metrics-rollup)

P04 の成果物。何をどの層で確かめるかと、その割り当ての理由。

## 層ごとの分担

| 層 | ファイル | 確かめること |
|---|---|---|
| ドメイン | `tests/domain/` 配下（analytics） | 日付の線引き・示唆の足切り・率の計算 |
| アプリケーション | `tests/application/rebuild-daily-metrics.test.ts` | 再実行の入口の権限・冪等・記録 |
| アプリケーション | `tests/application/read-blog-metrics.test.ts` | 読み口 2 系統の分離（売上が編集側へ出ない） |
| アプリケーション | `tests/application/reader-interaction-intake.test.ts` | 受け口の検証と取りこぼし |
| 結合（実 D1） | `tests/integration/d1-reader-metrics.test.ts` | upsert の冪等・合算の不等号・保持期限 |
| 画面 | `tests/ui/blog-metrics-pages.test.tsx` | 数字が出る・解釈が伏せられる |
| アーキテクチャ | `tests/architecture/` 各種 | 層の依存方向・Worker の重さ・入口の申告 |

## 実 D1 に対して検証する必要があるもの

以下は模擬では確かめられないので `tests/integration/` で実 D1（miniflare）に当てる。

1. **upsert の冪等** — `ON CONFLICT DO UPDATE` の挙動は SQLite の実装依存。
   模擬の Map で置き換えても、本物が同じ振る舞いをする保証にならない。
2. **主キーの一意制約** — 重複行が「作れない」ことは DB が拒むことでしか示せない。
3. **`avg` が `NULL` を数えないこと** — F-04 の対処が効いていることは、
   実際の SQL エンジンで確かめないと意味がない。
4. **`db.batch()` の全部か無しか** — 部分適用が残らないこと（受入条件 8）。

## 意図的に検証しないもの

| 対象 | 理由 |
|---|---|
| cron の起動そのもの | Cloudflare 側の機能。こちらで再現しても Cloudflare が動く証明にならない |
| 報酬側の書き込み | feat-affiliate-hub の責務。ここでは「触らない」ことだけ確かめる |
| 画面の並び順 | feat-blog-scoped-admin-console の責務 |

## 受入条件との対応

| 受入条件 | どのテストが見るか |
|---|---|
| 1. 二度実行しても変わらない | 結合（実 D1 で 2 回 rollup して行と値を比較） |
| 2. 同日重複行が作れない | 結合（PK 違反を期待する） |
| 3. 記事の売上合計 ≤ ブログ | 結合（**不等号として**。理由は `metric-definitions.md`） |
| 4. 記事の PV 合計 ≤ ブログ | 同上 |
| 5. 90 日後も集計が残る | 結合（purge 後に集計行が残ることを確認） |
| 6. 指定日だけ置き換わる | アプリケーション + 結合（他の日の `computed_at` が変わらない） |
| 7. 件数不足の列が立つ | ドメイン（`evidenceVerdict`）+ 画面 |
| 8. 部分適用が残らない | 結合（batch の途中で失敗させ、1 行も書かれないことを確認） |
| 9. 失敗が運用から見える | 運用手順書に記述 + アプリケーション（`failed > 0` が失敗として返る） |

## 受入条件 9 の検証の限界（申告）

「日次実行が定時に起動し、失敗が運用側から見える」のうち、
**「定時に起動する」側はテストで確かめていない。**

Cloudflare の cron trigger が実際に発火することは、こちらのテストでは
再現できない。確かめられるのは「発火したら何が起きるか」までである。

起動の確認は運用側の手順（`operations-runbook.md`）に落とした。
