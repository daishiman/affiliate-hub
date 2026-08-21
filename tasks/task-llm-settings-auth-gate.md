---
graph_node_id: "task-llm-settings-auth-gate"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "generation"
tags: ["llm","secrets","auth"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "鍵の登録画面が未ログインでも使える（本番へ出す前に塞ぐ）"
owners: ["daishiman"]
created_at: "2026-08-18T04:00:00Z"
updated_at: "2026-08-18T04:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-llm-credential-wiring"]
resource_scope: ["src","tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"セッションを発行する実装が無く、全リクエストが SAMPLE_ACTOR になる。その役割は integration_key.manage を持つため、鍵の登録・失効が未ログインで通る","mvp_fit":"direct","purpose":"鍵の登録画面を本番へ出せる状態にする","rationale":"鍵は金銭に直結し、失効させると保管していた値も消えて戻せない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-llm-settings-auth-gate.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T04:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/presentation/admin/llm-credential-action.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "権限の経路を actor の作り方まで辿って実測した"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-llm-settings-auth-gate.md","confidence":0.9}]
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

生成 AI の鍵の登録画面（`/admin/settings/llm`）を、**本番へ出せる状態にする**。

## 背景

`src/presentation/admin/llm-credential-action.ts` は `currentActor()` を使う。
この関数はセッションを解決できないと `SAMPLE_ACTOR` へ落ちる
（`src/presentation/composition.ts` の `currentActor`）。

そして**セッション行を発行する実装がリポジトリに無い**
（`insert(sessions …)` が 1 か所も無い）。つまりいまは全リクエストが
`SAMPLE_ACTOR` になる。

`SAMPLE_ACTOR` の役割には `feedback_admin` が入っていて、
`feedback_admin` は `integration_key.manage` を持つ
（`src/domain/identity/permissions.ts:177`）。
**鍵の登録・失効に必要な権限は、この経路で通る。**

本番に出すと、URL を知っている者が次をできる。

- 自分の API キーを登録し、こちらのアプリから他社 API を呼ばせる
- **ご本人が登録した鍵を失効させる**（失効させると保管していた値もその場で消える）

管理画面が未認証であること自体は既存の状態で、この作業で開いた穴ではない。
ただ**鍵は他の画面と質が違う**。記事の編集は直せるが、失効した鍵は戻せず、
他社 API の呼び出しは金銭に変わる。

## 入力と前提条件

- 認証（`ah-361`）の実装状況。ログインの仕組みがまだ無い

## 出力と成果物

- 未ログインでは登録・失効・疎通確認のいずれも通らない
- 通らない理由が画面に出る（黙って空にしない）

## 依存関係

認証（`ah-361`）。案 (a) を採るならこれが先。

## 実装対象

- `src/presentation/admin/llm-credential-action.ts`
- `src/app/admin/settings/llm/page.tsx`
- `tests/presentation/llm-credential-actions.test.ts`

## Write scope と競合制約

`src/presentation/`、`src/app/admin/settings/`、`tests/`、`docs/`。

## GitHub publication

`local_only`。

## 実行手順

1. どちらの案で塞ぐかを決める（下の 2 案）
2. 未ログインで登録が**失敗する**ことを赤で実測してから直す
3. 本番へ出す前に、この検査が緑であることを確かめる

## 受入条件

- ログインしていない状態で、登録・失効・疎通確認のいずれも失敗する
- 失敗の理由が画面に出る
- ログイン済みの本人は従来どおり登録できる
- 上記をテストで固定する

## 検証方法

`pnpm run preview` で未ログインのまま `/admin/settings/llm` を開き、
登録が通らないことと理由が読めることを見る。

## リスクとロールバック

`signedInActor()`（フォールバック無し）へ替えるのは 1 行だが、
**ログインの仕組みが無いのでご本人も登録できなくなる**。案は 2 つ。

- (a) 認証（`ah-361`）を先に入れる
- (b) 本番でだけ `/admin/settings/llm` を閉じ、認証の実装後に解放する

鍵は本番の D1 に入るため、preview（手元の D1）で登録しても本番では使えない。
結局は認証待ちになるので **(a) が本命**。

## Handoff

**この項目が閉じるまで、鍵の登録画面を本番へ出さない。**

## 規範

- `docs/product/credential-registration.md`
- `tasks/task-llm-credential-wiring.md`（`ah-nuy`。この画面を作った作業）
- `src/domain/identity/permissions.ts` の役割表
