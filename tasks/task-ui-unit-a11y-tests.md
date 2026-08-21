---
graph_node_id: "task-ui-unit-a11y-tests"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "画面の単体テストと読み上げの自動検査"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-17T02:21:11.777000Z"
status: "done"
depends_on: ["task-test-foundation"]
related_nodes: []
resource_scope: ["tests/ui"]
purpose: null
goal: null
mvp_alignment: {"background":"画面ごとに手で確かめており、増えるほど確認が抜けていた","mvp_fit":"enabling","purpose":"画面 50 枚を総当たりで描画し、4 状態・操作・読み上げを見る","rationale":"画面は増え続けるので、総当たりの仕組みでないと網羅が崩れる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-ui-unit-a11y-tests.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-ui-unit-a11y-tests.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-xct","github_mirror":null,"linked_at":"2026-08-17T02:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T02:20:00Z","evidence_refs":["tasks/task-ui-unit-a11y-tests.md","docs/product/traceability.md"],"policy":"manual","reconciled_at":"2026-08-17T02:20:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-17T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

画面 50 枚を総当たりで描画し、4 状態・操作・読み上げを見る

経路の表から画面 50 枚を総当たりで描画し、4 つの状態・キーボード操作・フォーカス・読み上げ（axe）を見る。表に無い画面はファイル一覧との突合で落ちる。
配色 5 種 × 明暗 2 種のコントラストも総当たり済み。

## 背景

画面ごとに手で確かめており、増えるほど確認が抜けていた

MVP 適合度は `enabling`。画面は増え続けるので、総当たりの仕組みでないと網羅が崩れる

## 入力と前提条件

- 入力: `docs/product/backlog.md` の該当項目、`docs/product/traceability.md` の REQ-TS05 / REQ-TS06
- 前提: 先行タスク `task-test-foundation` が完了していること

## 出力と成果物

- 生成物: `tests/ui/route-table.ts`
- 生成物: `画面総当たりテスト`
- 更新対象: `docs/product/traceability.md`（該当行の `test` 欄と `結果` 欄）

## 依存関係

- `depends_on`: `task-test-foundation`
- ブロッカー: なし

## 実装対象

- Frontend: 画面の描画テストを含む
- Backend/API: N/A: 入口を変更しない
- Database/Data: N/A: データの形を変更しない
- Infrastructure: N/A: 基盤を変更しない
- Security/Privacy: 秘密情報は AI が読める場所へ置かない。値は利用者本人がブラウザまたは別の端末から登録する
- Documentation: `docs/product/traceability.md` と `docs/product/backlog.md` を同じ変更の中で更新する

## Write scope と競合制約

- `touches`: `tests/ui`
- 排他資源: `docs/product/traceability.md`（同時に複数の作業で書き換えない）
- 並列実行条件: 触るディレクトリが重ならないこと
- branch: 1 作業 1 ブランチ（`main` へ直接コミットしない）
- worktree lease: 着手前に `graph_node_id` を claim する
- completion projection: 作業ブランチでは着手の記録だけを残し、既定ブランチへの反映時に完了を書く

## GitHub publication

- mode: `local_only`（追跡は Beads。GitHub Issue へは投影しない）
- labels: なし

## 実行手順

1. `bd update <id> --claim` で着手を記録する
2. **テストを先に書く**（後からまとめて書かない）
3. 実装する
4. `pnpm run verify` を通す
5. `docs/product/traceability.md` の該当行を、走らせた結果で書き換える
6. `bd close <id>`

## 受入条件

- REQ-TS05 / REQ-TS06 の行が、証拠つきで実装済になる
- **証拠のない `PASS` を書かない**（走らせた結果が出た行だけを書き換える）
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
pnpm test tests/ui（画面 50 枚 × 4 状態 + axe）
```

## リスクとロールバック

経路の表と実ファイルの突合が無いと、表に載せ忘れた画面が検査されない。突合は同じテストで行う。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
