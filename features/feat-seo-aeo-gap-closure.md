---
graph_node_id: "feat-seo-aeo-gap-closure"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "backend"
tags: ["seo","aeo","structured-data","scheduling","audit-history"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "SEO/AEO の未実装差分を埋める"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T06:02:12.846812Z"
status: "active"
depends_on: ["feat-blog-ui-builder"]
related_nodes: []
resource_scope: ["src","docs/spec","system-spec"]
purpose: "SEO/AEO の仕組みのうち、確定済み decision に対して実装が追いついていない 3 点だけを埋め、「決めたが動いていない」状態を無くす"
goal: "手順記事と読み上げ向けの構造化データが記事から導出され、公開時点検の結果が履歴として残り、公開後の記事も定期に再点検されて陳腐化に気づける状態になっている"
scope_in: ["HowTo の JSON-LD 導出 (手順ブロックを持つ記事から。src/application/seo/structured-data.ts へ追加)","Speakable の JSON-LD 導出 (結論・要点ブロックを読み上げ対象として指定)","公開時点検 (auditArticleForAiSearch) の結果を履歴として保持する (dec-analysis-history-retention = append-with-window。追記のみ・保持窓を超えた分は落とす)","公開後の記事を定期に再点検する経路 (dec-aeo-analysis-trigger の scheduled 側。wrangler.jsonc の crons に対する scheduled handler と、再点検結果の履歴への追記)","再点検で新たに落ちた記事を管理画面で見つけられる一覧"]
scope_out: ["記事からの JSON-LD 導出そのもの (実装済み: src/application/seo/structured-data.ts。BlogPosting/FAQPage/BreadcrumbList/Person/Organization/WebPage/ItemList)","llms.txt・IndexNow・sitemap・RSS の生成 (実装済み: src/app/s/[site]/llms.txt/route.ts、src/domain/seo/indexnow.ts、src/application/seo/feeds.ts)","ガイドライン出典レジストリと 90 日の陳腐化判定 (実装済み: src/application/usecases/seo/manage-guideline-references.ts、src/domain/seo/guideline-reference.ts の review_due)","公開時点検の判定ロジックそのもの (実装済み: src/application/seo/ai-search-audit.ts、src/application/usecases/site/publish-article.ts に組込済)","記事本文の AI 生成 (feat-ai-content-studio)","クリック・成果のアトリビューション (feat-analytics-insight)","管理画面の単一用途画面再編 (feat-uiux-overhaul)","参考ブログ水準の読者導線・目次・サイドバー配置 (feat-reference-blog-admin-ux)"]
acceptance: ["手順ブロックを持つ記事の公開ページに HowTo の JSON-LD が出力され、手順を持たない記事には出力されない","結論・要点ブロックを持つ記事に Speakable の JSON-LD が出力される","公開のたびに点検結果が履歴へ追記され、保持窓を超えた古い分だけが落ちる","定期実行で公開済み記事が再点検され、結果が同じ履歴へ追記される","再点検で落ちた記事が管理画面の一覧に現れ、落ちた理由 (hint) が読める","既存の JSON-LD・llms.txt・IndexNow・出典レジストリ・公開時点検の挙動が変わらない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-seo-aeo-gap-closure.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"204c5f243190c0390fb314569247aed82722b6c22c1819780993421c77364646","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-seo-aeo-gap-closure/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"d31f307c93a74bb01f1263c0ab956cd3c8b09bb4caa23857531cd8a4c8f60df9","source_path":"system-spec/backend.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "撤回した feat-seo-aeo-machine-readable / feat-seo-aeo-analysis-feedback のうち、src/ への grep が 0 件だった 3 項目だけを残した差分 feature"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-seo-aeo-gap-closure.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-f60p","github_mirror":null,"linked_at":"2026-09-04T04:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-04T02:17:16Z","missing_sections":[],"status":"complete"}
---

# 目的

SEO/AEO の仕組みのうち、確定済み decision に対して実装が追いついていない 3 点だけを埋め、「決めたが動いていない」状態を無くす

## 到達状態

手順記事と読み上げ向けの構造化データが記事から導出され、公開時点検の結果が履歴として残り、公開後の記事も定期に再点検されて陳腐化に気づける状態になっている

## スコープ

### スコープ内

- HowTo の JSON-LD 導出 (手順ブロックを持つ記事から。src/application/seo/structured-data.ts へ追加)
- Speakable の JSON-LD 導出 (結論・要点ブロックを読み上げ対象として指定)
- 公開時点検 (auditArticleForAiSearch) の結果を履歴として保持する (dec-analysis-history-retention = append-with-window。追記のみ・保持窓を超えた分は落とす)
- 公開後の記事を定期に再点検する経路 (dec-aeo-analysis-trigger の scheduled 側。wrangler.jsonc の crons に対する scheduled handler と、再点検結果の履歴への追記)
- 再点検で新たに落ちた記事を管理画面で見つけられる一覧

### スコープ外

- 記事からの JSON-LD 導出そのもの (実装済み: src/application/seo/structured-data.ts。BlogPosting/FAQPage/BreadcrumbList/Person/Organization/WebPage/ItemList)
- llms.txt・IndexNow・sitemap・RSS の生成 (実装済み: src/app/s/[site]/llms.txt/route.ts、src/domain/seo/indexnow.ts、src/application/seo/feeds.ts)
- ガイドライン出典レジストリと 90 日の陳腐化判定 (実装済み: src/application/usecases/seo/manage-guideline-references.ts、src/domain/seo/guideline-reference.ts の review_due)
- 公開時点検の判定ロジックそのもの (実装済み: src/application/seo/ai-search-audit.ts、src/application/usecases/site/publish-article.ts に組込済)
- 記事本文の AI 生成 (feat-ai-content-studio)
- クリック・成果のアトリビューション (feat-analytics-insight)
- 管理画面の単一用途画面再編 (feat-uiux-overhaul)
- 参考ブログ水準の読者導線・目次・サイドバー配置 (feat-reference-blog-admin-ux)

## 受入

- [ ] 手順ブロックを持つ記事の公開ページに HowTo の JSON-LD が出力され、手順を持たない記事には出力されない
- [ ] 結論・要点ブロックを持つ記事に Speakable の JSON-LD が出力される
- [ ] 公開のたびに点検結果が履歴へ追記され、保持窓を超えた古い分だけが落ちる
- [ ] 定期実行で公開済み記事が再点検され、結果が同じ履歴へ追記される
- [ ] 再点検で落ちた記事が管理画面の一覧に現れ、落ちた理由 (hint) が読める
- [ ] 既存の JSON-LD・llms.txt・IndexNow・出典レジストリ・公開時点検の挙動が変わらない

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`, `arch-two-layer-platform`
- 仕様章: `architecture/system-spec-overview.md`, `architecture/arch-two-layer-platform.md`, `system-spec/index.md`, `system-spec/00-requirements-definition.md`, `system-spec/frontend.md`, `system-spec/ui-ux.md`, `system-spec/backend.md`, `system-spec/database.md`
- 仕様本文の正本は `system-spec/backend.md`。ここには複製しない。

## 機能間依存

- `depends_on`: `feat-blog-ui-builder`
- 依存理由: 本 feature は既存の SEO/AEO 実装 (JSON-LD 導出・出典レジストリ・公開時点検) の上に 3 点を足すだけで、その実装一式は feat-blog-ui-builder が持つ。

## 撤回した feature との関係

- `feat-seo-aeo-machine-readable` と `feat-seo-aeo-analysis-feedback` は 2026-09-04 に tombstone した。両者の scope_in の大半が実装済みだったため。
- 本 feature はその 2 つのうち、`src/` への grep が 0 件だった 3 項目だけを持つ。

## Handoff

- per-feature planning: `feat-blog-ui-builder` の完了後に `run-system-dev-plan` を起動する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-seo-aeo-gap-closure` と同一 `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)。
