---
graph_node_id: "feat-aeo-answer-optimization"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["aeo","answer-engine","llms-txt","faq","citation","e-e-a-t"]
priority: "medium"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "回答エンジン向けの回答単位整備と引用可能化"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T02:27:58.830900Z"
status: "active"
depends_on: ["feat-seo-assessment-reflection","feat-blog-ui-builder","feat-reader-surface"]
related_nodes: ["spec-system-spec-index","feat-blog-scoped-admin-console"]
resource_scope: ["src/db/schema.ts","src/domain/aeo/","src/application/aeo/","src/app/(reader)/llms.txt/route.ts","src/app/(reader)/robots.txt/route.ts","src/components/reader/answer-unit.tsx","src/app/admin/sites/[site]/aeo/","system-spec","features/feat-aeo-answer-optimization.context.json"]
purpose: "AI の回答エンジンが記事から答えを取り出して引用できる形へ、記事とブログの表現を整える"
goal: "記事が結論・要点・比較表・FAQ・出典・最終更新日という回答単位を持ち、article_answer_units と site_aeo_profiles として管理され、llms.txt とブログごとのクローラ方針が配信され、AI 検索での引用状況を定点で記録できる状態になっている"
scope_in: ["site_aeo_profiles / article_answer_units テーブル (ブログの回答方針と、記事内の回答単位)","記事テンプレートの回答単位: 結論ブロック / 要点リスト / 比較表 / FAQ ブロック / 出典ブロック / 最終更新日","FAQPage / HowTo / Product・Review の構造化データ生成 (妥当性は SEO 側の純関数を共有する)","著者プロフィール面と Person/Organization の紐付け (E-E-A-T)","llms.txt の配信と、ブログごとの AI クローラ許否 (既定は許可、拒否リストで個別に落とす)","AI 検索での引用有無を定点で記録し、期間比較できる観測台帳","AEO 出力を既存の公開面生成経路へ載せる (別経路を新設しない)"]
scope_out: ["特定の AI 検索サービスでの露出保証や順位保証","索引可能性・sitemap・一般的な構造化データ検査 (feat-seo-assessment-reflection)","回答単位の本文そのものを自動生成して無承認で公開すること","残数・優先度の提示順序 (feat-blog-scoped-admin-console)"]
acceptance: ["記事に結論・要点・FAQ・出典・最終更新日の回答単位が構造として存在し、欠落が機械的に検出される","FAQ ブロックがある記事の FAQPage 構造化データが妥当性検証を通る","llms.txt が配信され、ブログごとの方針が反映される","AI クローラを拒否したブログで robots.txt の該当 user-agent が拒否になる","既定 (拒否設定なし) では AI クローラが許可される","著者プロフィール面が存在し、記事から Person として辿れる","AEO 出力が既存の公開面生成経路を通り、別系統の配信路が増えない","引用状況の観測が日付付きで残り、前後期間で比較できる","回答単位の本文が下書き経由でしか公開面へ入らない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-aeo-answer-optimization.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-aeo-answer-optimization/28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"bfd54655ae9a9f448eca91fcd6f57a9a30520bf4632c5f709f4ca504130cff7e","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定質疑 qa-frontend-web-seo-ai-search / qa-frontend-web-seo-ai-search-v2 / qa-uiux-web-seo-ai-search / qa-database-web-domain-aeo-behavior を lineage 参照。利用者要望『aeo も』への対応"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-aeo-answer-optimization.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-4d0q","github_mirror":null,"linked_at":"2026-09-04T02:09:19Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

AI の回答エンジンが記事から答えを取り出して引用できる形へ、記事とブログの表現を整える

## 到達状態

記事が結論・要点・比較表・FAQ・出典・最終更新日という回答単位を持ち、article_answer_units と site_aeo_profiles として管理され、llms.txt とブログごとのクローラ方針が配信され、AI 検索での引用状況を定点で記録できる状態になっている

## スコープ

スコープ内:

- site_aeo_profiles / article_answer_units テーブル (ブログの回答方針と、記事内の回答単位)
- 記事テンプレートの回答単位: 結論ブロック / 要点リスト / 比較表 / FAQ ブロック / 出典ブロック / 最終更新日
- FAQPage / HowTo / Product・Review の構造化データ生成 (妥当性は SEO 側の純関数を共有する)
- 著者プロフィール面と Person/Organization の紐付け (E-E-A-T)
- llms.txt の配信と、ブログごとの AI クローラ許否 (既定は許可、拒否リストで個別に落とす)
- AI 検索での引用有無を定点で記録し、期間比較できる観測台帳
- AEO 出力を既存の公開面生成経路へ載せる (別経路を新設しない)

スコープ外:

- 特定の AI 検索サービスでの露出保証や順位保証
- 索引可能性・sitemap・一般的な構造化データ検査 (feat-seo-assessment-reflection)
- 回答単位の本文そのものを自動生成して無承認で公開すること
- 残数・優先度の提示順序 (feat-blog-scoped-admin-console)

## 受入

- [ ] 記事に結論・要点・FAQ・出典・最終更新日の回答単位が構造として存在し、欠落が機械的に検出される
- [ ] FAQ ブロックがある記事の FAQPage 構造化データが妥当性検証を通る
- [ ] llms.txt が配信され、ブログごとの方針が反映される
- [ ] AI クローラを拒否したブログで robots.txt の該当 user-agent が拒否になる
- [ ] 既定 (拒否設定なし) では AI クローラが許可される
- [ ] 著者プロフィール面が存在し、記事から Person として辿れる
- [ ] AEO 出力が既存の公開面生成経路を通り、別系統の配信路が増えない
- [ ] 引用状況の観測が日付付きで残り、前後期間で比較できる
- [ ] 回答単位の本文が下書き経由でしか公開面へ入らない

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- `architecture_refs`: `arch-blog-operations-console`
- 関連ノード: `spec-system-spec-index`、`feat-blog-scoped-admin-console`

## 機能間依存

- `depends_on`: `feat-seo-assessment-reflection`
- `depends_on`: `feat-blog-ui-builder`
- `depends_on`: `feat-reader-surface`
- 依存理由: 索引可能性と構造化データの土台 (feat-seo-assessment-reflection)、回答ブロックを置くテンプレート (feat-blog-ui-builder)、実際に配信する読者面 (feat-reader-surface) の上に積む。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-aeo-answer-optimization` と repo-relative `--feature-context features/feat-aeo-answer-optimization.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-aeo-answer-optimization` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: 回答単位テーブル・記事テンプレートの 6 ブロック・FAQPage/HowTo 構造化データ・著者プロフィール・llms.txt とクローラ方針・引用定点観測を P01..P13 へ分解する。evidence は既存公開面生成経路を通ることを示すこと。
- 完了 rollup: exact 13 が全て done かつ受入 9 件を evidence が満たした場合だけ本 feature を done にする。
