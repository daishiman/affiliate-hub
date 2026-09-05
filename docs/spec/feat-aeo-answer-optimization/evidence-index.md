# 証跡の索引 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P13 の成果物。13 phase と文書・実装・テストの対応。

## phase と文書

| phase | 文書 |
|---|---|
| P01 要件 | `requirements-baseline.md` |
| P02 設計 | `answer-unit-catalog.md` / `data-model.md` / `structured-data-design.md` / `crawler-policy.md` / `delivery-design.md` / `delivery-path-diagram.md` / `author-profile-design.md` / `citation-ledger-design.md` |
| P03 設計レビュー | `design-review-findings.md` |
| P04 テスト計画 | `test-plan.md` |
| P05 テスト設計 | `test-cases.md` |
| P06 テスト実行 | `test-run-report.md` |
| P07 品質ゲート | `quality-report.md` |
| P08 受入 | `acceptance-report.md` |
| P09 移行 | `migration-notes.md` |
| P10 運用 | `operations-runbook.md` |
| P11 最終確認 | `final-review.md` |
| P12 リリース | `release-notes.md` |
| P13 証跡 | `evidence-index.md`（この文書） |

## 実装

| ファイル | 役割 |
|---|---|
| `src/domain/aeo/answer-unit.ts` | 型・種類・隙間・`validateAnswerUnit` / `detectGaps` |
| `src/infrastructure/improvement/answer-unit-extractor.ts` | 記事から 6 か所を切り出す |
| `src/infrastructure/persistence/d1/seo-assessment-repository.ts` | `AnswerUnitPort` / `SiteAeoProfilePort` |
| `src/application/usecases/blog-ops/manage-aeo-answers.ts` | 権限・隙間の集計・監査 |
| `src/application/seo/structured-data.ts` | `buildFaqPage` / `buildPerson` / `citation` |
| `src/application/seo/feeds.ts` | `buildRobotsTxt` / `buildLlmsTxt` / sitemap / RSS |
| `src/app/s/[site]/llms.txt/route.ts` | `llms.txt` の入口 |
| `src/app/admin/sites/[site]/aeo/page.tsx` | 管理画面 |
| `src/presentation/composition.ts:2197` | 配線 |
| `drizzle/0044_funny_groot.sql` | 2 表 + 索引 2 本 |

## テスト

| ファイル | 件数 | プロジェクト |
|---|---|---|
| `tests/integration/d1-seo-assessment.test.ts` | 14 | worker-runtime |
| `tests/application/manage-blog-improvement.test.ts` | — | normal |
| `tests/application/seo/feeds.test.ts` | 23 | normal |
| `tests/application/seo/structured-data.test.ts` | 19 | normal |
| `tests/presentation/seo-route-handlers.test.ts` | 11 | normal |
| `tests/application/blog-delivery-check.test.ts` | 9 | normal |
| `tests/acceptance/feat-blog-ui-builder/machine-feeds.test.ts` | 12 | normal |
| `tests/ui/article-faq.test.tsx` | 4 | normal |
| **合計** | **113** | |

（normal は 2 回に分けて実行。81 + 18 = 99。worker-runtime 14。）

## 判断が要る点

実装を読む人が迷いやすい 3 か所。

### 1. FAQ の `positionRatio` が 0

記事の後ろに描かれるのに 0 を入れている。

**構造化データとして単体で名指しできる塊**は
本文の奥の段落と事情が違う、という判断。

`answer-unit-extractor.ts` にコメントがある。

### 2. `detectGaps` が 4 種しか返さない

一覧は 6 種。残る 2 種は単位からは判定できない。

「実装漏れ」ではなく**責務の置き場所が違う**。
`acceptance-report.md` で受入条件 2 を「一部」と申告した。

### 3. `article_answer_unit` と `FAQPage` の二重生成

同じ FAQ から 2 つの写しを作っている。

AD-3（改善層は公開面へ書けない）の帰結で、意図的。
`delivery-path-diagram.md` に理由を書いた。

## 未達・未対応

| # | 内容 | 記録先 |
|---|---|---|
| 1 | 引用されたかを測らない | `requirements-baseline.md`（作らないもの）/ F-01 |
| 2 | 隙間 2 種を誰も出さない | `acceptance-report.md`（条件 2 一部）/ F-03 |
| 3 | 抽出が自動で回らない | `operations-runbook.md` / F-06 |
| 4 | 出典が消えた履歴が無い | `citation-ledger-design.md` / F-04 |
| 5 | 空の構えを保存できる | F-09 |
| 6 | port-wiring 赤（隣の feature 由来） | `quality-report.md` |

## 参照する他 feature

- `feat-seo-assessment-reflection` — 同じ改善層。診断側。
  `docs/spec/feat-seo-assessment-reflection/validation-design.md` に
  指針の出典（`guideline-reference.ts`）の扱いがある。
- `feat-blog-custom-domain` — `canonicalSiteUrl` の住所を提供する。
- `arch-blog-operations-console.md` — AD-1〜5 の正本。
