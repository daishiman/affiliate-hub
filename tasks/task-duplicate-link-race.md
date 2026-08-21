---
graph_node_id: "task-duplicate-link-race"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "ingestion"
tags: ["backlog","mvp"]
priority: "low"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "同時に同じリンクを貼ったときの重複の取りこぼし"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-17T02:21:55.000818Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/application/usecases","drizzle"]
purpose: null
goal: null
mvp_alignment: {"background":"一意索引を落とした代わりに、同時に入れると印が付かず 2 行入る","mvp_fit":"deferred","purpose":"2 人が同時に同じ URL を入れたときに重複の印を付ける","rationale":"表示上の取りこぼしであってデータの破損ではない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-duplicate-link-race.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-duplicate-link-race.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-q0h","github_mirror":null,"linked_at":"2026-08-17T02:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

2 人が同時に同じ URL を入れたときに重複の印を付ける

一意のままだと「重複していても受け取る」という受信箱の決めごとと食い違い、2 回目の貼り付けがやり直しても永久に通らない失敗になっていた。
直すなら保存時に読み直して印を付け直す処理が要る。

## 背景

一意索引を落とした代わりに、同時に入れると印が付かず 2 行入る

MVP 適合度は `deferred`。表示上の取りこぼしであってデータの破損ではない

## 入力と前提条件

- 入力: `docs/product/backlog.md` の該当項目、`docs/product/traceability.md` の —
- 前提: 追加の前提なし

## 出力と成果物

- 生成物: `受信箱の保存処理`
- 更新対象: `docs/product/traceability.md`（該当行の `test` 欄と `結果` 欄）

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A: 画面を変更しない
- Backend/API: 入口 3 種を通す
- Database/Data: 実際の D1 とマイグレーションを使う
- Infrastructure: N/A: 基盤を変更しない
- Security/Privacy: 秘密情報は AI が読める場所へ置かない。値は利用者本人がブラウザまたは別の端末から登録する
- Documentation: `docs/product/traceability.md` と `docs/product/backlog.md` を同じ変更の中で更新する

## Write scope と競合制約

- `touches`: `src/application/usecases`
- `touches`: `drizzle`
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

- — の行が、証拠つきで実装済になる
- **証拠のない `PASS` を書かない**（走らせた結果が出た行だけを書き換える）
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
同時に同じ URL を貼る結合テストを足して判定する
```

## リスクとロールバック

一意索引に戻すと、2 回目の貼り付けが永久に通らない失敗に戻る。戻さない。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
