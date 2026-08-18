---
graph_node_id: "task-required-test-types-registry-scope"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing","tooling"]
priority: "low"
start_date: null
target_date: null
iteration: null
title: "宣言表の読み取り範囲を §3 に限定する（解説の表が 2 つ目の宣言として拾われる）"
owners: ["daishiman"]
created_at: "2026-08-18T10:00:00Z"
updated_at: "2026-08-18T10:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-required-test-types-acceptance"]
resource_scope: ["scripts","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"ah-zs0 で docs/product/required-test-types.md §4 へ解説の表を書いたところ、1 列目が要件 ID だったために宣言表として拾われ、「除外に知らない種別 tests/domain/link-ingestion.test.ts」という意味の通らない誤りが 8 件出た","mvp_fit":"enabling","purpose":"宣言の正本が §3 の表 1 つであることを、書き方の作法ではなく仕組みで保証する","rationale":"いまは「§4 に要件 ID を先頭セルにした表を書かない」という暗黙の作法で回避している。作法は次に書く人へ伝わらない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-required-test-types-registry-scope.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T10:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"scripts/required-test-types.mjs","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-zs0 の作業中に実際に踏んだ不具合を切り出したもの"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-required-test-types-registry-scope.md","confidence":0.9}]
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

必須テスト種別の宣言が「§3 の表 1 つ」であることを、
書き方の作法ではなく**仕組みで**保証する。

## 背景

`scripts/required-test-types.mjs` の `readRegistry` は、
`docs/product/required-test-types.md` を**行単位で**走り、
先頭セルが `REQ-` で始まる行をすべて宣言として拾う。節を見ていない。

`ah-zs0` で §4 に解説の表（要件 → 印を付けた先）を書いたところ、
その 8 行が 2 つ目の宣言として数えられ、

```
REQ-A01: 除外に知らない種別 `tests/domain/link-ingestion.test.ts`（正本は TEST_TYPES）
```

という、読んでも原因の分からない誤りが 8 件出た。
（3 列目が「除外と理由」だと解釈され、ファイルパスが種別名として読まれている。）

**黙って通る穴ではない**ので緊急ではない。落ちて気づける。
いま困るのは、落ちたときのメッセージが原因を指していないことと、
回避が「§4 に要件 ID を先頭セルにした表を書かない」という
**次に書く人へ伝わらない作法**になっていることの 2 つ。

## 入力と前提条件

- `scripts/required-test-types.mjs` の `readRegistry`（`export` されている）
- 現在の回避: §4 の表は 1 列目を「受け入れ条件」にして要件 ID を 2 列目へ置いた

## 出力と成果物

次のどちらか。**両方やらない**（二重の守りは、片方が緩んだときに気づけない）。

- 案 A: `readRegistry` を「`## 3.` の見出しから次の `## ` までの範囲」に限定する
- 案 B: 範囲は変えず、**同じ要件 ID が 2 回宣言されたら誤りにする**

## 依存関係

無し。`ah-wes`（指されていない種別）とは別の話。

## 実装対象

`scripts/required-test-types.mjs` と、その単体テスト。

## Write scope と競合制約

`scripts/required-test-types.mjs`。同じファイルを触る宣言作業と同時に進めない。

## GitHub publication

`local_only`。

## 実行手順

1. どちらの案を採るか決め、理由を書く
2. `readRegistry` の単体テストへ、**いま踏んだ形をそのまま**入れる
   （§4 に `| REQ-A01 | has-input | ファイルパス |` がある文書を食わせる）
3. 実装する
4. §4 の表を、要件 ID を先頭セルに戻して**それでも緑になる**ことを見る（案 A のとき）

## 受入条件

- §4 に要件 ID 始まりの表があっても、宣言の件数が変わらない（案 A）
  または、二重宣言が理由の分かるメッセージで落ちる（案 B）
- `docs/product/required-test-types.md` §4 の「1 列目を要件 ID にしていない」
  という但し書きを消せる（案 A のとき）
- `node scripts/required-test-types.mjs` の宣言済み件数が、着手前と同じ

## 検証方法

着手前の件数（宣言済 45 / 未宣言 196）を控えてから直し、**同じ数**に戻ることを見る。
数が動いたら、直したつもりで宣言を拾い落としている。

## リスクとロールバック

案 A の危険は、**§3 の外に書いた宣言が黙って無視される**ようになること。
いまは拾われて誤りになるので気づけるが、限定すると気づけない。
これを避けるなら、範囲外に要件 ID 始まりの行があったら
「ここは宣言として読まれない」と**警告を出す**ところまで含める。

戻すときは `readRegistry` を元に戻すだけでよい。

## Handoff

この不具合は「検査そのものが、検査の説明を読み違えた」形をしている。
同じ形は他にもあり得る（`docs/product/traceability.md` を読む側など）。
直すついでに広げず、まずこの 1 つだけを直す。

## 規範

- `scripts/required-test-types.mjs`（`readRegistry`）
- `docs/product/required-test-types.md` §3 / §4
