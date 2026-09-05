---
graph_node_id: "feat-blog-scoped-admin-console"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "ui-ux"
tags: ["admin","information-priority","site-scoped","dashboard","navigation"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "ブログ単位の管理コンソールへの再編"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T02:29:14.474337Z"
status: "active"
depends_on: ["feat-blog-ops-crud","feat-blog-custom-domain","feat-blog-metrics-rollup","feat-reader-behavior-analytics","feat-seo-assessment-reflection","feat-aeo-answer-optimization"]
related_nodes: ["spec-system-spec-index","arch-blog-operations-console","feat-blog-composition-visibility"]
resource_scope: ["src/app/admin/sites/[site]/","src/app/admin/blog/","src/app/admin/(cross)/","src/components/admin/","docs/spec/feat-uiux-overhaul/ui-rules.md","system-spec","features/feat-blog-scoped-admin-console.context.json"]
purpose: "管理の単位を記事からブログへ移し、1 本のブログを運営するのに要る情報と操作を 1 つの階層へ集める"
goal: "/admin/sites/[site]/ 以下にブログ単位の画面 (記事・レイアウト・固定ページ・ドメイン・分析・SEO/AEO・配信) が揃い、ブログのダッシュボードが収益と PV と転換の推移と住所が生きているかを先頭に出し、横断画面はブログ間比較だけを担い、既存の /admin/blog/* から新階層へ転送される状態になっている"
scope_in: ["/admin/sites/[site]/ を URL 階層としたブログ選択と、その配下の各画面","ブログのダッシュボード: 収益・PV・転換の推移を先頭に、住所とドメイン状態の異常を最優先で掲出する","伸びている記事・落ちている記事の提示","記事画面へ滞在・到達・ヒートマップ・SEO/AEO の『この記事をどう直すか』を寄せる","ブログ画面には SEO/AEO の『あと何件残っているか』だけを置く","横断画面はブログ間比較に限り、記事単位の数値を出さない","既存 /admin/blog/* から /admin/sites/[site]/ への転送","ドメインが非 active、または証明書の期限が 21 日以内の行をブログ一覧とダッシュボードの先頭へ出す","既存の画面内お知らせ板を通知先として再利用する","根拠件数が閾値未満の示唆を出さない"]
scope_out: ["指標・診断・行動データを作ること自体 (各上流 feature)","権限モデルの新設 (既存 workspace 権限を使う)","読者面のデザイン (feat-blog-ui-builder / feat-reader-surface)","ブログの作成・削除そのもの (feat-blog-ops-crud)"]
acceptance: ["/admin/sites/[site]/ 配下に記事・レイアウト・固定ページ・ドメイン・分析・SEO/AEO・配信の各画面が存在する","既存の /admin/blog/* へのアクセスが対応する /admin/sites/[site]/ へ転送される","ブログのダッシュボードの先頭が収益・PV・転換の推移と、住所が生きているかである","ドメインが非 active または証明書期限 21 日以内のブログが、ブログ一覧の先頭に出る","記事ごとの滞在・到達・ヒートマップが記事画面にあり、ブログ画面には無い","SEO/AEO の個別指摘が記事画面に、残数がブログ画面にある","横断画面に記事単位の数値が現れない","根拠件数が閾値未満のとき示唆が抑止され、その理由が画面に出る","通知が新しい仕組みを増やさず既存の画面内お知らせ板に出る","ブログを切り替えても同じ画面構成で、URL からどのブログを見ているかが判別できる"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-scoped-admin-console.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-scoped-admin-console/853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"bfd54655ae9a9f448eca91fcd6f57a9a30520bf4632c5f709f4ca504130cff7e","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定質疑 qa-frontend-web-blog-scoped-admin / qa-uiux-web-blog-scoped-admin / qa-ops-web-domain-retention-seo-freshness を lineage 参照。利用者要望『現在、管理画面ではブログ全体ではなく、記事ごとに管理する体制になっています。ブログごとに管理できるように』『現状、管理画面が全く整備されていないため、この点を改善してください』への対応"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-scoped-admin-console.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-wois","github_mirror":null,"linked_at":"2026-09-04T02:10:12Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

管理の単位を記事からブログへ移し、1 本のブログを運営するのに要る情報と操作を 1 つの階層へ集める

## 到達状態

/admin/sites/[site]/ 以下にブログ単位の画面 (記事・レイアウト・固定ページ・ドメイン・分析・SEO/AEO・配信) が揃い、ブログのダッシュボードが収益と PV と転換の推移と住所が生きているかを先頭に出し、横断画面はブログ間比較だけを担い、既存の /admin/blog/* から新階層へ転送される状態になっている

## スコープ

スコープ内:

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

スコープ外:

- 指標・診断・行動データを作ること自体 (各上流 feature)
- 権限モデルの新設 (既存 workspace 権限を使う)
- 読者面のデザイン (feat-blog-ui-builder / feat-reader-surface)
- ブログの作成・削除そのもの (feat-blog-ops-crud)

## 受入

- [ ] /admin/sites/[site]/ 配下に記事・レイアウト・固定ページ・ドメイン・分析・SEO/AEO・配信の各画面が存在する
- [ ] 既存の /admin/blog/* へのアクセスが対応する /admin/sites/[site]/ へ転送される
- [ ] ブログのダッシュボードの先頭が収益・PV・転換の推移と、住所が生きているかである
- [ ] ドメインが非 active または証明書期限 21 日以内のブログが、ブログ一覧の先頭に出る
- [ ] 記事ごとの滞在・到達・ヒートマップが記事画面にあり、ブログ画面には無い
- [ ] SEO/AEO の個別指摘が記事画面に、残数がブログ画面にある
- [ ] 横断画面に記事単位の数値が現れない
- [ ] 根拠件数が閾値未満のとき示唆が抑止され、その理由が画面に出る
- [ ] 通知が新しい仕組みを増やさず既存の画面内お知らせ板に出る
- [ ] ブログを切り替えても同じ画面構成で、URL からどのブログを見ているかが判別できる

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- `architecture_refs`: `arch-blog-operations-console`
- 関連ノード: `spec-system-spec-index`、`arch-blog-operations-console`、`feat-blog-composition-visibility`

## 機能間依存

- `depends_on`: `feat-blog-ops-crud`
- `depends_on`: `feat-blog-custom-domain`
- `depends_on`: `feat-blog-metrics-rollup`
- `depends_on`: `feat-reader-behavior-analytics`
- `depends_on`: `feat-seo-assessment-reflection`
- `depends_on`: `feat-aeo-answer-optimization`
- 依存理由: コンソールはブログ実体 (feat-blog-ops-crud) の上に、ドメイン状態・日次指標・行動分布・SEO/AEO 診断という 4 つの内容を並べ替えて見せる層であり、内容が先に無いと配置が決まらない。既存の画面分割方針 (feat-uiux-overhaul) は graph 未登録 (frontmatter が schema 違反) のため depends_on ではなく related_nodes で参照する。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-blog-scoped-admin-console` と repo-relative `--feature-context features/feat-blog-scoped-admin-console.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-blog-scoped-admin-console` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: URL 階層の再編・転送・ダッシュボードの情報優先度 (頻度 × 失敗コスト)・記事画面への集約・横断画面の縛り・異常の先頭掲出・示唆抑止を P01..P13 へ分解する。evidence は横断画面に記事単位の数値が出ないことを示すこと。
- 完了 rollup: exact 13 が全て done かつ受入 10 件を evidence が満たした場合だけ本 feature を done にする。
