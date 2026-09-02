---
graph_node_id: "task-decision-id-prefix-alignment"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "data"
tags: ["spec-harness"]
priority: "low"
start_date: null
target_date: null
iteration: null
title: "正本 decisions[] の ID 接頭辞が 1 件だけ揃っていない"
owners: ["daishiman"]
created_at: "2026-08-31T14:00:00Z"
updated_at: "2026-08-31T14:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-seed-satisfies-public-entry"]
resource_scope: ["spec","tests"]
purpose: "dec- と decision- の 2 通りを 1 通りに揃え、ID を字面で拾う検査が取りこぼさないようにする"
goal: null
mvp_alignment: {"background":"正本 spec-state.json の decisions[] は 7 件が decision- で始まり、2026-08-31 に足した住所 (サブドメイン) の 1 件だけが dec-blog-domain-strategy である。","mvp_fit":"enabling","purpose":"dec- と decision- の 2 通りを 1 通りに揃え、ID を字面で拾う検査が取りこぼさないようにする","rationale":"decision- だけを見ていた検査が、載っている 1 件を『載っていない』と読んで落ちた。検査側は両方を拾うよう広げて回避してあるが、これは追認ではなく先送りである。ID を書き換えるには C01 の writer を通す必要があり、すでに dev-graph / Beads 側がこの ID を参照しているため、参照側の追随も要る。"}
scope_in: ["正本 spec-state.json の decisions[] の ID","参照側の追随"]
scope_out: ["決定の内容そのものの見直し"]
acceptance: ["正本 decisions[] の ID 接頭辞が 1 通りに揃っている","dev-graph / Beads 側の参照が新しい ID へ追随している","chapter-regeneration-floor.test.ts の decisionIdsInSection が 1 通りだけを見る形へ戻せる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-decision-id-prefix-alignment.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-31T14:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/spec-state.json","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "decision- だけを見ていた検査が、載っている 1 件を『載っていない』と読んで落ちた。検査側は両方を拾うよう広げて回避してあるが、これは追認ではなく先送りである。ID を書き換えるには C01 の writer を通す必要があり、すでに dev-graph / Beads 側がこの ID を参照しているため、参照側の追随も要る。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-decision-id-prefix-alignment.md","confidence":0.9}]
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

dec- と decision- の 2 通りを 1 通りに揃え、ID を字面で拾う検査が取りこぼさないようにする

## 背景

正本 spec-state.json の decisions[] は 7 件が decision- で始まり、2026-08-31 に足した住所 (サブドメイン) の 1 件だけが dec-blog-domain-strategy である。

decision- だけを見ていた検査が、載っている 1 件を『載っていない』と読んで落ちた。検査側は両方を拾うよう広げて回避してあるが、これは追認ではなく先送りである。ID を書き換えるには C01 の writer を通す必要があり、すでに dev-graph / Beads 側がこの ID を参照しているため、参照側の追随も要る。

## 実装対象

- 正本 spec-state.json の decisions[] の ID
- 参照側の追随

**触らない範囲**

- 決定の内容そのものの見直し

## 入力と前提条件

- 現状の根拠: system-spec/spec-state.json

## 出力と成果物

- 上の「実装対象」に挙げた箇所の変更

## 実行手順

- 着手時に決める。この文書は残課題の記録であり、手順の確定はまだしていない。

## 受入条件

- 正本 decisions[] の ID 接頭辞が 1 通りに揃っている
- dev-graph / Beads 側の参照が新しい ID へ追随している
- chapter-regeneration-floor.test.ts の decisionIdsInSection が 1 通りだけを見る形へ戻せる

## 検証方法

- 受入条件の各行を、機械で確かめられる形にしてから検査に足す。

## 依存関係

- なし

## Write scope と競合制約

- spec
- tests

## リスクとロールバック

- 正本と生成物の両方に触れる作業のため、変更前の章を再生成して差分が出ないことを先に確かめてから着手する。

## Handoff

- 2026-08-31 に、ブログ作成の改善の作業中に見つかった残課題として起票した。

## GitHub publication

- local_only (Issue へは投影しない)。
