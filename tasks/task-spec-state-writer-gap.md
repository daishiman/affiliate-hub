---
graph_node_id: "task-spec-state-writer-gap"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","known-limit"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "正本を保守できる writer が無いことを検査として固定する"
owners: ["daishiman"]
created_at: "2026-08-19T00:00:00Z"
updated_at: "2026-08-19T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests","system-spec","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"正本は schema_version 1.2 だが、repo 内の writer は 1.1 を要求し一度も動かない。1.2 固有 3 節を書くコードも 0 件","mvp_fit":"enabling","purpose":"版の食い違いと書く当てどころの不在を検査にし、書けるようになった日に赤くする","rationale":"本文に「保守できません」と書くだけでは、保守できるようになった日にも古く見えないまま残る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-state-writer-gap.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "single standalone task, no feature package"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-state-writer-gap.md","confidence":0.9}]
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

正本 `system-spec/spec-state.json` を保守できる writer がこの作業場所に無いことを、文章ではなく検査として固定する。

## 背景

正本は最初のコミットから `schema_version: 1.2`。この repo に入っている writer は `CURRENT_STATE_SCHEMA_VERSION = "1.1"` と宣言し、exact 一致でないものを「legacy 読み取り専用」として全 transition を拒否する。つまりこの writer は正本に対して一度も動かない。さらに 1.2 で増えた `delivery_dependencies` / `implementation_snapshot` / `review_runs` を書くコードは、この repo に 1 行も無い。版の門を外しても書く当てどころが無いので、保守にはならない。いまは repo の外にあるキャッシュ側 install (0.1.2) の writer で書いている。これは版を検査しない。門を通したのではなく、門が無い writer で書いている。既存の決定 6 件を書いたのもそれである。

## 入力と前提条件

- 入力: `system-spec/spec-state.json`、`.claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/`
- 前提: 正本を 1.1 へ落とす道は取らない。1.2 固有の 4 節を捨てることになり、器に合わせて中身を削る行為だから
- 前提: キャッシュ側 install は repo の外にあるので検査の根拠にしない。場所によって在ったり無かったりするものを根拠にすると、検査の意味が環境で変わる

## 出力と成果物

- 生成物: 限界を固定する検査 1 本
- 更新対象: `tests/architecture/`、`docs/product/backlog.md`

## 依存関係

- depends_on: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A: 表示は変えない
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: どの writer で書いたかと、それが版の門を持たないことを `decisions[]` と残課題の両方に書く

## Write scope と競合制約

- touches: tests/architecture/ docs/product/backlog.md
- 排他資源: system-spec/spec-state.json (書き込みは 1 度に 1 人)
- 並列実行条件: 正本を書く作業とは同時に走らせない
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
- PR linkage requirement: 本文に Beads ID と dev-graph: task-spec-state-writer-gap を書く
- Closed without merge: keep_active
- Local reconciliation: 手動

## status の意味論 (二重正本の禁止)

frontmatter の status は文書ライフサイクルのみ。実行状態は Beads と completion_evidence を正本とする。

## 実行手順

1. 正本の版と、repo 内 writer が宣言する版が食い違っていることを実測する
2. 1.2 で増えた 3 節を書くコードが repo 内に 1 行も無いことを実測する
3. その 2 つをそのまま検査にする。書けるようになった日に赤くなる向きで書く
4. 正本の 3 節が実際に中身を持っていることも固定する。中身が空なら困りごとにならないし、空になっていたらそれは誰かが器に合わせて削った跡である
5. 壊して測る: ①版を一致させる ②書くコードを 1 行足す ③節を空にする。3 通りで赤を確認し、複製から書き戻す

## 受入条件

- [ ] 検査が現状で緑である
- [ ] 版を一致させると赤くなることを、実際に一致させて確認してある
- [ ] 書くコードを足すと赤くなることを、実際に足して確認してある
- [ ] 節を空にすると赤くなることを、実際に空にして確認してある
- [ ] 「門を通した」ではなく「門が無い writer で書いた」という言い方で記録されている
- [ ] 書く前と後で `decisions` 以外が動いていないことを実測してある

## 検証方法

- 自動検証: `pnpm run verify`
- 手動検証: 3 通り壊して赤を確認する
- 証跡: 赤になったときの出力と、書き込み前後の節ごとの指紋比較

## リスクとロールバック

- リスク: 「writer を直す課題」と読み違えられる。これは穴を監視する課題であって、塞ぐ課題ではない
- リスク: プラグインが更新されて検査が赤くなったとき、検査のほうを消して済ませてしまう。赤は「正しい writer で書き直す作業へ移る合図」であることを検査の説明に書く
- ロールバック: 検査 1 本の追加なので revert で戻せる

## Handoff

- 実装 route: agent
- 次に利用するノード: なし
