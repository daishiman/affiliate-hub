---
graph_node_id: "task-split-qa-bundle-slash-separator"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","tooling","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "split-qa-bundle が全角スラッシュ連結の束ねを解けない"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: [".claude/plugins/system-spec-harness"]
purpose: null
goal: null
mvp_alignment: {"background":"split-qa-bundle は区切り文字の候補に全角スラッシュを持たず、`A／B` の束ねが 1 件のまま残る","mvp_fit":"deferred","purpose":"束ねられた問いを 1 問 1 答へ戻す","rationale":"束ねたままだと、片方だけ確定してもう片方が未収集のまま「確定」に見える"}
scope_in: ["`／` 区切りの検出と分解","分解後の qa_ref の付け替え"]
scope_out: ["束ね方そのものを禁じる検査の追加"]
acceptance: ["`／` で連結された束ねの qa entry が個別の問いへ分解される","分解後も qa_ref の参照先が壊れない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-split-qa-bundle-slash-separator.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the thumbnail work"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-split-qa-bundle-slash-separator.md","confidence":0.9}]
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

全角スラッシュで束ねられた問いを、1 問 1 答へ戻せるようにする。

## 背景

`split-qa-bundle` は束ねを解く道具だが、区切り文字の候補に全角スラッシュ (`／`) を持たない。そのため `A／B` の形で束ねられた qa entry が 1 件のまま残る。

束ねが残ると何が起きるか: 片方だけ答えが揃った状態でも entry としては 1 件なので、**確定にできてしまう**。もう片方は聞かれないまま「確定」の中に埋もれる。

## 入力と前提条件

- 入力: `system-spec/spec-state.json` の `qa_log` にある束ねられた entry
- 前提: `spec-state.json` への書込は `apply-spec-transition.py` の一経路のみ。手で JSON を編集しない

## 出力と成果物

- 生成物: `／` 区切りを解いた qa entry
- 更新対象: `split-qa-bundle` の区切り検出、および分解後の `qa_ref` の付け替え

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A: 画面を持たない道具
- Backend/API: N/A: 実行時のコードを触らない
- Database/Data: `spec-state.json` の qa_log の粒度が変わる
- Infrastructure: N/A
- Security/Privacy: N/A: 秘密を含まない
- Documentation: 区切り文字の扱いを道具の説明へ書く

## Write scope と競合制約

- `touches`: .claude/plugins/system-spec-harness/
- 排他資源: system-spec/spec-state.json
- 並列実行条件: spec-state.json を書く task と同時に走らせない
- branch: devgraph/task-split-qa-bundle-slash-separator
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-split-qa-bundle-slash-separator` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. 現在の区切り検出を読み、`／` を足したときに誤爆する文面が無いか確かめる
2. 区切り候補へ `／` を足す
3. 分解後に `qa_ref` の参照先が壊れないよう、付け替えを同じ書込経路で行う
4. 束ねが残っている既存 entry へ適用する

## 受入条件

- [ ] `／` で連結された束ねの qa entry が個別の問いへ分解される
- [ ] 分解後も `qa_ref` の参照先が壊れない
- [ ] 文中の `／` (区切りではない用法) を誤って割らない

## 検証方法

- 自動検証: `python3 -m pytest .claude/plugins/system-spec-harness/tests/ -k qa_bundle`
- 手動検証: 分解後の `spec-state.json` を読み、割れた両方に答えが付いているか確かめる
- 証跡: 分解前後の qa_log の差分

## リスクとロールバック

- リスク: 文中の `／` まで割ると、意味の通らない問いが増える
- ロールバック: 分解は書込経路を通るので、`reopen` で元の粒度へ戻せる

## Handoff

- 実装 route: human。次に利用するノード: なし
