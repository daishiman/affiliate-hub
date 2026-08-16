---
graph_node_id: "feat-persona-studio"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "editorial"
tags: ["persona","tone","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "Persona Studio"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-auth-workspace"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "誰が誰に向けて書くのかを明示し、媒体ごとに崩れない文章の前提を持つ"
goal: "書き手ペルソナと読者ペルソナを登録・編集でき、ブランドトーン・媒体別トーン・禁止表現・経験の範囲が生成の入力として使える"
scope_in: ["書き手ペルソナ (§13)","読者ペルソナ (§14)","ブランドトーン・媒体別トーン","キャラクターと吹き出し話者","禁止表現・経験の範囲・資格・専門領域・CTAスタイル","事実境界 (§13.3)"]
scope_out: ["生成本体 (feat-ai-content-studio)","会話ブロックの表示 (feat-reader-surface)"]
acceptance: ["書き手ペルソナに未経験の領域を書かせない制約が保存され生成入力へ渡る","読者ペルソナを切り替えると生成プロンプトの読者像が変わる","禁止表現が生成後チェックの対象になる","ペルソナ未設定では生成を開始できない"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-persona-studio.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"9185b196b216a5e9fc5b874144bcf74912551a9ddc28a9f3be115b6e09833c92","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-persona-studio.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

誰が誰に向けて書くのかを明示し、媒体ごとに崩れない文章の前提を持つ

## 到達状態

書き手ペルソナと読者ペルソナを登録・編集でき、ブランドトーン・媒体別トーン・禁止表現・経験の範囲が生成の入力として使える

## スコープ

- スコープ内:
  - 書き手ペルソナ (§13)
  - 読者ペルソナ (§14)
  - ブランドトーン・媒体別トーン
  - キャラクターと吹き出し話者
  - 禁止表現・経験の範囲・資格・専門領域・CTAスタイル
  - 事実境界 (§13.3)
- スコープ外:
  - 生成本体 (feat-ai-content-studio)
  - 会話ブロックの表示 (feat-reader-surface)

## 受入

- [ ] 書き手ペルソナに未経験の領域を書かせない制約が保存され生成入力へ渡る
- [ ] 読者ペルソナを切り替えると生成プロンプトの読者像が変わる
- [ ] 禁止表現が生成後チェックの対象になる
- [ ] ペルソナ未設定では生成を開始できない

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-auth-workspace
- 依存理由: テナント境界とブランド既定値が決まらないと、後続のどのデータにも所有者を付けられない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
