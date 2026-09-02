---
graph_node_id: "task-chapter-decisions-generated-by-compile"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "data"
tags: ["spec-harness","dx"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "確定 8 章の意思決定表を、人の手ではなく compile に描かせる"
owners: ["daishiman"]
created_at: "2026-08-31T14:00:00Z"
updated_at: "2026-08-31T14:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-seed-satisfies-public-entry"]
resource_scope: ["scripts","tests"]
purpose: "決定が 1 件増えるたびに 8 ファイルを人が手で直す形をやめ、正本から機械が描くようにする"
goal: null
mvp_alignment: {"background":"00 章の意思決定支援表は spec_docset_foundation.py が正本 decisions[] から生成する。一方、確定 8 章の意思決定表は spec_docset_chapters.py に生成コードが 1 行も無く、完全な手書き節で、再生成時は --on-handwritten preserve が引き継ぐだけである。","mvp_fit":"enabling","purpose":"決定が 1 件増えるたびに 8 ファイルを人が手で直す形をやめ、正本から機械が描くようにする","rationale":"章は status: confirmed なので C11 hook が Edit を遮断する。つまり『章の表を正本と一致させる』を満たす正規経路が、いまのハーネスに存在しない。2026-08-31 に dec-blog-domain-strategy が増えて実際にそうなった。"}
scope_in: ["spec_docset_chapters.py の生成節","chapter-regeneration-floor.test.ts の検査の戻し"]
scope_out: ["正本 spec-state.json の変更","章 Markdown の直接編集"]
acceptance: ["spec_docset_chapters.py が確定 8 章の意思決定表を正本 decisions[] から生成する","章を再生成すると 8 章すべての表が正本と全件一致する","chapter-regeneration-floor.test.ts の手書き側の検査を、00 章と同じ toEqual へ戻して緑になる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-chapter-decisions-generated-by-compile.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-31T14:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"tests/architecture/chapter-regeneration-floor.test.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "章は status: confirmed なので C11 hook が Edit を遮断する。つまり『章の表を正本と一致させる』を満たす正規経路が、いまのハーネスに存在しない。2026-08-31 に dec-blog-domain-strategy が増えて実際にそうなった。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-chapter-decisions-generated-by-compile.md","confidence":0.9}]
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

決定が 1 件増えるたびに 8 ファイルを人が手で直す形をやめ、正本から機械が描くようにする

## 背景

00 章の意思決定支援表は spec_docset_foundation.py が正本 decisions[] から生成する。一方、確定 8 章の意思決定表は spec_docset_chapters.py に生成コードが 1 行も無く、完全な手書き節で、再生成時は --on-handwritten preserve が引き継ぐだけである。

章は status: confirmed なので C11 hook が Edit を遮断する。つまり『章の表を正本と一致させる』を満たす正規経路が、いまのハーネスに存在しない。2026-08-31 に dec-blog-domain-strategy が増えて実際にそうなった。

## 実装対象

- spec_docset_chapters.py の生成節
- chapter-regeneration-floor.test.ts の検査の戻し

**触らない範囲**

- 正本 spec-state.json の変更
- 章 Markdown の直接編集

## 入力と前提条件

- 現状の根拠: tests/architecture/chapter-regeneration-floor.test.ts

## 出力と成果物

- 上の「実装対象」に挙げた箇所の変更

## 実行手順

- 着手時に決める。この文書は残課題の記録であり、手順の確定はまだしていない。

## 受入条件

- spec_docset_chapters.py が確定 8 章の意思決定表を正本 decisions[] から生成する
- 章を再生成すると 8 章すべての表が正本と全件一致する
- chapter-regeneration-floor.test.ts の手書き側の検査を、00 章と同じ toEqual へ戻して緑になる

## 検証方法

- 受入条件の各行を、機械で確かめられる形にしてから検査に足す。

## 依存関係

- なし

## Write scope と競合制約

- scripts
- tests

## リスクとロールバック

- 正本と生成物の両方に触れる作業のため、変更前の章を再生成して差分が出ないことを先に確かめてから着手する。

## Handoff

- 2026-08-31 に、ブログ作成の改善の作業中に見つかった残課題として起票した。

## GitHub publication

- local_only (Issue へは投影しない)。
