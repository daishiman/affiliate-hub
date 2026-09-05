---
graph_node_id: "feat-seo-assessment-reflection"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "backend"
tags: ["seo","assessment","structured-data","recommendation","draft-writeback"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "記事の SEO 診断と下書きへの反映"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T02:30:02.398664Z"
status: "active"
depends_on: ["feat-editorial-workflow","feat-reader-surface","feat-blog-ui-builder"]
related_nodes: ["spec-system-spec-index","feat-aeo-answer-optimization","feat-blog-scoped-admin-console"]
resource_scope: ["src/db/schema.ts","src/domain/seo/","src/domain/seo/guideline-reference.ts","src/application/seo/assess-article-seo.ts","src/application/seo/apply-seo-recommendation.ts","src/app/admin/sites/[site]/articles/[article]/seo/","system-spec","features/feat-seo-assessment-reflection.context.json"]
purpose: "記事が検索から見つかる状態にあるかを機械的に診断し、その結果を人の承認を経てブログ本体へ戻せるようにする"
goal: "公開・更新時と月次で article_seo_assessments が生成され、検証可能な指摘 (索引可能性・構造化データの妥当性・更新日の掲出・内部リンク・見出し構造) だけが提示され、採用した推奨は下書きへ書き戻されて既存の人間承認経路を必ず通る状態になっている"
scope_in: ["article_seo_assessments テーブル (記事 × 診断日 × 指摘項目と重大度と根拠)","assess-article-seo ユースケース: 公開・更新時および月次での再診断","索引可能性の検査 (robots / noindex / canonical / sitemap 収載)","構造化データ (BlogPosting/Article, Person, Organization, BreadcrumbList) の純関数による妥当性検証","最終更新日の掲出、見出し階層、内部リンクの検査","sitemap.xml / RSS・Atom / robots.txt の生成と、ブログごとのクローラ許否設定","apply-seo-recommendation ユースケース: 採用した推奨を下書きへ書き込み、既存の承認経路へ載せる","指針の出典を guideline-reference.ts の 90 日見直しに載せる"]
scope_out: ["検索順位そのものの保証や、ベンダー推定の数値目標","公開面を直接書き換える経路 (必ず下書き経由)","AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization)","診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console)"]
acceptance: ["公開・更新のたびに当該記事の診断が生成される","月次で全公開記事の診断が更新される","構造化データの妥当性検証が純関数で、外部通信なしにテストできる","不正な構造化データが指摘として立ち、妥当なものは立たない","採用した推奨が下書きにだけ書かれ、公開面が承認なしに変わらない","採用後も既存の承認経路を通らずには公開されない","sitemap.xml と RSS/Atom が公開記事を漏れなく列挙する","ブログごとにクローラを拒否でき、拒否したブログが robots.txt に反映される","検証できない指摘 (順位予測など) が受入条件にも画面にも現れない","指針の出典が 90 日見直しの対象として登録されている"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-seo-assessment-reflection.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-seo-assessment-reflection/7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"bfd54655ae9a9f448eca91fcd6f57a9a30520bf4632c5f709f4ca504130cff7e","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定質疑 qa-frontend-web-seo-ai-search / qa-uiux-web-seo-ai-search / qa-backend-web-domain-aeo-behavior / qa-ops-web-domain-retention-seo-freshness を lineage 参照。利用者要望『SEO対策ができるように。で、それを分析、解析して、それをブログの方に反映できるように』への対応"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-seo-assessment-reflection.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ji7d","github_mirror":null,"linked_at":"2026-09-04T02:08:28Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

記事が検索から見つかる状態にあるかを機械的に診断し、その結果を人の承認を経てブログ本体へ戻せるようにする

## 到達状態

公開・更新時と月次で article_seo_assessments が生成され、検証可能な指摘 (索引可能性・構造化データの妥当性・更新日の掲出・内部リンク・見出し構造) だけが提示され、採用した推奨は下書きへ書き戻されて既存の人間承認経路を必ず通る状態になっている

## スコープ

スコープ内:

- article_seo_assessments テーブル (記事 × 診断日 × 指摘項目と重大度と根拠)
- assess-article-seo ユースケース: 公開・更新時および月次での再診断
- 索引可能性の検査 (robots / noindex / canonical / sitemap 収載)
- 構造化データ (BlogPosting/Article, Person, Organization, BreadcrumbList) の純関数による妥当性検証
- 最終更新日の掲出、見出し階層、内部リンクの検査
- sitemap.xml / RSS・Atom / robots.txt の生成と、ブログごとのクローラ許否設定
- apply-seo-recommendation ユースケース: 採用した推奨を下書きへ書き込み、既存の承認経路へ載せる
- 指針の出典を guideline-reference.ts の 90 日見直しに載せる

スコープ外:

- 検索順位そのものの保証や、ベンダー推定の数値目標
- 公開面を直接書き換える経路 (必ず下書き経由)
- AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization)
- 診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console)

## 受入

- [ ] 公開・更新のたびに当該記事の診断が生成される
- [ ] 月次で全公開記事の診断が更新される
- [ ] 構造化データの妥当性検証が純関数で、外部通信なしにテストできる
- [ ] 不正な構造化データが指摘として立ち、妥当なものは立たない
- [ ] 採用した推奨が下書きにだけ書かれ、公開面が承認なしに変わらない
- [ ] 採用後も既存の承認経路を通らずには公開されない
- [ ] sitemap.xml と RSS/Atom が公開記事を漏れなく列挙する
- [ ] ブログごとにクローラを拒否でき、拒否したブログが robots.txt に反映される
- [ ] 検証できない指摘 (順位予測など) が受入条件にも画面にも現れない
- [ ] 指針の出典が 90 日見直しの対象として登録されている

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- `architecture_refs`: `arch-blog-operations-console`
- 関連ノード: `spec-system-spec-index`、`feat-aeo-answer-optimization`、`feat-blog-scoped-admin-console`

## 機能間依存

- `depends_on`: `feat-editorial-workflow`
- `depends_on`: `feat-reader-surface`
- `depends_on`: `feat-blog-ui-builder`
- 依存理由: 反映先の下書きと承認経路 (feat-editorial-workflow)、診断対象の公開面出力 (feat-reader-surface)、テンプレート側の構成要素 (feat-blog-ui-builder) が先に要る。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-seo-assessment-reflection` と repo-relative `--feature-context features/feat-seo-assessment-reflection.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-seo-assessment-reflection` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: 診断テーブル・索引可能性検査・構造化データ検証の純関数・sitemap/RSS/robots・下書き書き戻し・出典見直しを P01..P13 へ分解する。evidence は承認を経ずに公開面が変わらないことを示すこと。
- 完了 rollup: exact 13 が全て done かつ受入 10 件を evidence が満たした場合だけ本 feature を done にする。
