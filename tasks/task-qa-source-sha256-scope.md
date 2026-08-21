---
graph_node_id: "task-qa-source-sha256-scope"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","known-limit"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "qa_log の sha256 が何の指紋かを検査として固定する"
owners: ["daishiman"]
created_at: "2026-08-19T00:00:00Z"
updated_at: "2026-08-19T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests","system-spec","scripts"]
purpose: null
goal: null
mvp_alignment: {"background":"qa_log[].source.sha256 は answer 本文の指紋であって、出典文書の指紋ではない","mvp_fit":"enabling","purpose":"一致 23 件 / 欄なし 6 件 / 不一致 0 件 / 読むコード 0 件 を、いまの事実として検査で固定する","rationale":"出典の指紋だと読み違えると、出典が差し替わっても気づけない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-qa-source-sha256-scope.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "single standalone task, no feature package"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-qa-source-sha256-scope.md","confidence":0.9}]
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

`qa_log[].source.sha256` が何の指紋なのかを、いまの事実として検査で固定する。

## 背景

`system-spec/spec-state.json` の `qa_log[].source.sha256` は `answer` 本文から作られた指紋であって、出典文書の指紋ではない。名前が `source.sha256` なので「出典の指紋」と読める。出典の指紋だと読み違えると、出典が差し替わっても気づけないのに気づいたつもりになる。

実測 (2026-08-19): `answer` 本文の指紋と一致 23 件 / `source` 欄なし 6 件 / 不一致 0 件。この `sha256` を読んで何かを判定しているコードは 0 件。

## 入力と前提条件

- 入力: `system-spec/spec-state.json` の `qa_log`
- 前提: 確定章と正本のガードにより `spec-state.json` を直接書き換えない。読むだけ
- 前提: この課題は閉じない。出典の指紋を持てるようになるまで開いたまま残す

## 出力と成果物

- 生成物: 上記 4 つの数を固定する検査 1 本
- 更新対象: `tests/`

## 依存関係

- depends_on: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A: `spec-state.json` は読むだけ
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: `sha256` が指しているものを、名前ではなく実測で書く

## Write scope と競合制約

- touches: tests/
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
- Publication gate: 検査が緑であること
- Failure policy: local のまま残す
- Completion policy: manual
- PR linkage requirement: 本文に Beads ID と dev-graph: task-qa-source-sha256-scope を書く
- Closed without merge: keep_active
- Local reconciliation: 手動

## status の意味論 (二重正本の禁止)

frontmatter の status は文書ライフサイクルのみ。実行状態は Beads と completion_evidence を正本とする。

## 実行手順

1. `qa_log` の各 entry について、`source.sha256` と `answer` 本文の sha256 を突き合わせる
2. 一致 / 欄なし / 不一致 の 3 つの数を出す
3. `sha256` を読んで判定に使っているコードを探し、件数を出す
4. 4 つの数を検査に書く。数が動いた日に赤くなる向きで書く
5. 検査の説明に「これは出典の指紋ではない」と、なぜ出典の指紋を持てないかを書く

## 受入条件

- [ ] 一致 23 件 / 欄なし 6 件 / 不一致 0 件 / 読むコード 0 件 が検査で固定されている
- [ ] `source.sha256` を 1 文字変えると検査が赤くなる
- [ ] 検査の説明から「`source.sha256` は answer の指紋である」と読める
- [ ] この課題は閉じずに開いたまま残っている

## 検証方法

- 自動検証: `pnpm run verify`
- 手動検証: `sha256` を 1 文字変えて赤を確認する。確認後は複製から書き戻す
- 証跡: 赤になったときの出力

## リスクとロールバック

- リスク: 数が動くたびに赤くなるため、数を書き換えて緑に戻す運用に流れる。それは閾値を下げるのと同じ。説明にその旨を書く
- ロールバック: 検査 1 本の追加なので revert で戻せる

## Handoff

- 実装 route: agent
- 次に利用するノード: なし
