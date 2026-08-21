---
graph_node_id: "task-llm-credential-wiring"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "generation"
tags: ["llm","settings","secrets"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "生成 AI の鍵を画面から登録できるようにする（設定画面と組み立ての配線）"
owners: ["daishiman"]
created_at: "2026-08-18T03:00:00Z"
updated_at: "2026-08-18T03:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-llm-provider-connection"]
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"鍵の預かり所・目録・疎通確認・鍵管理ユースケース・利用量の記録は実装済だが、createDeps がその 5 つを 1 つも作っておらず画面も無い","mvp_fit":"direct","purpose":"利用者ご本人が、鍵の値をこちらへ渡さずに画面から登録できる状態にする","rationale":"ah-ag8（提供元の選定と鍵の登録）は本人の作業だが、登録する場所が無いままでは着手できない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-llm-credential-wiring.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T03:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/application/usecases/generation/manage-llm-credentials.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "実装済のユースケースが組み立てからも画面からも呼ばれていないことを両側から確認した"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-llm-credential-wiring.md","confidence":0.9}]
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

生成 AI の API キーを、**利用者ご本人が画面から登録できる**状態にする。
鍵の値はこちらへ渡らない。

## 背景

鍵まわりの部品はすでに全部ある。

| 部品 | 場所 | 状態 |
| --- | --- | --- |
| 鍵の預かり所（暗号化して D1 へ） | `infrastructure/persistence/d1/llm-credential-repository.ts` | 実装済 |
| 提供元の目録（`LLM_PROVIDER_CATALOG`） | `infrastructure/llm/llm-provider-catalog.ts` | 実装済 |
| 疎通確認（短い依頼を 1 回） | `infrastructure/llm/llm-connectivity.ts` | 実装済 |
| 登録・失効・確認の手続き | `application/usecases/generation/manage-llm-credentials.ts` | 実装済 |
| 使った量の記録 | `infrastructure/persistence/d1/llm-usage-repository.ts` | 実装済 |

**繋がっていないのは組み立てと画面だけ**である。
`createDeps()` はこの 5 つを 1 つも作っておらず、
`createManageLlmCredentialsUseCase` はリポジトリ内のどこからも呼ばれていない。

もう 1 つ、`createLlmPorts()` が Worker の環境（`env`）を受け取っていない。
既定引数の `{}` のまま呼ばれているため、鍵を登録しても
提供元アダプタからは **1 件も見えない**。

## 入力と前提条件

- `LLM_KEY_ENCRYPTION_SECRET`（元締めの鍵）と `LLM_PROVIDER_CATALOG`（選べるモデル）は
  利用者ご本人が登録する。**この作業では値を受け取らない**
- どちらも未設定のまま画面が開けること（開けないと、登録する場所へ辿り着けない）

## 出力と成果物

- `/admin/settings/llm`（仮）で、提供元ごとの状態と登録の口が見える
- 鍵を登録すると末尾 4 文字だけが残り、値はどこにも出ない
- 未設定のときは**何が足りないか 1 行**出る（黙って空にしない）

## 依存関係

なし。`ah-ag8`（提供元の選定と鍵の登録）はこの作業の**後**に利用者ご本人が行う。

## 実装対象

- `src/infrastructure/composition.ts`（env を受け取り、5 つの部品を組み立てる）
- `src/infrastructure/persistence/d1/connection.ts` 相当の env 取得
- `src/presentation/composition.ts`（画面用の入口）
- `src/app/admin/settings/llm/page.tsx`

## Write scope と競合制約

`src/infrastructure/`、`src/presentation/`、`src/app/admin/settings/`、`tests/`。

## GitHub publication

`local_only`。

## 実行手順

1. Worker の環境をリクエストごとに取り出す（無ければ空。例外にしない）
2. `createDeps({ db, env })` で受け、`createLlmPorts(env)` へ渡す
3. 預かり所・目録・疎通確認を組み立てる。
   **`LLM_KEY_ENCRYPTION_SECRET` が無いときは預かり所を作らない**
   （中途半端に平文で持たない）
4. 画面を作り、提供元ごとの状態と使えない理由を出す
5. 未設定の状態で画面を開き、理由が出ることを赤で実測する

## 受入条件

- 鍵未登録・元締めの鍵なしで画面を開いたとき、**使えない理由が 1 行出る**
- 鍵の値が、戻り値・画面・記録・ログのどこにも出ない
- 元締めの鍵が無い環境で、登録の操作が**失敗を返す**（成功したことにしない）
- 目録が未設定のとき「選べるモデルがありません」と出る

## 検証方法

`pnpm run preview` で `/admin/settings/llm` を開く。
`LLM_KEY_ENCRYPTION_SECRET` と `LLM_PROVIDER_CATALOG` を入れない状態で、
理由が読めることを見る。

## リスクとロールバック

いちばん危ないのは、**元締めの鍵が無いのに登録を受け付けてしまう**こと。
受け付けた時点で、平文か復号できない塊のどちらかが保存先に残る。
組み立ての段で作らないことにして、この道を型として塞ぐ。

戻すときは、画面と組み立ての追加分を落とせばよい（既存の生成は触らない）。

## Handoff

**鍵の値をこちらへ渡さないこと。** 画面から本人が入れる。

## 規範

- `docs/spec/08-仕様の未修正点.md` ③
- `tasks/task-llm-provider-connection.md`（`ah-ag8`）
- `src/infrastructure/llm/key-access.ts` の冒頭（鍵に触れてよい範囲）
