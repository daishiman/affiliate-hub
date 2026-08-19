---
graph_node_id: "task-llm-settings-auth-gate-eyes"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "generation"
tags: ["llm","secrets","auth"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "鍵の登録画面の断りを、利用者本人が画面で 1 周見る"
owners: ["daishiman"]
created_at: "2026-08-19T13:00:00Z"
updated_at: "2026-08-19T13:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-llm-settings-auth-gate"]
resource_scope: ["docs"]
purpose: null
goal: null
mvp_alignment: {"background":"未ログインで登録・失効・疎通確認が断られることと、断る理由が画面に出ることは検査で固定した。画面に実際どう出るかは目で見ていない","mvp_fit":"direct","purpose":"断りの文が画面で読める形になっているかを人の目で確かめる","rationale":"文言が出ることをテストは文字列として見ているが、読める場所に読める大きさで出ているかは見ていない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-llm-settings-auth-gate-eyes.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T13:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/presentation/admin/llm-credential-action.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "task-llm-settings-auth-gate から目視の分だけを切り出した"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-llm-settings-auth-gate-eyes.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

鍵の登録画面（`/admin/settings/llm`）で断りが出る様子を、**利用者本人が画面で 1 周見る**。

## 背景

`task-llm-settings-auth-gate`（bd: ah-5lo）で、未ログインの登録・失効・疎通確認を
`signedInActor()` で断り、`null` のときは `formData` を読む前に返すようにした。
断ること・断る理由の文が返ること・戻り値に鍵が混ざらないことは
`tests/presentation/llm-credential-actions.test.ts` の 19 件で固定してある。

テストが見ているのは**文字列**である。
その文字列が画面のどこに、読める大きさで出るかは、まだ誰も見ていない。
文言が返っていても、画面の隅で消えていれば、利用者には「何も起きなかった」に見える。

## 入力と前提条件

`pnpm run preview`（`localhost:8787`）が動いていること。ログインしていない状態で開く。

## 出力と成果物

見た結果を、この項目のメモへ 1 行で残す（読めた／読めなかった、どこに出たか）。

## 依存関係

`task-llm-settings-auth-gate`（コードと検査の側）。そちらは閉じている。

## 実装対象

なし。**この項目でコードを書かない。**

## Write scope と競合制約

書き込み対象なし。

## GitHub publication

`local_only`。

## 実行手順

**利用者本人が開く。** 代行しない。

1. ログインしていない状態で `/admin/settings/llm` を開く
2. 鍵の登録を試す
3. 鍵の失効を試す
4. 疎通確認を試す

## 受入条件

3 つとも断られ、断る理由が**画面で読める場所に出ている**こと。

## 検証方法

目で見る。自動の検査はこの項目の対象外（コード側は ah-5lo で固定済み）。

## リスクとロールバック

**鍵の値をここへ書かない。**
この確認に本物の鍵は要らない。断られる側を見るので、値は画面の先へ届かない。
値を入れずに空欄のまま押しても、断りは同じように出る。

## Handoff

見た結果を 1 行書いて閉じる。読めなかった場合は、その画面の名前と一緒に別項目を起こす。

## 規範

`docs/spec/10-テスト戦略仕様.md`（自動の検査で見られないものの扱い）。
