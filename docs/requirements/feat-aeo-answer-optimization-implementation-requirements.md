# 実装要件定義書: feat-aeo-answer-optimization

> 本書は dev-graph `requirements` verb が、確定済み system spec、feature 文書、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:f2da12b065505697edafd0031dfd6d39001b2a702fb2e70f9c3704a1781bac6c`
- graph revision: `481`
- scope digest: `sha256:630f8738db5bec184444d3f972e2d21a6437933e5555652a23a794c63a0a056f`
- feature package: `feature-package/feat-aeo-answer-optimization`
- promoted generation digest: `sha256:28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-aeo-answer-optimization/28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T00:00:00Z`

## この feature の位置

改善層 (回答エンジン)。記事に結論・要点・比較表・FAQ・出典・最終更新日という回答単位を持たせ、引用可能な形で配信する。

- 目的: AI の回答エンジンが記事から答えを取り出して引用できる形へ、記事とブログの表現を整える
- 到達状態: 記事が結論・要点・比較表・FAQ・出典・最終更新日という回答単位を持ち、article_answer_units と site_aeo_profiles として管理され、llms.txt とブログごとのクローラ方針が配信され、AI 検索での引用状況を定点で記録できる状態になっている

## 実装範囲

- site_aeo_profiles / article_answer_units テーブル (ブログの回答方針と、記事内の回答単位)
- 記事テンプレートの回答単位: 結論ブロック / 要点リスト / 比較表 / FAQ ブロック / 出典ブロック / 最終更新日
- FAQPage / HowTo / Product・Review の構造化データ生成 (妥当性は SEO 側の純関数を共有する)
- 著者プロフィール面と Person/Organization の紐付け (E-E-A-T)
- llms.txt の配信と、ブログごとの AI クローラ許否 (既定は許可、拒否リストで個別に落とす)
- AI 検索での引用有無を定点で記録し、期間比較できる観測台帳
- AEO 出力を既存の公開面生成経路へ載せる (別経路を新設しない)

## 範囲外

- 特定の AI 検索サービスでの露出保証や順位保証
- 索引可能性・sitemap・一般的な構造化データ検査 (feat-seo-assessment-reflection)
- 回答単位の本文そのものを自動生成して無承認で公開すること
- 残数・優先度の提示順序 (feat-blog-scoped-admin-console)

範囲外の項目は「やらない」ではなく「ここではやらない」を意味する。括弧内の feature が正本を持つ。

## 上流依存とアーキテクチャ文脈

| 種別 | node | 役割 |
|---|---|---|
| feature depends_on | `feat-seo-assessment-reflection` | 先に成立していることを前提にする |
| feature depends_on | `feat-blog-ui-builder` | 先に成立していることを前提にする |
| feature depends_on | `feat-reader-surface` | 先に成立していることを前提にする |
| architecture_refs | `arch-system-spec-overview` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-two-layer-platform` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-blog-operations-console` | 境界と依存の向きの正本。本書は内容を複製せず参照する |

`arch-blog-operations-console` が固定する 4 層 (住所・観測・改善・提示) の一方向依存と、`site_slug` を唯一の結合キーとする規約は、本 feature の全 phase の前提である。

## 受入条件トレーサビリティ

| ID | 受入条件 | confirmed source | 主 phase |
|---|---|---|---|
| A1 | 記事に結論・要点・FAQ・出典・最終更新日の回答単位が構造として存在し、欠落が機械的に検出される | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A2 | FAQ ブロックがある記事の FAQPage 構造化データが妥当性検証を通る | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A3 | llms.txt が配信され、ブログごとの方針が反映される | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11,P13 |
| A4 | AI クローラを拒否したブログで robots.txt の該当 user-agent が拒否になる | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11,P13 |
| A5 | 既定 (拒否設定なし) では AI クローラが許可される | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A6 | 著者プロフィール面が存在し、記事から Person として辿れる | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A7 | AEO 出力が既存の公開面生成経路を通り、別系統の配信路が増えない | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P08,P11,P13 |
| A8 | 引用状況の観測が日付付きで残り、前後期間で比較できる | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A9 | 回答単位の本文が下書き経由でしか公開面へ入らない | features/feat-aeo-answer-optimization.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11,P13 |

phase 対応は `.dev-graph/handoff/requirements-trace-feat-aeo-answer-optimization.json` の `derivation_rule` に記した決定論規則で導出しており、`trace_plan_digest` で固定されている。

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-AEO-ANSWER-OPTIMIZATION-P01` | 回答単位と AI クローラ方針の要求ベースライン確定 | — |
| P02 | `SYS-AEO-ANSWER-OPTIMIZATION-P02` | 回答単位テーブルと配信契約の確定 | P01 |
| P03 | `SYS-AEO-ANSWER-OPTIMIZATION-P03` | AEO 設計の独立レビューと着手可否判定 | P02 |
| P04 | `SYS-AEO-ANSWER-OPTIMIZATION-P04` | AEO の受入テスト設計 | P03 |
| P05 | `SYS-AEO-ANSWER-OPTIMIZATION-P05` | 回答単位と AI 向け配信の実装 | P04 |
| P06 | `SYS-AEO-ANSWER-OPTIMIZATION-P06` | AEO のテスト実行と緑化 | P05 |
| P07 | `SYS-AEO-ANSWER-OPTIMIZATION-P07` | AEO の受入9件の判定 | P06 |
| P08 | `SYS-AEO-ANSWER-OPTIMIZATION-P08` | SEO 側構造化データ経路との重複解消と移行 | P05 |
| P09 | `SYS-AEO-ANSWER-OPTIMIZATION-P09` | AEO の非機能検査 | P08 |
| P10 | `SYS-AEO-ANSWER-OPTIMIZATION-P10` | AEO の最終レビュー | P09 |
| P11 | `SYS-AEO-ANSWER-OPTIMIZATION-P11` | AEO の証跡集約 | P07, P09 |
| P12 | `SYS-AEO-ANSWER-OPTIMIZATION-P12` | AEO の運用手順と回答単位の書き方の説明 | P10, P11 |
| P13 | `SYS-AEO-ANSWER-OPTIMIZATION-P13` | AEO のリリースと仕様書への書き戻し | P12 |

DAG は feature 内で閉じている。cross-feature edge は 0 件であり、feature 間の順序は graph の `depends_on` が持つ。

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-aeo-answer-optimization` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `arch-blog-operations-console` | confirmed | pass | complete | なし |
| `SYS-AEO-ANSWER-OPTIMIZATION-P01..P13` | confirmed | pass | complete | なし |

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
- handoff package: `.dev-graph/handoff/task-graph/feat-aeo-answer-optimization.json`
- readiness: `.dev-graph/handoff/requirements-readiness-feat-aeo-answer-optimization.json`
- scope: `.dev-graph/handoff/requirements-scope-feat-aeo-answer-optimization.json`
- trace: `.dev-graph/handoff/requirements-trace-feat-aeo-answer-optimization.json`
- implementation code generated by this verb: `0`
