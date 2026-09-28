---
graph_node_id: "task-completeness-report-inventory-drift"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "completeness-report.json の inventory が gate-change-log.md を指したまま"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"system-spec/completeness-report.json:784 の inventory が system-spec/gate-change-log.md を指したままになっている","mvp_fit":"deferred","purpose":"報告書が実体と食い違わないようにする","rationale":"指す先がずれた報告書は、読んだ人を誤った場所へ案内する"}
scope_in: ["inventory の指す先の是正"]
scope_out: ["completeness の判定基準そのものの変更"]
acceptance: ["system-spec/completeness-report.json の inventory が実体と一致する","aggregate-completeness.py が exit 0 で返る"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-completeness-report-inventory-drift.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the thumbnail work"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-completeness-report-inventory-drift.md","confidence":0.9}]
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

完成度の報告書が、実在しない場所を指したままにならないようにする。

## 背景

`system-spec/completeness-report.json:784` の inventory が `system-spec/gate-change-log.md` を指したままになっている。報告書は「どこを見れば根拠があるか」を伝えるためのものなので、指す先がずれた報告書は、読んだ人を誤った場所へ案内する。

## 入力と前提条件

- 入力: `system-spec/completeness-report.json` の inventory と、実在するファイル一覧
- 前提: completeness の判定基準そのものは変えない。指す先だけを直す

## 出力と成果物

- 生成物: 実体と一致した inventory
- 更新対象: `system-spec/completeness-report.json`

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 報告書そのものが対象

## Write scope と競合制約

- `touches`: system-spec/
- 排他資源: system-spec/completeness-report.json
- 並列実行条件: 完成度評価を走らせる task と同時に走らせない
- branch: devgraph/task-completeness-report-inventory-drift
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-completeness-report-inventory-drift` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. inventory の各エントリが実在するかを機械で照合する
2. ずれている行の出所 (いつ・どの実行で書かれたか) を確かめる
3. 報告書を正規の生成経路で作り直す

## 受入条件

- [ ] `system-spec/completeness-report.json` の inventory が実体と一致する
- [ ] `aggregate-completeness.py` が exit 0 で返る
- [ ] 報告書を手で編集していない (生成経路を通している)

## 検証方法

- 自動検証: `python3 .claude/plugins/system-spec-harness/scripts/aggregate-completeness.py --report --fork-ledger --session --spec-root .`
- 手動検証: inventory の各 path を実際に開く
- 証跡: aggregate-completeness の出力

## リスクとロールバック

- リスク: 報告書を手で直すと、次の生成でまた同じずれが出る
- ロールバック: git で前の報告書へ戻せる

## Handoff

- 実装 route: human。次に利用するノード: `task-c19-completion-gate-recovery`
