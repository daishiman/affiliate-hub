---
graph_node_id: "task-coverage-gates"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "カバレッジの計測・閾値・層別の記録"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-17T02:21:38.183422Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["quality-gates.config.mjs","scripts/coverage-report.mjs","docs/product/coverage.md"]
purpose: null
goal: null
mvp_alignment: {"background":"全体の 1 つの数字だけでは、薄い層が濃い層に隠れる","mvp_fit":"enabling","purpose":"テストが届いている割合を、層別とスタブ除外の実質で記録する","rationale":"数字合わせを見抜くには、層別と実質の併記が要る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-coverage-gates.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-coverage-gates.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-0kc","github_mirror":null,"linked_at":"2026-08-17T02:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T02:20:00Z","evidence_refs":["tasks/task-coverage-gates.md","docs/product/traceability.md"],"policy":"manual","reconciled_at":"2026-08-17T02:20:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-17T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

テストが届いている割合を、層別とスタブ除外の実質で記録する

閾値は `quality-gates.config.mjs` の 1 か所。`docs/product/coverage.md` は生成物。
2026-08-17 実測: 全体 行 91.2% / 分岐 80.4% / 関数 86.5% / 文 89.2%。
**閾値は 1 度も下げていない**（下限 80 のまま、テストを足して越えた）。

## 背景

全体の 1 つの数字だけでは、薄い層が濃い層に隠れる

MVP 適合度は `enabling`。数字合わせを見抜くには、層別と実質の併記が要る

## 入力と前提条件

- 入力: `docs/product/backlog.md` の該当項目、`docs/product/traceability.md` の REQ-TS10
- 前提: 追加の前提なし

## 出力と成果物

- 生成物: `quality-gates.config.mjs`
- 生成物: `scripts/coverage-report.mjs`
- 生成物: `docs/product/coverage.md`
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

- `touches`: `quality-gates.config.mjs`
- `touches`: `scripts/coverage-report.mjs`
- `touches`: `docs/product/coverage.md`
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

- REQ-TS10 の行が、証拠つきで実装済になる
- **証拠のない `PASS` を書かない**（走らせた結果が出た行だけを書き換える）
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
pnpm run verify → scripts/coverage-report.mjs が docs/product/coverage.md を生成
```

## リスクとロールバック

**閾値を下げて緑にすることは禁止**。数字が足りないときはテストを足す。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
