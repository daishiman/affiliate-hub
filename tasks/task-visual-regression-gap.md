---
graph_node_id: "task-visual-regression-gap"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["testing","known-limit"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "見た目の崩れを自動で見つける手段が無いことを検査として固定する"
owners: ["daishiman"]
created_at: "2026-08-19T00:00:00Z"
updated_at: "2026-08-19T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests","quality-gates.config.mjs"]
purpose: null
goal: null
mvp_alignment: {"background":"描画結果の画像比較が無く、余白や重なりの崩れは人の目でしか見つからない","mvp_fit":"enabling","purpose":"塞げない穴を文章ではなく検査として書き、塞がった日に赤くなって知らせる形にする","rationale":"本文に「塞げていません」と書くだけでは、塞がった日にも古く見えないまま残る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-visual-regression-gap.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "single standalone task, no feature package"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-visual-regression-gap.md","confidence":0.9}]
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

「見た目の崩れを自動で見つける手段が無い」ことを、文章ではなく検査として固定する。

## 背景

描画結果を画像で比べる手段が無く、余白の重なり・はみ出し・折り返しの崩れは人の目でしか見つからない。この限界は現状 `decisions[]` と残課題の本文にしか書かれていない。本文に「塞げていません」と書いただけの記述は、塞がった日にも古く見えないまま残る (`bd remember` の教訓)。代わりに「崩れが通ってしまうこと自体」を検査にすると、塞がった日にその検査が赤くなって知らせる。

## 入力と前提条件

- 入力: 現行のテスト構成 (Vitest / jsdom)、`quality-gates.config.mjs`
- 前提: この検査は限界を監視するものであり、崩れを見つけるものではない。名前と説明でそう分かるようにする
- 前提: Playwright を足す判断は `decision-test-ci-tooling` で保留中。ここでは足さない

## 出力と成果物

- 生成物: 限界を固定する検査 1 本
- 更新対象: `tests/architecture/`

## 依存関係

- depends_on: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A: 表示は変えない
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 塞げない理由を「難しいから」ではなく「この作業場所の約束と両立しないから」の形で書く

## Write scope と競合制約

- touches: tests/architecture/ quality-gates.config.mjs
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
- PR linkage requirement: 本文に Beads ID と dev-graph: task-visual-regression-gap を書く
- Closed without merge: keep_active
- Local reconciliation: 手動

## status の意味論 (二重正本の禁止)

frontmatter の status は文書ライフサイクルのみ。実行状態は Beads と completion_evidence を正本とする。

## 実行手順

1. 描画結果を画像で比べる仕組みが構成に存在しないことを、実測で確かめる (依存・設定・スクリプトの 3 箇所)
2. 「存在しない」をそのまま検査にする。存在するようになった日に赤くなる向きで書く
3. 検査の説明に、なぜ塞げないか (画像の基準を打つ場面が決まっていない) を書く
4. 壊して測る: 画像比較の仕組みを 1 つ足した状態を作り、検査が赤くなることを確認する。確認後は複製から書き戻す

## 受入条件

- [ ] 検査が現状で緑である
- [ ] 画像比較の仕組みを足すと検査が赤くなることを、実際に足して確認してある
- [ ] 検査の名前と説明から「これは限界の監視であって崩れの検出ではない」と読める
- [ ] 塞げない理由が「この作業場所の約束と両立しないから」の形で書かれている

## 検証方法

- 自動検証: `pnpm run verify`
- 手動検証: 壊して赤を確認する
- 証跡: 赤になったときの出力

## リスクとロールバック

- リスク: 「崩れを検査している」と読み違えられる。名前と説明で防ぐ
- ロールバック: 検査 1 本の追加なので revert で戻せる

## Handoff

- 実装 route: agent
- 次に利用するノード: なし
