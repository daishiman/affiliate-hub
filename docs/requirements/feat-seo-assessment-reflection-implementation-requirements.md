# 実装要件定義書: feat-seo-assessment-reflection

> 本書は dev-graph `requirements` verb が、確定済み system spec、feature 文書、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:f2da12b065505697edafd0031dfd6d39001b2a702fb2e70f9c3704a1781bac6c`
- graph revision: `481`
- scope digest: `sha256:95466416895b2d0d6d37c8e093f4e4eb7b8e3f019d08f4e5778822fdcf4235c1`
- feature package: `feature-package/feat-seo-assessment-reflection`
- promoted generation digest: `sha256:7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-seo-assessment-reflection/7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T00:00:00Z`

## この feature の位置

改善層 (検索)。検証可能な指摘だけを生成し、採用した推奨は下書きへ書き戻して既存の人間承認経路を必ず通す。

- 目的: 記事が検索から見つかる状態にあるかを機械的に診断し、その結果を人の承認を経てブログ本体へ戻せるようにする
- 到達状態: 公開・更新時と月次で article_seo_assessments が生成され、検証可能な指摘 (索引可能性・構造化データの妥当性・更新日の掲出・内部リンク・見出し構造) だけが提示され、採用した推奨は下書きへ書き戻されて既存の人間承認経路を必ず通る状態になっている

## 実装範囲

- article_seo_assessments テーブル (記事 × 診断日 × 指摘項目と重大度と根拠)
- assess-article-seo ユースケース: 公開・更新時および月次での再診断
- 索引可能性の検査 (robots / noindex / canonical / sitemap 収載)
- 構造化データ (BlogPosting/Article, Person, Organization, BreadcrumbList) の純関数による妥当性検証
- 最終更新日の掲出、見出し階層、内部リンクの検査
- sitemap.xml / RSS・Atom / robots.txt の生成と、ブログごとのクローラ許否設定
- apply-seo-recommendation ユースケース: 採用した推奨を下書きへ書き込み、既存の承認経路へ載せる
- 指針の出典を guideline-reference.ts の 90 日見直しに載せる

## 範囲外

- 検索順位そのものの保証や、ベンダー推定の数値目標
- 公開面を直接書き換える経路 (必ず下書き経由)
- AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization)
- 診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console)

範囲外の項目は「やらない」ではなく「ここではやらない」を意味する。括弧内の feature が正本を持つ。

## 上流依存とアーキテクチャ文脈

| 種別 | node | 役割 |
|---|---|---|
| feature depends_on | `feat-editorial-workflow` | 先に成立していることを前提にする |
| feature depends_on | `feat-reader-surface` | 先に成立していることを前提にする |
| feature depends_on | `feat-blog-ui-builder` | 先に成立していることを前提にする |
| architecture_refs | `arch-system-spec-overview` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-two-layer-platform` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-blog-operations-console` | 境界と依存の向きの正本。本書は内容を複製せず参照する |

`arch-blog-operations-console` が固定する 4 層 (住所・観測・改善・提示) の一方向依存と、`site_slug` を唯一の結合キーとする規約は、本 feature の全 phase の前提である。

## 受入条件トレーサビリティ

| ID | 受入条件 | confirmed source | 主 phase |
|---|---|---|---|
| A1 | 公開・更新のたびに当該記事の診断が生成される | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A2 | 月次で全公開記事の診断が更新される | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A3 | 構造化データの妥当性検証が純関数で、外部通信なしにテストできる | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A4 | 不正な構造化データが指摘として立ち、妥当なものは立たない | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A5 | 採用した推奨が下書きにだけ書かれ、公開面が承認なしに変わらない | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11,P13 |
| A6 | 採用後も既存の承認経路を通らずには公開されない | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P08,P11 |
| A7 | sitemap.xml と RSS/Atom が公開記事を漏れなく列挙する | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P02,P04,P05,P06,P07,P11,P13 |
| A8 | ブログごとにクローラを拒否でき、拒否したブログが robots.txt に反映される | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11,P13 |
| A9 | 検証できない指摘 (順位予測など) が受入条件にも画面にも現れない | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A10 | 指針の出典が 90 日見直しの対象として登録されている | features/feat-seo-assessment-reflection.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |

phase 対応は `.dev-graph/handoff/requirements-trace-feat-seo-assessment-reflection.json` の `derivation_rule` に記した決定論規則で導出しており、`trace_plan_digest` で固定されている。

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-SEO-ASSESSMENT-REFLECTION-P01` | SEO 診断と書き戻しの要求ベースライン確定 | — |
| P02 | `SYS-SEO-ASSESSMENT-REFLECTION-P02` | 診断テーブルと構造化データ検証の契約確定 | P01 |
| P03 | `SYS-SEO-ASSESSMENT-REFLECTION-P03` | SEO 診断設計の独立レビューと着手可否判定 | P02 |
| P04 | `SYS-SEO-ASSESSMENT-REFLECTION-P04` | SEO 診断の受入テスト設計 | P03 |
| P05 | `SYS-SEO-ASSESSMENT-REFLECTION-P05` | SEO 診断と推奨書き戻しの実装 | P04 |
| P06 | `SYS-SEO-ASSESSMENT-REFLECTION-P06` | SEO 診断のテスト実行と緑化 | P05 |
| P07 | `SYS-SEO-ASSESSMENT-REFLECTION-P07` | SEO 診断の受入10件の判定 | P06 |
| P08 | `SYS-SEO-ASSESSMENT-REFLECTION-P08` | 既存公開面生成経路との重複解消と移行 | P05 |
| P09 | `SYS-SEO-ASSESSMENT-REFLECTION-P09` | SEO 診断の非機能検査 | P08 |
| P10 | `SYS-SEO-ASSESSMENT-REFLECTION-P10` | SEO 診断の最終レビュー | P09 |
| P11 | `SYS-SEO-ASSESSMENT-REFLECTION-P11` | SEO 診断の証跡集約 | P07, P09 |
| P12 | `SYS-SEO-ASSESSMENT-REFLECTION-P12` | SEO 診断の運用手順と指針出典の説明 | P10, P11 |
| P13 | `SYS-SEO-ASSESSMENT-REFLECTION-P13` | SEO 診断のリリースと仕様書への書き戻し | P12 |

