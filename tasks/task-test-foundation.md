---
graph_node_id: "task-test-foundation"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "テストの土台（ファクトリ・テストダブル・時刻固定・描画補助）"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-17T02:21:00.997420Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["tests/support"]
purpose: null
goal: null
mvp_alignment: {"background":"型に項目を 1 つ足すたびに全テストを直す状態だった","mvp_fit":"enabling","purpose":"テストの書き換え箇所を 1 か所に閉じる","rationale":"15〜17 のテストがすべてこの土台の上に乗るため、先に無いと重複が増える"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-test-foundation.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-test-foundation.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-oq7","github_mirror":null,"linked_at":"2026-08-17T02:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T02:20:00Z","evidence_refs":["tasks/task-test-foundation.md","docs/product/traceability.md"],"policy":"manual","reconciled_at":"2026-08-17T02:20:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-17T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

テストの書き換え箇所を 1 か所に閉じる

`tests/support/` に `factories.ts` / `doubles.ts` / `render.ts` を置いた。
型に項目を 1 つ足したときの書き換えを 1 箇所に閉じてある。
差し替え側で Editorial / Commercial の印が黙って消える不具合をここで検出して直した。

## 背景

型に項目を 1 つ足すたびに全テストを直す状態だった

MVP 適合度は `enabling`。15〜17 のテストがすべてこの土台の上に乗るため、先に無いと重複が増える

## 入力と前提条件

- 入力: `docs/product/backlog.md` の該当項目、`docs/product/traceability.md` の REQ-TS01
- 前提: 追加の前提なし

## 出力と成果物

- 生成物: `tests/support/factories.ts`
- 生成物: `tests/support/doubles.ts`
- 生成物: `tests/support/render.ts`
- 更新対象: `docs/product/traceability.md`（該当行の `test` 欄と `結果` 欄）

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A: 画面を変更しない
- Backend/API: N/A: 入口を変更しない
- Database/Data: N/A: データの形を変更しない
- Infrastructure: N/A: 基盤を変更しない
- Security/Privacy: 秘密情報は AI が読める場所へ置かない。値は利用者本人がブラウザまたは別の端末から登録する
- Documentation: `docs/product/traceability.md` と `docs/product/backlog.md` を同じ変更の中で更新する

## Write scope と競合制約

- `touches`: `tests/support`
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

- REQ-TS01 の行が、証拠つきで実装済になる
- **証拠のない `PASS` を書かない**（走らせた結果が出た行だけを書き換える）
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
pnpm test tests/support 経由の全テスト（土台を使う側が落ちれば検出）
```

## リスクとロールバック

土台が誤ると全テストが同じ方向に誤る。差し替えで Editorial / Commercial の印が黙って消える不具合が実際に起きたため、印の付き方はテストで固定してある。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
