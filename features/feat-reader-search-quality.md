---
graph_node_id: "feat-reader-search-quality"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "backend"
tags: ["search","fts5","d1","reader-surface","webmcp","progressive-enhancement"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "読者向け検索の実装深化 (D1 全文検索・日本語部分一致・JS 無効動作)"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-07T23:39:04.004309Z"
status: "active"
depends_on: ["feat-blog-composition-visibility","feat-webmcp-surface"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","system-spec"]
purpose: "読者が言葉から記事へ到達できるようにし、検索窓はあるのに index が無く実質使えない状態を解消する"
goal: "D1 上の全文検索索引が公開記事から自動で保たれ、日本語の部分一致でも妥当な順で結果が返り、検索結果面がサムネイル付きで表示され、JavaScript が無効でも検索が完了し、検索の入口が構造化データと llms.txt にも表れている状態になっている"
scope_in: ["D1 の全文検索索引 (FTS5 trigram) の設計と migration。published_articles を唯一の正本とし、作成・更新・削除・非公開化に索引が追従する","日本語の部分一致・表記ゆれへの対応と順位付け (一致位置・新しさ・カテゴリー一致の合成)","検索結果面: 件数・一致箇所の抜粋・サムネイル・カテゴリー・公開日・0 件時の代替提案 (カテゴリー / 人気記事)","二経路の入口: ヘッダーの検索起動と検索ページ。既存 SearchBox の method=get と searchArticles ユースケースを壊さず JavaScript 無効でも完走する","WebMCP 道具 searchArticles と画面の検索が同一ユースケースを通り、同じ結果を返すこと","検索ページの URL 契約 (query parameter 名と応答形) を定め、WebSite.potentialAction (SearchAction) と llms.txt がその契約を指していることの整合確認。JSON-LD の生成そのものは所有しない (観測 fact §5)","検索の負荷上限・ページング・長すぎる問い合わせの扱い"]
scope_out: ["全文検索の外部 SaaS 利用","AI による回答生成と対話 (feat-ai-assistant)","商品横断の比較検索 (feat-comparison-engine)","トップページ上の検索窓の配置と見た目、および WebSite/SearchAction/ItemList の JSON-LD 生成そのもの (feat-blog-top-page-composition が所有)","管理画面内の記事検索。読者向け公開面だけを対象とし、管理画面側の検索は本 feature の範囲外とする"]
acceptance: ["公開・更新・非公開化のいずれでも索引が追従し、非公開記事が結果に出ない","日本語の部分一致で結果が返り、無関係な語では 0 件が返る","検索結果にサムネイル・カテゴリー・公開日・一致箇所の抜粋が表示される","JavaScript を無効にした状態でも検索が完了する","画面の検索と WebMCP の searchArticles が同じ入力に対して同じ結果を返す","0 件のときカテゴリーまたは人気記事による代替の探し方が提示される","検索ページの URL 契約が固定され、トップページが宣言する SearchAction の target と一致することを機械検査できる","索引更新が公開処理の中で完結し、手動の再構築を必要としない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-reader-search-quality.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b55948e2e68707fa2a8b09dbfe1319c1b799fb956a2f6eaa4f667865b9534d5a","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-reader-search-quality/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"952d2fdb01272959ac2334c0752e3d1c9c6c8b2cdb96229ce03dbb601227bba6","source_path":"system-spec/backend.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者要望「検索も含める」を C14 macro 分解で 1 feature 化。SearchBox と searchArticles ユースケースは実在するが FTS5 索引が未実装であることを実地確認。system-spec/backend.md qa-neutral-search-method-v6 / qa-backend-web-site-search-llms-txt-v4b に接地"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-reader-search-quality.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-uglh","github_mirror":null,"linked_at":"2026-09-04T07:33:06Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

読者が言葉から記事へ到達できるようにし、検索窓はあるのに index が無く実質使えない状態を解消する

## 到達状態

D1 上の全文検索索引が公開記事から自動で保たれ、日本語の部分一致でも妥当な順で結果が返り、検索結果面がサムネイル付きで表示され、JavaScript が無効でも検索が完了し、検索の入口が構造化データと llms.txt にも表れている状態になっている

## スコープ

- スコープ内:
  - D1 の全文検索索引 (FTS5 trigram) の設計と migration。published_articles を唯一の正本とし、作成・更新・削除・非公開化に索引が追従する
  - 日本語の部分一致・表記ゆれへの対応と順位付け (一致位置・新しさ・カテゴリー一致の合成)
  - 検索結果面: 件数・一致箇所の抜粋・サムネイル・カテゴリー・公開日・0 件時の代替提案 (カテゴリー / 人気記事)
  - 二経路の入口: ヘッダーの検索起動と検索ページ。既存 SearchBox の method=get と searchArticles ユースケースを壊さず JavaScript 無効でも完走する
  - WebMCP 道具 searchArticles と画面の検索が同一ユースケースを通り、同じ結果を返すこと
  - 検索ページの URL 契約 (query parameter 名と応答形) を定め、WebSite.potentialAction (SearchAction) と llms.txt がその契約を指していることの整合確認。JSON-LD の生成そのものは所有しない (観測 fact §5)
  - 検索の負荷上限・ページング・長すぎる問い合わせの扱い
- スコープ外:
  - 全文検索の外部 SaaS 利用
  - AI による回答生成と対話 (feat-ai-assistant)
  - 商品横断の比較検索 (feat-comparison-engine)
  - トップページ上の検索窓の配置と見た目、および WebSite/SearchAction/ItemList の JSON-LD 生成そのもの (feat-blog-top-page-composition が所有)
  - 管理画面内の記事検索。読者向け公開面だけを対象とし、管理画面側の検索は本 feature の範囲外とする

## 受入

- [ ] 公開・更新・非公開化のいずれでも索引が追従し、非公開記事が結果に出ない
- [ ] 日本語の部分一致で結果が返り、無関係な語では 0 件が返る
- [ ] 検索結果にサムネイル・カテゴリー・公開日・一致箇所の抜粋が表示される
- [ ] JavaScript を無効にした状態でも検索が完了する
- [ ] 画面の検索と WebMCP の searchArticles が同じ入力に対して同じ結果を返す
- [ ] 0 件のときカテゴリーまたは人気記事による代替の探し方が提示される
- [ ] 検索ページの URL 契約が固定され、トップページが宣言する SearchAction の target と一致することを機械検査できる
- [ ] 索引更新が公開処理の中で完結し、手動の再構築を必要としない

## 受入正本レジストリ

- canonical source: `features/feat-reader-search-quality.md#frontmatter.acceptance`
- planner projection: `features/feat-reader-search-quality.context.json#/acceptance`
- ID mapping: 配列の 1 始まり順番を `A1` 〜 `A8` に対応させる

受入の文言は frontmatter にのみ保持する。実装要件・タスク仕様書・証跡は canonical ID を参照し、
同じ ID に別の文言を与えない。件数を本文へ書き写さないのは、文言が二箇所で分裂するのを防ぐためである。

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 検索は読者面の入口であり、同時に WebMCP 道具として運営者面・エージェント面からも呼ばれる。二層境界を越えて同一ユースケースを通す制約を arch-two-layer-platform に接地させる。仕様本文は system-spec/backend.md の確定章を lineage 参照し複製しない

## 機能間依存

- `depends_on`: feat-blog-composition-visibility, feat-webmcp-surface
- 依存理由:
  - feat-blog-composition-visibility: published_articles を唯一の公開正本とする投影が先に確立していないと、索引が別経路を数え直して読者面とずれる
  - feat-webmcp-surface: 画面の検索と WebMCP 道具が同一ユースケースを通る制約は WebMCP 側の Adapter 分離が前提になる

## Handoff

- per-feature planning: ready 到達後に system-dev-planner (`run-system-dev-plan`) を
  `--feature-id feat-reader-search-quality` と `--feature-context features/feat-reader-search-quality.context.json` で起動する。
  人間の手動 `/system-dev-plan` 実行結果も同じ登録経路 (C02 `register-package`) で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node の intra-feature DAG
- 登録先: 全 task を `parent_feature=feat-reader-search-quality` と共通 `feature_package_id` で C02 経由 atomic 登録する。expected/applied=13 を必須とする
- 完了 rollup: exact 13 が全て done で、かつ P07/P10/P11 の evidence が上記受入を満たす場合だけ feature を done にする
