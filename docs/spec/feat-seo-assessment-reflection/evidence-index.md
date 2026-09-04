# 証跡の索引 — SEO の診断と反映 (feat-seo-assessment-reflection)

13 phase と文書・実装の対応表。

## Phase と文書

| phase | 文書 |
|---|---|
| P01 要件の確定 | `requirements-baseline.md` |
| P02 設計 | `assessment-catalog.md` / `data-model.md` / `writeback-constraints.md` / `writeback-design.md` / `validation-design.md` / `approval-path-diagram.md` |
| P03 設計の見直し | `design-review-findings.md` |
| P04 確かめ方 | `test-plan.md` / `test-cases.md` |
| P05 実行 | `test-run-report.md` |
| P06 品質ゲート | `quality-report.md` |
| P07 受入 | `acceptance-report.md` |
| P08 移行 | `migration-notes.md` |
| P09–P10 実装 | 下の実装一覧（コード自体が成果物） |
| P11 最終確認 | `final-review.md` |
| P12 運用 | `operations-runbook.md` |
| P13 引き渡し | `release-notes.md` / 本ファイル |

## 実装

| 層 | ファイル |
|---|---|
| 領域 | `src/domain/seo/assessment.ts` (157 行) |
| 領域 | `src/domain/seo/guideline-reference.ts` (238 行) |
| ポート | `src/application/ports/blog-improvement.ts` (83 行) |
| 応用 | `src/application/usecases/blog-ops/manage-seo-assessment.ts` (213 行) |
| 応用 | `src/application/seo/structured-data.ts` (295 行) |
| 応用 | `src/application/seo/feeds.ts` |
| 実体 | `src/infrastructure/improvement/article-seo-analyzer.ts` (317 行) |
| 実体 | `src/infrastructure/persistence/d1/seo-assessment-repository.ts` |
| 提示 | `src/presentation/site/json-ld-script.tsx` |
| 表 | `drizzle/0044_funny_groot.sql` の `article_seo_assessment` |

## テスト（100 件）

| ファイル | 件数 | プロジェクト |
|---|---|---|
| `tests/integration/d1-seo-assessment.test.ts` | 14 | worker-runtime |
| `tests/application/manage-blog-improvement.test.ts` | 19 | normal |
| `tests/domain/seo/guideline-reference.test.ts` | 14 | normal |
| `tests/application/seo/structured-data.test.ts` | 19 | normal |
| `tests/application/seo/feeds.test.ts` | 23 | normal |
| `tests/presentation/seo-route-handlers.test.ts` | 11 | normal |

## 判断が要る点（次に触る人へ）

### 1. 公開時の自動診断をどこに配線するか

`publish-article.ts` の中に入れると、
診断器が落ちた日に公開が止まる。

公開の**後**に別経路で回すべきだが、
その口をどう作るかは決まっていない。

### 2. 月次診断を分割するか

全記事を 1 回で回すと Workers の実行時間に当たりうる。
分割するなら「どこまで回したか」を持つ表が要る。

reader-behavior-analytics の `REBUILD_SCAN_LIMIT` が
同じ問題への 1 つの答えになっている。

### 3. 常に 0 件の観点をどう見せるか

`image-alt` / `canonical` を
「調べていない」と「問題なし」で区別できるかは提示層の責務。

管理画面側（`feat-blog-scoped-admin-console`）の宿題。

## 未達（隠していない）

`acceptance-report.md` に 10 件中 3 件の未達を明記した。

| # | 条件 | 状態 |
|---|---|---|
| 1 | 公開・更新のたびに診断 | 未達（配線なし） |
| 2 | 月次で全記事の診断更新 | 未達（scheduler なし） |
| 8 | クローラ拒否を robots.txt へ | 未達（設計として持たない） |

条件 8 は `feeds.test.ts` の
「遮断（Disallow）を 1 行も書かない」で固定してある。
