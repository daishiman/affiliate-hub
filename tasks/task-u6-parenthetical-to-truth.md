---
graph_node_id: "task-u6-parenthetical-to-truth"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "data"
tags: ["spec-harness"]
priority: "low"
start_date: null
target_date: null
iteration: null
title: "00 章 U6 の括弧書きが正本に接続されていない"
owners: ["daishiman"]
created_at: "2026-08-31T14:00:00Z"
updated_at: "2026-08-31T14:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-seed-satisfies-public-entry"]
resource_scope: ["spec"]
purpose: "章にだけ在って正本から引けない記述をなくし、再生成で消える行を残さない"
goal: null
mvp_alignment: {"background":"00-requirements-definition.md の U6『発信者』に付いた括弧書き (個人〜小規模チームのアフィリエイト運営者) が正本 requirements_foundation から引けず、章末の『compile が保てなかった行 (要判断)』に逐語で残っている。","mvp_fit":"enabling","purpose":"章にだけ在って正本から引けない記述をなくし、再生成で消える行を残さない","rationale":"生成節の中の手書きは節の引き継ぎでは守れない。正本へ移すか、独立した ## 節へ移すかのどちらかでしか残らない。"}
scope_in: ["正本 requirements_foundation の U6"]
scope_out: ["U6 以外の U 項目"]
acceptance: ["括弧書きの中身が正本 requirements_foundation から引ける","再生成しても当該行が『保てなかった行』に載らない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-u6-parenthetical-to-truth.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-31T14:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/00-requirements-definition.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "生成節の中の手書きは節の引き継ぎでは守れない。正本へ移すか、独立した ## 節へ移すかのどちらかでしか残らない。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-u6-parenthetical-to-truth.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

章にだけ在って正本から引けない記述をなくし、再生成で消える行を残さない

## 背景

00-requirements-definition.md の U6『発信者』に付いた括弧書き (個人〜小規模チームのアフィリエイト運営者) が正本 requirements_foundation から引けず、章末の『compile が保てなかった行 (要判断)』に逐語で残っている。

生成節の中の手書きは節の引き継ぎでは守れない。正本へ移すか、独立した ## 節へ移すかのどちらかでしか残らない。

## 実装対象

- 正本 requirements_foundation の U6

**触らない範囲**

- U6 以外の U 項目

## 入力と前提条件

- 現状の根拠: system-spec/00-requirements-definition.md

## 出力と成果物

- 上の「実装対象」に挙げた箇所の変更

## 実行手順

- 着手時に決める。この文書は残課題の記録であり、手順の確定はまだしていない。

## 受入条件

- 括弧書きの中身が正本 requirements_foundation から引ける
- 再生成しても当該行が『保てなかった行』に載らない

## 検証方法

- 受入条件の各行を、機械で確かめられる形にしてから検査に足す。

## 依存関係

- なし

## Write scope と競合制約

- spec

## リスクとロールバック

- 正本と生成物の両方に触れる作業のため、変更前の章を再生成して差分が出ないことを先に確かめてから着手する。

## Handoff

- 2026-08-31 に、ブログ作成の改善の作業中に見つかった残課題として起票した。

## GitHub publication

- local_only (Issue へは投影しない)。
