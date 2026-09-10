---
graph_node_id: "task-bd-bridge-issue-type-update-path"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "tooling"
tags: ["beads","dev-graph","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "bd-bridge に issue_type を直す正規経路が無い"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: [".claude/plugins/dev-graph"]
purpose: null
goal: null
mvp_alignment: {"background":"ah-6lf の issue_type が誤っているが、bd_bridge_contracts.py の UPDATE_FIELDS に issue_type が無く、チョークポイント経由で直す手段が存在しない","mvp_fit":"deferred","purpose":"迂回せずに直せる状態にする","rationale":"経路が無いことを理由に素の CLI を使うと、Beads と dev-graph の状態が黙って食い違う。塞ぐのではなく経路を足す"}
scope_in: ["UPDATE_FIELDS への issue_type の追加と、その値域の検査","ah-6lf の修正"]
scope_out: ["素の bd CLI を通す抜け道を開けること"]
acceptance: ["`bd_bridge_contracts.py` の UPDATE_FIELDS 経由で issue_type を直せる","ah-6lf の issue_type が正しい値になっている"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-bd-bridge-issue-type-update-path.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the thumbnail work"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-bd-bridge-issue-type-update-path.md","confidence":0.9}]
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

Beads の `issue_type` を、チョークポイントを迂回せずに直せるようにする。

## 背景

`ah-6lf` の `issue_type` が誤っている。しかし `bd_bridge_contracts.py` の `UPDATE_FIELDS` に`issue_type` が無いため、`bd-bridge.py --op update` では直せない。

**ここで素の `bd update` を使うのが一番まずい。** チョークポイントは冪等性の確認・dev-graph node との突き合わせ・workspace identity の検査を 1 か所でやっており、素の CLI が通ると Beads と dev-graph の状態が黙って食い違う。経路が無いことは、迂回してよい理由ではなく、経路を足すべき理由である。

## 入力と前提条件

- 入力: `.claude/plugins/dev-graph/lib/bd_bridge_contracts.py` の `UPDATE_FIELDS`
- 前提: `issue_type` の値域は Beads 側の enum に従う。任意の文字列を通さない

## 出力と成果物

- 生成物: `issue_type` を更新できる正規経路と、その値域検査
- 更新対象: `bd_bridge_contracts.py`、`ah-6lf` の `issue_type`

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A
- Backend/API: N/A: アプリのコードではない
- Database/Data: Beads の Dolt DB 上の 1 列
- Infrastructure: N/A
- Security/Privacy: 迂回経路を新設しないこと自体が守るべき性質
- Documentation: `AGENTS.md` の正規経路一覧へ `issue_type` の更新を足す

## Write scope と競合制約

- `touches`: .claude/plugins/dev-graph/ AGENTS.md CLAUDE.md
- 排他資源: bd_bridge_contracts.py
- 並列実行条件: Beads を書き換える他の task と同時に走らせない
- branch: devgraph/task-bd-bridge-issue-type-update-path
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-bd-bridge-issue-type-update-path` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `UPDATE_FIELDS` に `issue_type` を足し、値域を enum で縛る
2. `--dry-run` で `ah-6lf` の変更内容を確かめる
3. 本実行で `ah-6lf` を直す
4. epic 投影の扱い (`issue_type=epic`) が変わらないことを確かめる

## 受入条件

- [ ] `bd-bridge.py --op update --bd-issue-id <id> --issue-type <type>` で `issue_type` を直せる
- [ ] 値域外の `issue_type` は拒否される
- [ ] `ah-6lf` の `issue_type` が正しい値になっている

## 検証方法

- 自動検証: `python3 -m pytest .claude/plugins/dev-graph/tests/ -k bd_bridge`
- 手動検証: `bd show ah-6lf` で `issue_type` を目視する
- 証跡: `--dry-run` の出力と、実行後の `bd show`

## リスクとロールバック

- リスク: `issue_type=epic` へ任意に変えられると、epic の close ゲート (`--feature-rollup-manifest`) を回避する道ができる
- ロールバック: `UPDATE_FIELDS` から外せば経路ごと閉じる

## Handoff

- 実装 route: human。次に利用するノード: なし
