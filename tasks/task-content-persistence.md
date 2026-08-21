---
graph_node_id: "task-content-persistence"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "authoring"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "記事の進行と承認を D1 へ保存する"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-17T08:47:39.355797Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["src/db","src/infrastructure/persistence","src/application","drizzle"]
purpose: null
goal: null
mvp_alignment: {"background":"記事の進行（かんばんの位置）を保存する先がどこにも無かった","mvp_fit":"direct","purpose":"段階を進めた結果と承認が、次に開いたときも残るようにする","rationale":"進めたのに元の列に戻る状態は、操作が効いていないのか保存が壊れているのかを画面から見分けられない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-content-persistence.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-content-persistence.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T08:47:02Z","evidence_refs":["drizzle/0009_stiff_captain_stacy.sql","src/infrastructure/persistence/d1/content-repository.ts","src/application/usecases/content/manage-content.ts","src/presentation/admin/content-progress-action.ts","tests/integration/d1-content.test.ts","docs/product/backlog.md#38"],"policy":"manual","reconciled_at":"2026-08-17T08:50:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

記事の段階を進めた結果と、承認した結果が、次に開いたときも残るようにする。

## 背景

かんばんの現在地（`ContentState`）は、**見本データの中にしか存在していなかった**。
記事そのものの型（`ContentVariant`）は本文と点数しか持たず、つなぎ目（ポート）にも
現在地を保存する手段が無い。そのため `advance_content_state` は状態の妥当性だけを見て
**何も保存せずに成功を返して**いた。承認（`approve_content`）は保存を呼ぶが、
保存先が見本なので必ず断られる。

どちらも画面からは「操作が効いていない」のか「保存が壊れている」のかを区別できない。

MVP 適合度は `direct`。

## 入力と前提条件

- 入力: `docs/product/backlog.md`、`src/application/usecases/content/manage-content.ts`
- 前提: D1 の接続はあり、配信（`publications`）で同じ形の差し替えを済ませている

## 出力と成果物

- 生成物: `content_variants` テーブルとマイグレーション（現在地の列を含む）
- 生成物: `src/infrastructure/persistence/d1/content-repository.ts`
- 生成物: `tests/integration/d1-content.test.ts`
- 更新対象: `src/application/ports/authoring.ts`（現在地の読み書き）
- 更新対象: `docs/product/traceability.md` / `docs/product/backlog.md` / `docs/product/stub-ledger.md`

## 依存関係

- `depends_on`: `task-distribution-persistence`（配信が承認済み記事を参照するため、先に配信を通した）
- ブロッカー: なし（記事の保存に外部の資格は要らない）

## 実装対象

- Frontend: 但し書きを「保存されるか」の一段で出す（記事に外部サービスは絡まない）
- Backend/API: つなぎ目に現在地の読み書きを足し、段階を進める処理から保存を呼ぶ
- Database/Data: `content_variants` を追加する。企画・書き手は**作る入口が無いので足さない**
- Infrastructure: N/A: 基盤を変更しない
- Security/Privacy: 承認は人だけ、という判定は domain のまま動かさない
- Documentation: 台帳の解除条件から、済んだ条件を落とす

## Write scope と競合制約

- `touches`: `src/db`
- `touches`: `src/infrastructure/persistence`
- `touches`: `src/application`
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
3. つなぎ目に現在地の読み書きを足し、見本側を先に合わせる
4. 表とマイグレーションを足す
5. 保存先の実装を書き、組み立ての 1 行を差し替える
6. `pnpm run verify` を通す
7. Workers ランタイム（`pnpm run preview`）で画面を確かめる
8. 追跡表・残課題リスト・台帳を更新して閉じる

## 受入条件

- 進めた段階を**読み直して**確かめられる（返り値だけで判定しない）
- 承認が保存され、読み直しても未承認に戻らない
- 古い画面から前の段階を指定した操作は、黙って通らず理由が返る
- **証拠のない `PASS` を書かない**
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
pnpm exec vitest run tests/integration/d1-content.test.ts
pnpm run verify
```

あわせて、保存先の差し替えをわざと戻して赤くなることを確認する。

## リスクとロールバック

現在地をつなぎ目に足すため、見本側も同じ形へ合わせる必要がある。合わせ忘れると
かんばんの列が全部空になる。見本は消さずに重ね、**同じ id なら保存されたほうを勝たせる**
（進めた結果が次の読み出しで元へ戻らないようにするため）。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
