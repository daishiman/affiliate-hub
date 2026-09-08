# 実装要件定義書: feat-blog-scoped-admin-console

> 本書は dev-graph `requirements` verb が、確定済み system spec、feature 文書、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:f2da12b065505697edafd0031dfd6d39001b2a702fb2e70f9c3704a1781bac6c`
- graph revision: `481`
- scope digest: `sha256:243f05cf690ec41c0874592b709e4ca68e505e9fe8e3d83211058fe47b48b108`
- feature package: `feature-package/feat-blog-scoped-admin-console`
- promoted generation digest: `sha256:853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-blog-scoped-admin-console/853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T00:00:00Z`

## この feature の位置

提示層。上流 3 層の結果を読むだけで、集計も診断も再実装しない。管理の単位を記事からブログへ移す最終段。

- 目的: 管理の単位を記事からブログへ移し、1 本のブログを運営するのに要る情報と操作を 1 つの階層へ集める
- 到達状態: /admin/sites/[site]/ 以下にブログ単位の画面 (記事・レイアウト・固定ページ・ドメイン・分析・SEO/AEO・配信) が揃い、ブログのダッシュボードが収益と PV と転換の推移と住所が生きているかを先頭に出し、横断画面はブログ間比較だけを担い、既存の /admin/blog/* から新階層へ転送される状態になっている

## 実装範囲

- /admin/sites/[site]/ を URL 階層としたブログ選択と、その配下の各画面
- ブログのダッシュボード: 収益・PV・転換の推移を先頭に、住所とドメイン状態の異常を最優先で掲出する
- 伸びている記事・落ちている記事の提示
- 記事画面へ滞在・到達・ヒートマップ・SEO/AEO の『この記事をどう直すか』を寄せる
- ブログ画面には SEO/AEO の『あと何件残っているか』だけを置く
- 横断画面はブログ間比較に限り、記事単位の数値を出さない
- 既存 /admin/blog/* から /admin/sites/[site]/ への転送
- ドメインが非 active、または証明書の期限が 21 日以内の行をブログ一覧とダッシュボードの先頭へ出す
- 既存の画面内お知らせ板を通知先として再利用する
- 根拠件数が閾値未満の示唆を出さない

## 範囲外

- 指標・診断・行動データを作ること自体 (各上流 feature)
- 権限モデルの新設 (既存 workspace 権限を使う)
- 読者面のデザイン (feat-blog-ui-builder / feat-reader-surface)
- ブログの作成・削除そのもの (feat-blog-ops-crud)

範囲外の項目は「やらない」ではなく「ここではやらない」を意味する。括弧内の feature が正本を持つ。

## 上流依存とアーキテクチャ文脈

| 種別 | node | 役割 |
|---|---|---|
| feature depends_on | `feat-blog-ops-crud` | 先に成立していることを前提にする |
| feature depends_on | `feat-blog-custom-domain` | 先に成立していることを前提にする |
| feature depends_on | `feat-blog-metrics-rollup` | 先に成立していることを前提にする |
| feature depends_on | `feat-reader-behavior-analytics` | 先に成立していることを前提にする |
| feature depends_on | `feat-seo-assessment-reflection` | 先に成立していることを前提にする |
| feature depends_on | `feat-aeo-answer-optimization` | 先に成立していることを前提にする |
| architecture_refs | `arch-system-spec-overview` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-two-layer-platform` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-blog-operations-console` | 境界と依存の向きの正本。本書は内容を複製せず参照する |

`arch-blog-operations-console` が固定する 4 層 (住所・観測・改善・提示) の一方向依存と、`site_slug` を唯一の結合キーとする規約は、本 feature の全 phase の前提である。

## 受入条件トレーサビリティ

| ID | 受入条件 | confirmed source | 主 phase |
|---|---|---|---|
| A1 | /admin/sites/[site]/ 配下に記事・レイアウト・固定ページ・ドメイン・分析・SEO/AEO・配信の各画面が存在する | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11,P13 |
| A2 | 既存の /admin/blog/* へのアクセスが対応する /admin/sites/[site]/ へ転送される | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P08,P11,P13 |
| A3 | ブログのダッシュボードの先頭が収益・PV・転換の推移と、住所が生きているかである | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A4 | ドメインが非 active または証明書期限 21 日以内のブログが、ブログ一覧の先頭に出る | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A5 | 記事ごとの滞在・到達・ヒートマップが記事画面にあり、ブログ画面には無い | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A6 | SEO/AEO の個別指摘が記事画面に、残数がブログ画面にある | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A7 | 横断画面に記事単位の数値が現れない | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A8 | 根拠件数が閾値未満のとき示唆が抑止され、その理由が画面に出る | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11,P12 |
| A9 | 通知が新しい仕組みを増やさず既存の画面内お知らせ板に出る | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P08,P11 |
| A10 | ブログを切り替えても同じ画面構成で、URL からどのブログを見ているかが判別できる | features/feat-blog-scoped-admin-console.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |

phase 対応は `.dev-graph/handoff/requirements-trace-feat-blog-scoped-admin-console.json` の `derivation_rule` に記した決定論規則で導出しており、`trace_plan_digest` で固定されている。

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P01` | ブログ単位管理画面の要求ベースライン確定 | — |
| P02 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P02` | 画面階層とデータ読み取り経路の設計確定 | P01 |
| P03 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P03` | 管理画面設計の独立レビューと着手可否判定 | P02 |
| P04 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P04` | 管理画面の受入テスト設計 | P03 |
| P05 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P05` | ブログ階層管理画面の実装 | P04 |
| P06 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P06` | 管理画面のテスト実行と緑化 | P05 |
| P07 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P07` | 管理画面の受入10件の判定 | P06 |
| P08 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P08` | 既存 admin 画面との重複解消と移行 | P05 |
| P09 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P09` | 管理画面の非機能検査 | P08 |
| P10 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P10` | 管理画面の最終レビュー | P09 |
| P11 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P11` | 管理画面の証跡集約 | P07, P09 |
| P12 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P12` | 管理画面の運用手順と読み方の説明 | P10, P11 |
| P13 | `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P13` | 管理画面のリリースと仕様書への書き戻し | P12 |

DAG は feature 内で閉じている。cross-feature edge は 0 件であり、feature 間の順序は graph の `depends_on` が持つ。

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-blog-scoped-admin-console` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `arch-blog-operations-console` | confirmed | pass | complete | なし |
| `SYS-BLOG-SCOPED-ADMIN-CONSOLE-P01..P13` | confirmed | pass | complete | なし |

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
- handoff package: `.dev-graph/handoff/task-graph/feat-blog-scoped-admin-console.json`
- readiness: `.dev-graph/handoff/requirements-readiness-feat-blog-scoped-admin-console.json`
- scope: `.dev-graph/handoff/requirements-scope-feat-blog-scoped-admin-console.json`
- trace: `.dev-graph/handoff/requirements-trace-feat-blog-scoped-admin-console.json`
- implementation code generated by this verb: `0`