DAG は feature 内で閉じている。cross-feature edge は 0 件であり、feature 間の順序は graph の `depends_on` が持つ。

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-seo-assessment-reflection` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `arch-blog-operations-console` | confirmed | pass | complete | なし |
| `SYS-SEO-ASSESSMENT-REFLECTION-P01..P13` | confirmed | pass | complete | なし |

closure 17 node すべてが同一 graph snapshot 上で三 gate を通過している。`implementation_readiness=complete` は実行可能な仕様が揃ったことを示し、実装完了を示さない。完了は graph の `completion_evidence` と P07/P10/P11 の証跡で判定する。

## task-graph build への制約

- 実装前に、このリポジトリの `node_modules/next/dist/docs/` で対象 API の Next.js 16 現行ガイドを読む。訓練データの Next.js とは異なる。
- 既存の blog-ops、affiliate、auth、D1/Drizzle、Cloudflare Workers/OpenNext の境界を維持し、同じ責務の use case / store を増やさない。
- P04 のテストを先に定義し、pixel 位置や DOM 構造ではなく、可視ラベル、accessible name、状態、API 契約、永続化結果で検証する。
- 4 層の禁止依存 (観測層→改善層の直接呼び出し、改善層→公開面の直接書き込み、提示層での再集計、`site_slug` 以外のブログ識別子の定義) を実装で破らない。
- 本番公開、外部サービス契約変更、破壊的移行は別の明示承認がない限り行わない。
- 本書と handoff package は実装コードではない。各 task の write_scope と Verification and evidence を実装 authority とする。

## handoff

- target: `task-graph`
- handoff package: `.dev-graph/handoff/task-graph/feat-seo-assessment-reflection.json`
- readiness: `.dev-graph/handoff/requirements-readiness-feat-seo-assessment-reflection.json`
- scope: `.dev-graph/handoff/requirements-scope-feat-seo-assessment-reflection.json`
- trace: `.dev-graph/handoff/requirements-trace-feat-seo-assessment-reflection.json`
- implementation code generated by this verb: `0`
