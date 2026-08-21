---
graph_node_id: "task-publication-usecase"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "distribution"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "配信を作る入口（ユースケース）が無い"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-17T08:00:40.472573Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["src/application/usecases","src/presentation"]
purpose: null
goal: null
mvp_alignment: {"background":"1 周の結合テストで判明。domain を呼んでいるのは見本データの組み立てだけ","mvp_fit":"direct","purpose":"記事の進行画面から「この記事をここへ出す」を開始できるようにする","rationale":"承認から先へ進めるのが、いまは見本にある配信を動かす操作だけになっている"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-publication-usecase.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-publication-usecase.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-cp8","github_mirror":null,"linked_at":"2026-08-17T02:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T00:00:00Z","evidence_refs":["docs/product/backlog.md#26"],"policy":"manual","reconciled_at":"2026-08-17T08:25:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

記事の進行画面から「この記事をここへ出す」を開始できるようにする

1 周のテストは domain を直接呼んで代用しており、その旨をテスト内に明記してある。
記事の進行画面から配信を作る操作と一緒に入れる。

## 背景

1 周の結合テストで判明。domain を呼んでいるのは見本データの組み立てだけ

MVP 適合度は `direct`。承認から先へ進めるのが、いまは見本にある配信を動かす操作だけになっている

## 入力と前提条件

- 入力: `docs/product/backlog.md` の該当項目、`docs/product/traceability.md` の —（追跡表 A/B 節の配信）
- 前提: 追加の前提なし

## 出力と成果物

- 生成物: `配信を作るユースケース`
- 生成物: `記事の進行画面からの操作`
- 更新対象: `docs/product/traceability.md`（該当行の `test` 欄と `結果` 欄）

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: 画面の描画テストを含む
- Backend/API: 入口 3 種を通す
- Database/Data: N/A: データの形を変更しない
- Infrastructure: N/A: 基盤を変更しない
- Security/Privacy: 秘密情報は AI が読める場所へ置かない。値は利用者本人がブラウザまたは別の端末から登録する
- Documentation: `docs/product/traceability.md` と `docs/product/backlog.md` を同じ変更の中で更新する

## Write scope と競合制約

- `touches`: `src/application/usecases`
- `touches`: `src/presentation`
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

- —（追跡表 A/B 節の配信） の行が、証拠つきで実装済になる
- **証拠のない `PASS` を書かない**（走らせた結果が出た行だけを書き換える）
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
tests/integration/full-loop.test.ts が domain 直呼びを使わずに通ること
```

## リスクとロールバック

いまのテストは domain を直接呼んで代用しており、その旨をテスト内に明記してある。消さない。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
