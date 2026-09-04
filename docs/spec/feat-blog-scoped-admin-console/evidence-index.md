# 証跡の索引 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P13 の成果物。13 phase と文書・実装・テストの対応。

## phase と文書

| phase | 文書 |
|---|---|
| P01 要件 | `requirements-baseline.md` |
| P02 設計 | `routing-design.md` / `screen-responsibility-map.md` / `read-path-design.md` / `navigation-inventory.md` / `alerting-design.md` |
| P03 設計レビュー | `design-review-findings.md` / `dependency-direction-check.md` |
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

**18 件。**

## 実装

| ファイル | 役割 |
|---|---|
| `src/presentation/ui/admin-route-metadata.ts` | route 93 件の正本（nav 21 / child 70） |
| `src/presentation/admin/admin-screen-task-manifest.ts` | 目的・分類・runtime edge |
| `src/app/admin/sites/page.tsx` | ブログの一覧（143 行） |
| `src/app/admin/sites/[site]/page.tsx` | 設計図・入口 11 本・削除（465 行） |
| `src/app/admin/sites/[site]/domains/page.tsx` | 住所層（153 行） |
| `src/app/admin/sites/[site]/audience/page.tsx` | 観測層 `Editorial`（304 行） |
| `src/app/admin/sites/[site]/revenue/page.tsx` | 観測層 `Commercial`（186 行） |
| `src/app/admin/sites/[site]/seo/page.tsx` | 改善層（105 行） |
| `src/app/admin/sites/[site]/aeo/page.tsx` | 改善層（137 行） |
| `docs/spec/feat-uiux-overhaul/information-priority-map.json` | 情報の優先度 |

**DB 移行なし。新規ユースケースなし。**

## テスト

| ファイル | 件数 | project |
|---|---|---|
| `tests/ui/app-shell-nav.test.tsx` | 10 | normal |
| `tests/ui/uiux-screen-single-purpose.test.ts` | 99 | normal |
| `tests/ui/uiux-spacing-and-copy.test.ts` | 203 | normal |
| `tests/ui/blog-ops-console-forms.test.tsx` | 13 | normal |
| `tests/ui/blog-metrics-pages.test.tsx` | 18 | **a11y** |
| `tests/ui/blog-ops-a11y-floor.test.tsx` | 7 | **a11y** |
| **合計** | **350** | |

同じ `tests/ui/` でも project が分かれる。
`--project` を間違えると 0 件で緑になる
（`test-run-report.md` に実測表）。

## 判断が要る点

読む人が迷いやすい 3 か所。

### 1. `sites/[site]` の `label` が `null`

```ts
"sites/[site]": child("sites", null),
```

**実行時にブログ名を入れるという意味。**

固定文字列を置くとパンくずが
「サイト > サイト > 住所」になる。

### 2. 子 route が `requires` を持たない

権限の判定はユースケース側の 1 か所。

ナビから消えるのは親だけで、
子は URL で開けて、開いた先で断られる。

**2 か所に書くと片方だけ直した状態が作れる。**

### 3. `actions` の 11 本が手書き

自動生成していない。
並び順を運営者の作業順に合わせるため。

`足したら同時にここへ出す` のコメントが唯一の防御。

## 未達・未対応

| # | 内容 | 記録先 |
|---|---|---|
| 1 | `actions` の足し忘れを機械が検出しない | F-01 / `acceptance-report.md` 条件 3 |
| 2 | `Callout` の数え方が正規表現 | F-02 |
| 3 | `sites/[site]` の節が 5 つで説明文に収まらない | F-03 |
| 4 | 削除が読むだけの画面の末尾にある | F-04 |
| 5 | `sites` 一覧に数字が無い | F-07 |
| 6 | `revenue` に幅の絞り込みが無い | F-08 |
| 7 | `required-test-types` が上限ちょうど（5/5） | `quality-report.md` |
| 8 | `port-wiring` が赤（隣 feature 由来） | `quality-report.md` |

## 参照する他 feature

| feature | 何を提供するか |
|---|---|
| `feat-blog-custom-domain` | `domains` 画面と住所層 |
| `feat-reader-behavior-analytics` | `audience` 画面と生イベント |
| `feat-blog-metrics-rollup` | `revenue` 画面と日次集計 |
| `feat-seo-assessment-reflection` | `seo` 画面と診断 |
| `feat-aeo-answer-optimization` | `aeo` 画面と回答単位 |
| `feat-uiux-overhaul` | 上限・情報の優先度・1 画面 1 目的 |

**この feature は 5 つの入口を住所の階層へ並べる役。**

中身はそれぞれの feature が持つ。

## 正本

- `architecture/arch-blog-operations-console.md` — AD-1〜5 と §12.3
- `src/presentation/ui/admin-route-metadata.ts` — route
- `src/presentation/admin/admin-screen-task-manifest.ts` — 目的
