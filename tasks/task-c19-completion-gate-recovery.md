---
graph_node_id: "task-c19-completion-gate-recovery"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","gate","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "C19 完了境界ゲートの回復 (receipt-inputs-stale)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: [".claude/plugins/dev-graph","system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"build-system-spec-resume-import.py が receipt-inputs-stale と artifact-digest-stale:system-spec/spec-state.json で FAIL する","mvp_fit":"deferred","purpose":"完了境界を機械で確かめられる状態へ戻す","rationale":"ゲートが落ちたままだと、以後の取込がすべて手作業の判断になる"}
scope_in: ["receipt-inputs-stale と artifact-digest-stale:system-spec/spec-state.json の原因の特定","receipt の作り直し"]
scope_out: ["digest 照合そのものを緩めること"]
acceptance: ["`build-system-spec-resume-import.py --repo-root .` が exit 0 で返る","receipt が参照する入力の digest と実体が一致している"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-c19-completion-gate-recovery.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the thumbnail work"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-c19-completion-gate-recovery.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

完了境界を機械で確かめられる状態へ戻す。

## 背景

`python3 .claude/plugins/dev-graph/scripts/build-system-spec-resume-import.py --repo-root .` が`receipt-inputs-stale` と `artifact-digest-stale:system-spec/spec-state.json` で FAIL する。

このゲートが落ちたままだと、以後の取込がすべて人の判断になる。「たぶん揃っている」で進めた取込は、あとから何を根拠に通したのか誰にも分からない。

## 入力と前提条件

- 入力: 既存の receipt と、それが参照する入力ファイル群の digest
- 前提: digest 照合そのものを緩めない。緩めるとゲートが意味を失う

## 出力と成果物

- 生成物: 入力と一致する receipt
- 更新対象: `system-spec/spec-state.json` の digest 参照

## 依存関係

- `depends_on`: なし
- ブロッカー: `task-completeness-report-inventory-drift` と原因が重なる可能性がある

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A: 状態ファイルの digest のみ
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: receipt の作り直し手順を残す

## Write scope と競合制約

- `touches`: .dev-graph/ system-spec/
- 排他資源: system-spec/spec-state.json
- 並列実行条件: spec-state.json を書く task と同時に走らせない
- branch: devgraph/task-c19-completion-gate-recovery
- worktree lease: 実装前に `graph_node_id` を claim し、終了時に release する
- completion projection: feature branch は pending event のみ記録し、既定ブランチ側の reconcile が done を書く

## GitHub publication

- Mode: local_only
- Project aliases: N/A: github.enabled=false
- Issue labels/milestone: N/A: Beads が実行管理する
- Initial Project fields: N/A: GitHub Projects を使わない
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Failure policy: pending_retry。local の task は巻き戻さない
- Completion policy: manual (github.enabled=false のため source=manual)
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-c19-completion-gate-recovery` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `receipt-inputs-stale` がどの入力を指しているかを出力から特定する
2. `spec-state.json` の実体 digest と receipt の記録を突き合わせ、どちらが後から動いたかを見る
3. 正規の書込経路で receipt を作り直す
4. `build-system-spec-resume-import.py --repo-root .` が exit 0 で返ることを確かめる

## 受入条件

- [ ] `build-system-spec-resume-import.py --repo-root .` が exit 0 で返る
- [ ] receipt が参照する入力の digest と実体が一致している
- [ ] digest 照合の閾値・免除を一切足していない

## 検証方法

- 自動検証: `python3 .claude/plugins/dev-graph/scripts/build-system-spec-resume-import.py --repo-root .`
- 手動検証: receipt の入力一覧を読み、実在するファイルだけを指していることを確かめる
- 証跡: FAIL 時と PASS 時の出力

## リスクとロールバック

- リスク: receipt を作り直すときに、古い世代を上書きして経緯が消える
- ロールバック: receipt は追記で世代を持つ。git で戻せる

## Handoff

- 実装 route: human。次に利用するノード: `task-completeness-report-inventory-drift`
