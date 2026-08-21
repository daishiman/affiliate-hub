---
graph_node_id: "task-integration-key-action-gate"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "security"
tags: ["security","identity","secrets"]
priority: "critical"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "秘密情報の入口は 2 つあり、閉めたのは片方だけ（外部連携の鍵が未ログインで作れる）"
owners: ["daishiman"]
created_at: "2026-08-19T11:00:00Z"
updated_at: "2026-08-19T11:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-signed-in-actor-for-mutations","task-llm-settings-auth-gate"]
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"ah-5lo で生成 AI の鍵の口 (manageLlmCredentialAction) を signedInActor() で塞いだが、同じ日の実測で、外部連携の鍵を作成・失効する manageIntegrationAccessAction (src/presentation/admin/feedback-action.ts) が同じ形のまま残っていることが分かった。こちらは currentActor() を呼び、身元を確かめられないとき見本の身元へ落ちる","mvp_fit":"enabling","purpose":"外部連携の鍵の作成・失効を、formData を読む前にログインで断る形へ替える","rationale":"秘密情報の入口を 1 つだけ塞ぐと、塞いだ側の記録だけが残り、残った側は「見張られている入口の一覧」に載らない。片方だけ塞ぐと、同じ壊れがもう片方から出る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-integration-key-action-gate.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T11:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/open-doors.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-5lo を塞ぐ作業中に、同族の実測（変更操作で currentActor() を呼ぶ 16 件 / 9 ファイル）を数える途中で向こうから出てきた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-integration-key-action-gate.md","confidence":0.9}]
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

外部連携の鍵を作成・失効する操作を、**`formData` を読む前にログインで断る**形へ替える。

## 背景

`ah-5lo`（生成 AI の API キーの口）を塞ぐ作業中に、**同族を数える途中で向こうから出てきた**。

`src/presentation/admin/feedback-action.ts` の `manageIntegrationAccessAction()` は、
`await currentActor()` を `execute` の引数に直接書いている（235 行目）。
`currentActor()` は身元を確かめられないとき**見本の身元へ落ちる**ので、
ログインしていない人の操作が預かり所まで届く。

いま実際に断られるのは、見本の身元が持つ役が `analyst` だけで、
`analyst` が `integration_key.manage` を持たないからである
（`src/domain/identity/permissions.ts:202`。`src/infrastructure/identity/sample-actor.ts` に
「2026-08-18 に、書き込みの役をすべて外した」と記録がある）。

**つまり塞いでいるのは入口ではなく、役の一覧である。**
役の一覧は人が編集する表で、**1 行足せば戻る。**
断りが役に寄りかかっている限り、塞がっているように見えて、塞いでいるのは別の場所である。

### `ah-5lo` との違い（同じ直し方だが、危ないものの向きが逆）

`ah-5lo` では、**鍵の値が入力として** `formData` から application 層へ渡っていた。
断りの位置が値の移動より後ろにあり、「起きたあとで無かったことにする」形だった。

こちらは逆で、**鍵の値は出力**である。`intent=issue` のとき
`result.value.shownOnceText` と `result.value.issuedValue` に平文が入り、
それがそのまま画面の状態として返る（249-254 行目）。
入力側は `label` と `scopes` だけなので、渡ってしまう秘密は無い。

**危ないのは「未ログインの人に平文の鍵が発行されて返る」ほうである。**
同じ直し方で両方に効くが、**同じ理由で危ないと書くと、次に読む人が向きを取り違える。**

## 入力と前提条件

- `ah-5lo` が済んでいること（`signedInActor()` が `@/presentation/composition` にあること）
- `tests/presentation/llm-credential-actions.test.ts` に、未ログインの検査 9 件の書き方の実例がある

## 出力と成果物

- 未ログインのとき、鍵の作成・失効・一覧のいずれも預かり所へ届かない
- 断る理由が画面に出る（無言で失敗しない）
- 上が戻ったら落ちる検査
- `docs/product/open-doors.md` の再生成と、上限を下げた `quality-gates.config.mjs`

## 依存関係

`ah-5lo` の後。

## 実装対象

- `src/presentation/admin/feedback-action.ts`（`manageIntegrationAccessAction()`）
- `tests/presentation/`（未ログイン・ログイン済みの検査）
- `docs/product/open-doors.md`（生成物）
- `quality-gates.config.mjs`（上限を下げる）

## Write scope と競合制約

`src/presentation/admin/` と `tests/` と `docs/product/open-doors.md`。

`quality-gates.config.mjs` は**共有物である。** 上限を下げるとき以外は触らない。
下げる変更も、着手前に持ち主へ知らせる。

`task-signed-in-actor-for-mutations` と同じ族の 1 件なので、**同時に着手しない。**

## GitHub publication

`local_only`。

## 実行手順

1. **先に赤を見る。** 未ログインで鍵が発行できてしまうことを、**値を差し替える壊し方**で再現する
   （`actor` を `null` にする側で作る。**判定式を偽に倒す壊し方は使わない**）
2. `currentActor()` を `signedInActor()` へ替え、`null` のとき `formData` を読む前に断る
3. 断る理由を画面に出す。戻り値に鍵が混ざらないことを検査で固定する
4. `UPDATE_OPEN_DOORS=1` で台帳を再生成し、上限を**下げる**
   （下げないと「減ったのに戻れる」状態が残り、戻った日に赤くならない）

## 受入条件

- 未ログインでは `issue` / `revoke` / `list` のいずれも預かり所へ届かない
- 未ログインの戻り値に `issuedValue` が入らない
- ログインしている人の操作は、その人の身元で預かり所へ届く
- `open-doors` の「開いている扉」と「取り返しがつかない操作」の上限が下がっている

## 検証方法

未ログインの状態で `intent=issue` を送り、**預かり所が 1 度も呼ばれないこと**を実測する。
直す前に同じ検査を走らせ、**赤になることを先に見る**（緑なら穴が開いている証拠にならない）。

壊し方は 1 つでは足りない。**身元を `null` にする / 断りの行を消す**の 2 通りで赤を見て、
直したあと**足した検査だけを消して緑に戻る**ことまで確かめる。

## リスクとロールバック

`list` まで断ると、ログイン前に鍵の一覧を見せている画面があれば表示が変わる。
`src/app/admin/settings/integration-access` は入口の門（`src/middleware.ts`）の内側にあるため
影響しない見込みだが、**見込みで済ませずに preview（8787）で 1 度開く**。
戻すときは身元の取り方 1 行を戻す。上限は戻さない（上げる向きになるため）。

## Handoff

**「役で断られているから塞がっている」で片付けないこと。**
役の一覧は人が編集する表で、1 行足せば戻る。**断りの位置を直すのが本題である。**

**平文が通るのは戻り値の 1 か所だけ**という既存の doc comment（212 行目）の約束を変えない。
鍵の値をこちらで受け取らない・ログへ出さない。

## 規範

- `src/presentation/admin/llm-credential-action.ts`（`ah-5lo` で直した側。同じ形の実例）
- `docs/product/open-doors.md`（台帳）
- `docs/product/backlog.md` 78（検査の向き）
