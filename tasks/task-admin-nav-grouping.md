---
graph_node_id: "task-admin-nav-grouping"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["admin-ui","information-design"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "管理画面の横並び 19 項目を分類にまとめる"
owners: ["daishiman"]
created_at: "2026-08-19T00:00:00Z"
updated_at: "2026-08-19T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation","src/app","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"ADMIN_NAV が分類なしの 19 項目で、目的の違う画面が同じ重さで並んでいる","mvp_fit":"direct","purpose":"素材/書く/出す/稼ぐ/見る/整える の分類を入れて、探す前に見当がつく状態にする","rationale":"利用者が今日その場で指摘した状態であり、放置すると一番古くなりやすい"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-admin-nav-grouping.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "single standalone task, no feature package"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-admin-nav-grouping.md","confidence":0.9}]
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

管理画面の横並び 19 項目を、目的ごとの分類にまとめる。探す前に見当がつく状態にする。

## 背景

`ADMIN_NAV` は分類なしの 19 項目で、目的の違う画面が同じ重さで並んでいる。19 個を上から順に読まないと目的の画面へ辿り着けない。利用者が 2026-08-19 にその場で指摘した状態であり、放置すると一番古くなりやすい。

## 入力と前提条件

- 入力: `src/presentation` の app shell、`ADMIN_NAV` の現行 19 項目、各画面の実際の用途
- 前提: 項目を減らさない。分類を足すだけで、行ける画面の集合は変えない
- 前提: 権限で見えない項目がある画面構成である

## 出力と成果物

- 生成物: 分類表 (実装から独立した正本)、分類つきサイドバー、分類の検査
- 更新対象: `src/presentation` の app shell、`tests/`

## 依存関係

- depends_on: なし
- ブロッカー: なし

## 実装対象

- Frontend: サイドバーを分類つきの見出し + 項目に変える。読み上げでも分類が伝わる印を付ける
- Backend/API: N/A: API 変更なし
- Database/Data: N/A: スキーマ変更なし
- Infrastructure: N/A: デプロイ単位は変えない
- Security/Privacy: 権限で項目が全部消えた分類は、見出しごと消す。空の見出しから存在を推測させない
- Documentation: 分類の決め方を残す

## Write scope と競合制約

- touches: src/presentation/ src/app/ tests/
- 排他資源: サイドバーの実装ファイル 1 本
- 並列実行条件: `task-admin-card-density` と同じファイルを触る可能性があるため、同時に走らせない
- branch: feat/clean-architecture-skeleton
- worktree lease: 本 worktree で実行
- completion projection: manual

## GitHub publication

- Mode: local_only
- Project aliases: N/A: github.enabled=false
- Issue labels/milestone: N/A: Beads が実行管理
- Initial Project fields: N/A: GitHub Projects を使わない
- Publication gate: 検査が緑で、preview で分類が見えること
- Failure policy: local のまま残す
- Completion policy: manual
- PR linkage requirement: 本文に Beads ID と dev-graph: task-admin-nav-grouping を書く
- Closed without merge: keep_active
- Local reconciliation: 手動

## status の意味論 (二重正本の禁止)

frontmatter の status は文書ライフサイクルのみ。実行状態は Beads と completion_evidence を正本とする。

## 実行手順

1. 19 項目それぞれが「誰がどの場面で開くか」を 1 行で書き出す
2. その 1 行から分類を導く。分類名から項目を割り振らない
3. 分類表を、`ADMIN_NAV` とは別の場所に置く
4. サイドバーを分類つきに描き替える。見出しは読み上げ可能な要素にする
5. 検査を書く: 1 項目は必ず 1 分類だけに属する / 分類表と `ADMIN_NAV` の項目集合が一致する / 権限で空になった分類は見出しごと消える
6. preview (`localhost:8787`) で 1 周する

## 受入条件

- [ ] 19 項目すべてがどれか 1 つの分類に属し、2 つ以上には属さない
- [ ] 分類表が `ADMIN_NAV` から作られておらず、突き合わせる側に置かれている
- [ ] `ADMIN_NAV` から項目を 1 つ消すと、突き合わせの検査が赤くなる
- [ ] 権限で項目が全部消えた分類は、見出しごと表示されない
- [ ] 読み上げで分類の境目が伝わる (見た目の隙間だけで分けていない)

## 検証方法

- 自動検証: 上記の分類検査、`pnpm run verify`
- 手動検証: preview で分類の見え方を確認する
- 証跡: 検査の実行結果

## リスクとロールバック

- リスク: 分類表を `ADMIN_NAV` から作ってしまうと、項目が減ったことを検査が言えなくなる (残課題 78 と同型)
- ロールバック: 分類は表示だけの変更なので、revert で元の横並びへ戻せる

## Handoff

- 実装 route: agent
- 次に利用するノード: task-admin-card-density
