# 証跡の索引 — 読者行動の観測 (feat-reader-behavior-analytics)

P13 の成果物。どの phase が何を残したか。

## Phase と文書

| Phase | 文書 |
|---|---|
| P01 要件の確定 | `requirements-baseline.md` |
| P01 制約の確定 | `privacy-constraints.md` |
| P02 何を測るか | `measurement-inventory.md` |
| P02 表の設計 | `data-model.md` |
| P02 受け口の契約 | `ingest-contract.md` |
| P02 分布の作り方 | `aggregation-design.md` |
| P02 本人の請求 | `subject-request-design.md` |
| P02 崩れてはいけないこと | `invariant-checklist.md` |
| P03 設計レビュー | `design-review-findings.md` |
| P05 テスト方針 | `test-plan.md` |
| P06 テストケース | `test-cases.md` |
| P07 実行結果 | `test-run-report.md` |
| P08 受入判定 | `acceptance-report.md` |
| P09 表の変更 | `migration-notes.md` |
| P10 品質ゲート | `quality-report.md` |
| P12 最終確認 | `final-review.md` |
| P13 運用手順 | `operations-runbook.md` |
| P13 機能説明 | `release-notes.md` |
| P13 索引 | この文書 |

## 実装

| 層 | ファイル |
|---|---|
| 送信側 | `src/presentation/reader/behavior-probe.tsx` |
| 受け口（HTTP） | `src/app/api/reader-events/route.ts` |
| 受け口（判断） | `src/application/usecases/blog-ops/record-reader-interactions.ts` |
| 読み口 | `src/application/usecases/blog-ops/read-blog-audience.ts` |
| 口の定義 | `src/application/ports/blog-observability.ts` |
| 同意の規則 | `src/domain/analytics/consent.ts` |
| 保存先 | `src/infrastructure/persistence/d1/reader-metrics-repository.ts` |
| 見本データ | `src/infrastructure/persistence/sample/reader-interaction-sample.ts` |
| 定時起動 | `src/infrastructure/platform/reader-metrics-scheduler.ts` |
| 画面 | `src/app/admin/sites/[site]/audience/page.tsx` |
| 配線 | `src/presentation/composition.ts` |

## テスト

| ファイル | 件数 |
|---|---|
| `tests/ui/reader-behavior-probe.test.tsx` | 13 |
| `tests/application/reader-interaction-intake.test.ts` | 14 |
| `tests/integration/d1-reader-metrics.test.ts` | 15 |
| `tests/ui/blog-metrics-pages.test.tsx` | 14 |

## 表

| migration | 内容 |
|---|---|
| `drizzle/0044_funny_groot.sql` | `reader_interaction_event` ほか 3 表 |
| `drizzle/0045_keen_mysterio.sql` | 集計側へ `sample_count` |

## 上位文書

| 文書 | 参照するもの |
|---|---|
| `architecture/arch-blog-operations-console.md` | AD-1〜AD-5、§12.3 の口の分離 |
| `docs/product/port-wiring.md` | 受け口を除外に置いた理由 |
| `features/feat-reader-behavior-analytics.md` | 受入条件 10 件 |

## 隣の feature との関係

| feature | 関係 |
|---|---|
| feat-blog-metrics-rollup | 集計表を所有する。本 feature はその**書き手** |
| feat-blog-custom-domain | `site_slug` の住所を作る（AD-5） |
| feat-blog-scoped-admin-console | 画面の入口を持つ |

## 判断が要る点として残したもの

| # | 内容 | 場所 |
|---|---|---|
| 1 | 本人の請求に応える受け口を持たない整理が、法域によって通らない可能性 | `subject-request-design.md` |
| 2 | port-wiring の上限をどう扱うか | `quality-report.md` |
| 3 | 実ブラウザでの到達率が未検証 | `final-review.md` |
