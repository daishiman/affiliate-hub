---
graph_node_id: "task-distribution-persistence"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "distribution"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "配信の予約を D1 へ保存する"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-17T08:00:15.303885Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["src/db","src/infrastructure/persistence","drizzle"]
purpose: null
goal: null
mvp_alignment: {"background":"配信の予約はこの場限りで、処理が終わると消えていた","mvp_fit":"direct","purpose":"予約・取りやめ・予定日の変更が次に開いても残るようにする","rationale":"消えたのか、まだ出していないのかを画面から見分けられない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-distribution-persistence.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-distribution-persistence.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T08:20:00Z","evidence_refs":["tests/integration/d1-distribution.test.ts","drizzle/0008_damp_xorn.sql","src/infrastructure/persistence/d1/distribution-repository.ts","docs/product/backlog.md#37"],"policy":"manual","reconciled_at":"2026-08-17T08:20:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

配信の予約・取りやめ・予定日の変更が、次に開いたときも残るようにする。

## 背景

配信の記録はこの場限り（処理が終わると消える）だった。予約したのに一覧に無い状態は、
画面からは「まだ出していない」のか「消えた」のかを見分けられない。
`schedule_publication` の入口が入った直後（`task-publication-usecase`）に、保存先が無いままだと
入口だけが空回りするため、続けてつなぐ。

MVP 適合度は `direct`。

## 入力と前提条件

- 入力: `docs/product/backlog.md` 項目 37、`docs/product/traceability.md` の配信の行
- 前提: D1 の接続はすでにあり、`site_blueprints` / `link_ingestions` で同じ形の差し替えを済ませている

## 出力と成果物

- 生成物: `channel_connections` / `publications` テーブルとマイグレーション
- 生成物: `src/infrastructure/persistence/d1/distribution-repository.ts`
- 生成物: `tests/integration/d1-distribution.test.ts`
- 更新対象: `docs/product/traceability.md` / `docs/product/backlog.md` / `docs/product/stub-ledger.md`

## 依存関係

- `depends_on`: `task-publication-usecase`（入れる口が先に要る）
- ブロッカー: なし（各サービスへの実際の投稿は認証が要るが、保存は認証に依存しない）

## 実装対象

- Frontend: 画面の但し書きを「保存されるか」「投稿されるか」の 2 段で出す
- Backend/API: 保存先の差し替えのみ。ユースケースと画面は変えない
- Database/Data: 表を 2 つ追加する。**冪等キーに一意制約を付けない**
- Infrastructure: N/A: 基盤を変更しない
- Security/Privacy: 接続の認証情報そのものは持たない（参照だけを持つ）
- Documentation: 台帳の解除条件から、済んだ条件（テーブルの追加）を落とす

## Write scope と競合制約

- `touches`: `src/db`
- `touches`: `src/infrastructure/persistence`
- `touches`: `drizzle`
- 排他資源: `docs/product/traceability.md`（同時に複数の作業で書き換えない）
- 並列実行条件: 触るディレクトリが重ならないこと
- branch: 1 作業 1 ブランチ（`main` へ直接コミットしない）
- worktree lease: 着手前に `graph_node_id` を claim する
- completion projection: 既定ブランチへの反映時に完了を書く

## GitHub publication

- mode: `local_only`（追跡は Beads。GitHub Issue へは投影しない）
- labels: なし

## 実行手順

1. 着手を記録する
2. **テストを先に書く**（後からまとめて書かない）
3. 表とマイグレーションを足す
4. 保存先の実装を書き、組み立ての 2 行を差し替える
5. `pnpm run verify` を通す
6. Workers ランタイム（`pnpm run preview`）で画面を確かめる
7. 追跡表・残課題リスト・台帳を更新して閉じる

## 受入条件

- 予約したものを**読み直して**確かめられる（返り値だけで判定しない）
- 同じ予約の 2 回目が失敗にならず「すでにあります」で返る
- 取りやめが保存され、読み直しても見本の状態に戻らない
- **証拠のない `PASS` を書かない**
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
pnpm exec vitest run tests/integration/d1-distribution.test.ts
pnpm run verify
```

あわせて、保存先の差し替えをわざと戻して赤くなることを確認する。

## リスクとロールバック

見本を消すと、まだ 1 件も予約していない状態で一覧とカレンダーが空になり、
「まだ出していない」のか「壊れている」のかを見分けられなくなる。だから見本は消さずに重ね、
**同じ id なら保存されたほうを勝たせる**（取りやめが元に戻らないようにするため）。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。表は残るが、
組み立てが見本に戻るので動きは元どおりになる。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
