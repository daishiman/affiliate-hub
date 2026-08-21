---
graph_node_id: "task-signed-in-actor-for-mutations"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "security"
tags: ["security","identity"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "変更を起こす操作 17 個が、身元を確かめずに見本へ落ちる"
owners: ["daishiman"]
created_at: "2026-08-18T06:30:00Z"
updated_at: "2026-08-18T06:30:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"入口の門(src/middleware.ts)で管理画面 32 枚は塞がったが、台帳の「開いている扉」は変更操作 17 個が残っている。変更操作は独立した URL を持たず、それを使う画面への POST として届くため、matcher を変えたり操作を別の画面へ移すと守りが黙って外れる","mvp_fit":"enabling","purpose":"変更を起こす操作 17 個が currentActor() ではなく signedInActor() を使い、身元が無いときに見本へ落ちずに断るようにする","rationale":"currentActor() は身元を解決できないと見本の身元へ落ちる。門の内側にあることを前提にせず、操作そのものが断れる状態にして初めて台帳の 17 件が減る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-signed-in-actor-for-mutations.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T06:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/open-doors.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "入口の門を置いても、変更操作は独立した URL を持たないため台帳から外れない"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-signed-in-actor-for-mutations.md","confidence":0.9}]
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

**変更を起こす操作 17 個が、身元を確かめずに動く状態をやめる。**
`currentActor()`（解決できないと見本の身元へ落ちる）から
`signedInActor()`（落ちずに `null` を返す）へ移し、身元が無ければ操作そのものが断る。

## 背景

2026-08-18 に入口の門（`src/middleware.ts`）を置き、管理画面 32 枚は
通行証が無ければ開けなくなった（開いている扉 49 → 17）。

**残る 17 件は変更を起こす操作である。**これらは実際には門の内側にあるが、
台帳（`docs/product/open-doors.md`）は危ない方に倒して数えてある。理由は 2 つ。

1. どの操作がどの画面から呼ばれるかは、コードから測れない
2. 変更操作（`"use server"`）は**独立した URL を持たない**。それを使っている画面への
   POST として届くので、`matcher` を変えたり操作を別の画面へ移すと
   **入口の守りは黙って外れる**（Next.js の docs にも同じ注意がある）

つまり入口の門は、この 17 件の代わりにはならない。

## 入力と前提条件

- `signedInActor()` は `src/presentation/composition.ts` に既にある
- `currentActor()` は解決できないと**見本の身元へ落ちる**。これがこの課題の原因である
- 入口の門（`entry-gate.ts`）は**役を見ない**。「何をしてよいか」は各操作が断る側に置く

## 出力と成果物

1. 変更を起こす 17 個の操作が `signedInActor()` を使う
2. 身元が無いときの断り文（「権限がありません」ではなく、まずログインへ）
3. 台帳の「開いている扉」が 17 件から減る
4. `OPEN_DOORS_MAX_UNGUARDED` を、減った実測値まで**下げる**

## 依存関係

入口の門（`src/middleware.ts`、2026-08-18 に設置済み）。
`ah-361`（ログインの導入）。鍵の登録は不要（判定だけの変更のため）。

## 実装対象

- `src/app/admin/**/actions.ts`（変更を起こす操作）
- `src/presentation/composition.ts`（`signedInActor()` の利用側）
- `tests/architecture/open-doors.test.ts`（台帳の実測）

## Write scope と競合制約

`src/app/admin/`、`src/presentation/`、`tests/`。
`src/middleware.ts` と `src/infrastructure/identity/entry-gate.ts` は触らない。

## GitHub publication

`local_only`。

## 実行手順

1. 台帳の「開いている扉」17 件を一覧で出す
2. 1 件ずつ `signedInActor()` へ移し、身元が無い場合の分岐を書く
3. 断る側のテストを先に書く（**通る側だけ書くと、止まることが一度も確かめられない**）
4. 台帳を再生成し、上限を実測値まで下げる

## 受入条件

- 身元が無いとき、17 個の操作がいずれも変更を起こさない
- 断り文が出ることをテストで固定してある（無言で失敗しない）
- 台帳の「開いている扉」が減り、`OPEN_DOORS_MAX_UNGUARDED` も同じ数まで下がっている

## 検証方法

`pnpm run preview` で、通行証を持たない状態から変更操作への POST を投げ、
変更が起きないことを見る。`pnpm run verify` の 11 門が緑であること。

## リスクとロールバック

危ないのは、**上限を上げて緑にする**ことである。上限は下げる方向にしか動かさない。
もう 1 つは、断り文を出さずに黙って何も起きない状態にすること
（利用者はもう一度押してよいか分からない）。

## Handoff

入口の門は「ログインしているか」だけを見る。**役の判定をそちらへ足さない。**
同じ判定を 2 か所に置くと必ず食い違い、そのとき浅い方（入口）が先に古くなる。

## 規範

- `src/infrastructure/identity/entry-gate.ts` 冒頭（入口と奥で判定を分けた理由）
- `docs/product/open-doors.md`（いま何が開いているかの台帳）
- `quality-gates.config.mjs`（`OPEN_DOORS_MAX_UNGUARDED` の経緯）
