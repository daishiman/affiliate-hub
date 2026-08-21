---
graph_node_id: "task-guard-inline-python-hole"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["tooling","known-limit"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "見張りが書き手を見ていないことを検査として固定する"
owners: ["daishiman"]
created_at: "2026-08-19T00:00:00Z"
updated_at: "2026-08-19T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"正規 writer を通さない python スクリプトから正本を 3 回書き換えたが、見張りは 3 回とも通した","mvp_fit":"enabling","purpose":"見張りが書込の形は見るが書き手は見ないことを検査にし、印の仕組みが足された日に赤くする","rationale":"いま塞ぐとプラグイン側に手が入る。塞ぐまでのあいだ、穴を本文ではなく検査に持たせる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-guard-inline-python-hole.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "single standalone task, no feature package"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-guard-inline-python-hole.md","confidence":0.9}]
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

見張りの穴 (`python3` の 1 行スクリプトから正本を書き換えられること) を、いま塞がずに、通ってしまうこと自体を検査として固定する。

## 背景

正本 `system-spec/spec-state.json` の書き換えは hook で見張られている。しかし見張りが見ているのは書込の形であって、書き手ではない。実際に、正規の writer を通さない `python3` スクリプトから正本を 3 回書き換えている。3 回とも気づかずに通った。判断の記録としてではなく事故として記録する — 考えて通ったのではなく、見張りが無いことに気づかないまま通ったからである。塞ぎ方の見立て (正規 writer に印を持たせ、印の無い書込を弾く) は立っているが、プラグイン側に手が入るのでいまは塞がない。塞ぐまでのあいだ、穴が開いていることを本文ではなく検査に持たせる。

## 入力と前提条件

- 入力: `.claude/hooks/` 配下の見張り、`system-spec/spec-state.json`
- 前提: いまは塞がない。塞ぐのはプラグイン側に手が入る作業で、別の回に切り分ける
- 前提: この検査は穴を塞ぐものではなく、穴が開いていることを知らせるもの

## 出力と成果物

- 生成物: 限界を固定する検査 1 本
- 更新対象: `tests/architecture/`、`docs/product/backlog.md`

## 依存関係

- depends_on: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: 見張りの適用範囲が「書込の形」であって「書き手」ではないことを明示する
- Documentation: 事故として記録する。判断の記録として書くと「考えて通った」ことになり、事実と違う

## Write scope と競合制約

- touches: tests/architecture/ docs/product/backlog.md
- 排他資源: なし
- 並列実行条件: 制約なし
- branch: feat/clean-architecture-skeleton
- worktree lease: 本 worktree で実行
- completion projection: manual

## GitHub publication

- Mode: local_only
- Project aliases: N/A: github.enabled=false
- Issue labels/milestone: N/A: Beads が実行管理
- Initial Project fields: N/A: GitHub Projects を使わない
- Publication gate: 検査が緑で、壊して赤くなることを確認済みであること
- Failure policy: local のまま残す
- Completion policy: manual
- PR linkage requirement: 本文に Beads ID と dev-graph: task-guard-inline-python-hole を書く
- Closed without merge: keep_active
- Local reconciliation: 手動

## status の意味論 (二重正本の禁止)

frontmatter の status は文書ライフサイクルのみ。実行状態は Beads と completion_evidence を正本とする。

## 実行手順

1. 見張りが何を見て何を見ていないかを、コードから実測する (書込の形は見る / 書き手は見ない)
2. 正規 writer に印が無いこと、印を確かめる箇所が無いことを実測する
3. その 2 つをそのまま検査にする。印の仕組みが足された日に赤くなる向きで書く
4. 壊して測る: 正規 writer に印を足した状態を作り、検査が赤くなることを確認する。確認後は複製から書き戻す

## 受入条件

- [ ] 検査が現状で緑である
- [ ] 印の仕組みを足すと赤くなることを、実際に足して確認してある
- [ ] 検査の名前と説明から「これは穴の監視であって、穴が塞がっていることの確認ではない」と読める
- [ ] 3 回通した件が、判断の記録ではなく事故として残課題に書かれている

## 検証方法

- 自動検証: `pnpm run verify`
- 手動検証: 壊して赤を確認する
- 証跡: 赤になったときの出力

## リスクとロールバック

- リスク: 「見張りが効いていることの確認」と読み違えられる。名前と説明で防ぐ
- リスク: 塞ぐ作業をこの課題に混ぜてしまう。塞ぐのは別の回
- ロールバック: 検査 1 本の追加なので revert で戻せる

## Handoff

- 実装 route: agent
- 次に利用するノード: なし
