# 証跡の索引 — 日次集計 (feat-blog-metrics-rollup)

P10 の成果物。13 phase それぞれが何を残したか。

## 文書

| phase | 文書 | 中身 |
|---|---|---|
| P01 | `requirements-baseline.md` | 受入条件 9 件、範囲、条件 3・4 の訂正申告 |
| P02 | `metric-definitions.md` | 列ごとの定義、改名の理由、合算の恒等式 |
| P02 | `data-model.md` | 表・PK・索引、`article_slug` を NOT NULL にした理由 |
| P02 | `input-mapping.md` | 生イベント → 集計列の SQL 対応表 |
| P02 | `missing-data-policy.md` | 3 つの「無い」の区別、0 除算の扱い |
| P02 | `idempotency-contract.md` | upsert を選んだ 2 つの理由、`set` の除外列 |
| P02 | `retention-independence.md` | 集計 → 掃除の順序固定、90 日 |
| P03 | `design-review-findings.md` | F-01〜F-11（重大 5 / 中 3 / 小 3） |
| P04 | `test-plan.md` | 層ごとの分担、実 D1 が要る 4 点、検証しないもの |
| P04 | `test-cases.md` | 実際のケース名（41 件） |
| P05 | `test-run-report.md` | 485 files / 10969 tests / exit 0 |
| P06 | `acceptance-report.md` | 受入条件 9 件の判定と根拠 |
| P07 | `migration-notes.md` | 0044 / 0045、戻し方、本番適用手順 |
| P08 | `quality-report.md` | ゲート 4 種の結果、port-wiring が赤である理由 |
| P09 | `final-review.md` | AD-1〜5 との照合、残っている弱点 4 件 |
| P10 | `evidence-index.md` | この文書 |
| P12 | `operations-runbook.md` | 定時実行、止まったときの気づき方、やり直し手順 |
| P13 | `release-notes.md` | 使えるようになったこと、既知の制限 |

## コード

| 層 | ファイル |
|---|---|
| ドメイン | `src/domain/analytics/reader-interaction.ts` |
| 口 | `src/application/ports/blog-observability.ts` |
| ユースケース | `src/application/usecases/blog-ops/rebuild-daily-metrics.ts` |
| 保存 | `src/infrastructure/persistence/d1/reader-metrics-repository.ts` |
| 定時実行 | `src/infrastructure/platform/reader-metrics-scheduler.ts` |
| 表定義 | `src/db/schema.ts`（`siteDailyMetrics` / `articleDailyMetrics`） |
| 画面の状態 | `src/presentation/admin/observe/metrics-rebuild-state.ts` |
| migration | `drizzle/0044_funny_groot.sql` / `drizzle/0045_keen_mysterio.sql` |
| 見本データ | `scripts/seed/blog-operations-seed.ts` |

## テスト

| ファイル | 件数 | 何を見るか |
|---|---|---|
| `tests/application/rebuild-daily-metrics.test.ts` | 18 | 権限・日の線引き・巻き込み防止・記録 |
| `tests/integration/d1-reader-metrics.test.ts` | 15 | 実 D1 での冪等・合算・保持期限 |
| `tests/application/read-blog-metrics.test.ts` | 10 | 読み口 2 系統の分離、0 除算 |
| `tests/application/reader-interaction-intake.test.ts` | 14 | 受け口の検証と取りこぼし |
| `tests/ui/blog-metrics-pages.test.tsx` | 15 | 数字が出る・解釈が伏せられる |

## 仕様と実装の食い違い（申告済み）

| 仕様の記述 | 実装 | どこに書いたか |
|---|---|---|
| `site_daily_metrics`（複数形） | `site_daily_metric` | `data-model.md` |
| `revenue_cents` | `revenue_minor` | `metric-definitions.md` |
| DELETE + INSERT | upsert | `idempotency-contract.md` / F-02 |
| 記事の合計が全体と**一致** | `≤`（不等号） | `requirements-baseline.md` / `metric-definitions.md` / F-01 |

## 赤のまま残っているもの

`node scripts/port-wiring.mjs` — 書き込み側の理由つき除外が
6 件（上限 5）。上限を上げていない。詳細は `quality-report.md`。
