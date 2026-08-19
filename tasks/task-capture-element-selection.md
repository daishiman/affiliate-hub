---
graph_node_id: "task-capture-element-selection"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["a11y","ui","quality"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "台紙の黒塗りを、座標ではなく要素の一覧から選べるようにする"
owners: ["daishiman"]
created_at: "2026-08-19T08:00:00Z"
updated_at: "2026-08-19T08:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"82 でキーボードから座標を動かせるようにしたが、座標を動かす操作そのものが読み上げ利用者には届きにくい","mvp_fit":"enabling","purpose":"「3 番目の見出しを隠す」のように、座標を扱わずに黒塗りの対象を選べる道を用意する","rationale":"82 の本命はこちらだったが、撮る側から要素の一覧を渡す必要があり、82 より大きい"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-capture-element-selection.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T08:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "残課題 82 の実装時に本命として検討し、範囲が大きいと測って見送った案"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-capture-element-selection.md","confidence":0.9}]
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

**台紙（画面の写し）の黒塗りを、座標を扱わずに選べるようにする。**
「3 番目の見出しを隠す」「メールアドレスの欄を隠す」のように、
**要素の一覧から選ぶ**道を用意する。

## 背景

2026-08-19、残課題 82（台紙のキーボード操作）で**本命として検討し、見送った案**である。
82 では代わりに、矢印キーで位置の目印を動かして Enter で確定する道を実装した。

**見送った理由（測った事実。次に見る人は同じ測定をやり直さなくてよい）:**

`CaptureCanvas` が受け取っているのは **画像の data URL と `maskedElementCount` だけ**である。
どこに何の要素があるかを、この部品は**一切知らない**。
だから要素の一覧から選ばせるには、**撮る側（画面を写している側）から要素の一覧と
その位置を渡す経路を新たに通す**必要がある。**82 より大きい。**

**82 で実装した道が無駄になるわけではない。**
座標で置く道は、要素になっていないもの（画像の中の文字、表の一部）にも効く。
この課題は**それを置き換えるのではなく、要素になっているものに近道を足す**ものである。

## 入力と前提条件

- `src/presentation/ui/patterns/capture-canvas.tsx`（いまは data URL と件数しか受け取らない）
- 画面を写している側（`maskedElementCount` を数えている場所）
- 82 で入れたキーボード操作（残す。置き換えない）

## 出力と成果物

- 要素の一覧を台紙まで運ぶ経路
- 一覧から選んで黒塗りにする操作
- 選んだ結果が `onExport` の `redactionCount` に入ること

## 依存関係

残課題 82（済）。この課題は 82 の上に乗る。

## 実装対象

`src/presentation/ui/patterns/capture-canvas.tsx` と、その呼び出し側。

## Write scope と競合制約

`src/presentation/`、`tests/ui/`。

## 実行手順

1. 撮る側が要素の一覧（名前と位置）を持てるかを確かめる。**持てないなら、ここで止まる**
2. 一覧の運び方を決める（props で渡すのか、撮る時点で焼くのか）
3. 一覧から選ぶ操作を足す。**82 の座標の道は残す**
4. 選んだ結果が写しに焼き込まれ、件数に入ることをテストで固定する

## 受入条件

- 座標を 1 度も動かさずに、黒塗りを 1 つ確定できる
- 確定したものが `onExport` の `redactionCount` に入っている
- **82 のキーボード操作が、この変更のあとも緑のまま**

## 検証方法

`tests/ui/capture-canvas.test.tsx` に足す。壊して赤を見たあと、
**足したテストだけを消して緑に戻ること**まで確かめる（78 ㉞）。

壊すときは先に scratchpad へ複製を取り、複製から書き戻す。
`git checkout --` / `git restore` / `git clean` / `rm` は後始末に使わない。

## リスクとロールバック

要素の一覧を運ぶ経路は、**写しの中身（個人情報を含みうる）を 1 つ増やす**ことになる。
何を運ぶかを先に決める。位置と種類だけで足りるなら、文字列は運ばない。

## リスク: 82 の道を置き換えてしまうこと

**置き換えない。**要素になっていないもの（画像の中の文字、表の一部）は
座標でしか指せない。両方残す。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/traceability.md` の REQ-FB05 と `docs/product/backlog.md` 項目 82 を更新する。

## 規範

`docs/product/backlog.md` 項目 82、`tasks/task-capture-keyboard-drawing.md`

## やらないこと

- 82 で入れた座標の道を消すこと
- 要素の一覧が用意できないまま、それらしい一覧を作って通すこと
