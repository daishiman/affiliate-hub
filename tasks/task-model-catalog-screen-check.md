---
graph_node_id: "task-model-catalog-screen-check"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "platform"
tags: ["llm","preview","verification"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "モデルが画面に実際に並ぶところを、preview で 1 度見る"
owners: ["daishiman"]
created_at: "2026-08-18T12:00:00Z"
updated_at: "2026-08-18T12:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs"]
purpose: null
goal: null
mvp_alignment: {"background":"目録は config/llm-provider-catalog.json へ入れたが、/admin/generation はログインの内側にあり実物を見ていない","mvp_fit":"enabling","purpose":"設定が画面まで届いていることを実測で 1 度確かめる","rationale":"テストが緑なことと実物が正しいことは別で、画面が別の経路で目録を読んでいれば気づけない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-model-catalog-screen-check.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T12:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"config/llm-provider-catalog.json","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "設定の投入とは別に、実物を見る手当てとして切り出したもの"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-model-catalog-screen-check.md","confidence":0.9}]
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

**モデルが `/admin/generation` に実際に並ぶところを、`pnpm run preview` で 1 度見る。**

## 背景

2026-08-18 に目録（`config/llm-provider-catalog.json`）を入れた。
確かめたのは次の 3 つまでである。

- 正本が設定として読め、6 モデルが並ぶ
- 配り先 3 か所（`wrangler.jsonc`）が正本とずれていない
- 単価に出どころの URL と確認日が付いていて、古くない

**どれも画面を見ていない。** `/admin/generation` はログインの内側にあり、
`pnpm run preview` で立ち上げても `/signin` へ送られる。
設定は正しいのに画面が別の経路で目録を読んでいる、といった食い違いは
ここを見るまで分からない。**テストが緑なことと、実物が正しいことは別である。**

## 入力と前提条件

- `pnpm run preview`（`localhost:8787`）
- Google でのサインイン。**これは人の手が要る**（代行しない）

## 出力と成果物

見るのは 3 つ。

1. 鍵を登録した提供元で、モデルが並ぶ（「選べるモデルがありません」にならない）
2. 単価が USD のまま出ている（円に化けていない。円で見せるなら為替の日付が要る）
3. 目録に無い提供元（`workers_ai`）が、**理由つきで**選べないと言う

## 依存関係

鍵の登録（残課題 08q / ag8）。鍵が無い提供元は 1 と 3 の区別が付かない。

## 実装対象

なし（確認だけ）。食い違いが見つかったらそこで別に起票する。

## Write scope と競合制約

コードは変えない。結果を `docs/product/backlog.md` の項目 67 へ書く。

## GitHub publication

`local_only`。

## 実行手順

1. `pnpm run preview` で立ち上げる
2. サインインする
3. `/admin/generation` を開き、上の 3 点を見る
4. 見たことを実施日つきで残す（**画面の写しに鍵の値が写り込まないこと**）

## 受入条件

- 3 点それぞれについて、見た結果が実施日つきで残っている
- 食い違いが有った場合、それが別の項目として起票されている

## 検証方法

`docs/product/backlog.md` の項目 67 が「済」になり、見た日付が入っていること。

## リスクとロールバック

**ログインを迂回して確かめない。** 迂回した経路で見えたことは、
利用者が通る経路で見えることの証拠にならない。

## Handoff

`ah-5dr`（目録の投入）の作業中、preview まで到達したが
ログインの内側を見られなかったため切り出した。

## 規範

- `config/llm-provider-catalog.json`
- `tests/infrastructure/llm-provider-catalog-config.test.ts`
- `docs/product/backlog.md` 項目 65 / 67
