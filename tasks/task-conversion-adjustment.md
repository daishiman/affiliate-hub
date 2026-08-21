---
graph_node_id: "task-conversion-adjustment"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "monetization"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "成果の金額の修正を D1 へ保存し、画面から直せるようにする"
owners: ["daishiman"]
created_at: "2026-08-17T09:00:00Z"
updated_at: "2026-08-17T09:19:14.295618Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["src/db","src/infrastructure/persistence","src/presentation/admin","drizzle"]
purpose: null
goal: null
mvp_alignment: {"background":"成果の保存先が見本データのままで、金額の修正は道具の口からしか呼べず、画面には「直せます」と書いてあるのに入力欄が無い","mvp_fit":"direct","purpose":"成果の金額を手で直した結果が、次に開いたときも残るようにする","rationale":"直したのに戻る状態は、操作が効いていないのか保存が壊れているのかを画面から見分けられない。ASP の資格が要るのは取り込みだけで、修正の保存には要らない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-conversion-adjustment.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T09:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/stub-ledger.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/stub-ledger.md のスタブ解除を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-conversion-adjustment.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T09:18:53Z","evidence_refs":["tests/integration/d1-conversion.test.ts","tests/infrastructure/d1-conversion-repository.test.ts","tests/ui/adjust-conversion-form.test.tsx","tests/presentation/admin-actions.test.ts","drizzle/0010_tired_adam_warlock.sql","src/infrastructure/persistence/d1/conversion-repository.ts","docs/product/backlog.md#39"],"policy":"manual","reconciled_at":"2026-08-17T09:20:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

成果の金額を手で直した結果が、次に開いたときも残るようにする。

## 背景

成果（`Conversion`）の保存先は見本データのままで、`adjustReward` を呼ぶ
`adjust_conversion_reward` は**道具の口（`/api/tools`）からしか呼べない**。
その口は `MCP_TOKEN` 未設定で閉じているため、いまは誰も直せない。

さらに `/admin/affiliate/<成果>` の「金額を直す」の枠には
「この成果の金額は直せます」と書いてあるのに**入力欄が無い**。
記事の進行（`task-content-persistence`）で見つけたのと同じ壊れ方で、
保存先と入口のどちらが欠けても、画面からは操作が効かない理由が分からない。

ASP の資格が要るのは**取り込み**であって、直した結果の保存には要らない。

MVP 適合度は `direct`。

## 入力と前提条件

- 入力: `docs/product/stub-ledger.md`、`src/application/usecases/monetization/manage-affiliate.ts`
- 前提: D1 の接続はあり、配信・記事で同じ形の差し替えを済ませている

## 出力と成果物

- 生成物: `conversions` テーブルとマイグレーション
- 生成物: `src/infrastructure/persistence/d1/conversion-repository.ts`
- 生成物: `tests/integration/d1-conversion.test.ts`
- 生成物: 成果の画面から金額を直す欄（サーバーアクションと入力欄）
- 更新対象: `docs/product/traceability.md` / `docs/product/backlog.md` / `docs/product/stub-ledger.md`

## 依存関係

- `depends_on`: なし
- ブロッカー: なし（直した結果の保存に外部の資格は要らない。取り込みだけが資格待ち）

## 実装対象

- Frontend: 「金額を直す」の枠に入力欄を置く。直せないときは欄を消さず理由を出す
- Backend/API: 既にある `createAdjustConversionUseCase` を画面から呼ぶ（4 つ目の入口）
- Database/Data: `conversions` を追加する。提携先・提携条件・リンクは**取り込みの入口が無いので足さない**
- Infrastructure: N/A: 基盤を変更しない
- Security/Privacy: 締め済み期間は直せない、という判定は application のまま動かさない
- Documentation: 台帳の解除条件から、済んだ条件を落とす

## Write scope と競合制約

- `touches`: `src/db`
- `touches`: `src/infrastructure/persistence`
- `touches`: `src/presentation/admin`
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
4. 保存先の実装を書き、組み立ての 1 行を差し替える（見本は消さずに重ねる）
5. 画面に入力欄とサーバーアクションを足す
6. `pnpm run verify` を通す
7. Workers ランタイム（`pnpm run preview`）で画面を確かめる
8. 追跡表・残課題リスト・台帳を更新して閉じる

## 受入条件

- 直した金額を**読み直して**確かめられる（返り値だけで判定しない）
- **取り込んだ額が書き換わらない**（直した額は別の欄に入る）
- 締め済みの期間は直せず、理由が読める言葉で返る
- 直せない理由は、押す前と押した後で同じ言葉になる
- **証拠のない `PASS` を書かない**
- `pnpm run verify` が緑になる（**閾値を下げて緑にすることは禁止**）

## 検証方法

次を走らせ、終了コードと件数で判定する。画面の目視だけで済ませない。

```bash
pnpm exec vitest run tests/integration/d1-conversion.test.ts
pnpm run verify
```

あわせて、保存先の差し替えをわざと戻して赤くなることを確認する。

## リスクとロールバック

見本の成果を消すと、一覧が空になり「まだ成果が無い」のか「壊れている」のかを
見分けられなくなる。見本は消さずに重ね、**同じ id なら保存されたほうを勝たせる**。

戻し方: この作業単位のコミットを打ち消せば元に戻る（履歴が唯一の正本）。

## Handoff

完了後は `docs/product/traceability.md` の集計と `docs/product/backlog.md` の状態欄を Beads に合わせる。
**このファイルから先に書き換えない**（作業単位の正本は Beads）。
