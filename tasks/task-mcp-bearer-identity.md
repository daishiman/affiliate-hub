---
graph_node_id: "task-mcp-bearer-identity"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "security"
tags: ["security","identity","mcp"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "MCP の Bearer 経由の管理用読み取りが、どの身元で通るか決まっていない"
owners: ["daishiman"]
created_at: "2026-08-18T05:00:00Z"
updated_at: "2026-08-18T05:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-same-origin-actor-scope"]
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"見本の身元から書き込みの役をすべて外した結果、actorForScope(\"bearer\") が currentActor() 経由で見本へ落ちていたことが表に出た","mvp_fit":"enabling","purpose":"MCP の Bearer 経由の管理用読み取りを、作業場所つきの身元で通す形に決める","rationale":"MCP_TOKEN は『呼んでよい相手か』しか決めず、どの作業場所の誰かを決めない。正しい道は連携の鍵から身元を組み立てる resolveIntegrationAccess"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-mcp-bearer-identity.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T05:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/presentation/composition.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-3n1 / ah-2ro と同じ原因（currentActor の見本への落ち込み）による 3 つ目の経路"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-mcp-bearer-identity.md","confidence":0.9}]
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

**MCP（`Authorization: Bearer`）経由の管理用の読み取りが、どの身元で通るかを決める。**
いまは決まっていない。決まっていないまま通っていた状態を止めたのが現況であり、
「通らなくなった」のは直った側である。

## 背景

`ah-3n1` → `ah-2ro` → 本件、と同じ原因が 3 か所に出ている。**原因は 1 つ**で、
`src/presentation/composition.ts` の `currentActor()` が、身元を解決できないときに
**見本の身元（`SAMPLE_ACTOR`）へ落ちる**ことである。

| 経路 | 課題 | 状態 |
| --- | --- | --- |
| 画面の写しの取り出し口 | `ah-3n1` | 済 |
| 同一サイトからの読み取り（`same-origin`） | `ah-2ro` | 済 |
| **MCP の `Bearer`（`actorForScope("bearer")`）** | **本件** | **未決** |

`MCP_TOKEN` は「呼んでよい相手か」しか決めない。**どの作業場所の誰か**を決めないため、
`actorForScope("bearer")` は `currentActor()` を呼び、そこで見本へ落ちていた。

2026-08-18 に見本の身元から書き込みの役をすべて外した（`analyst` だけにした）ため、
**Bearer 経由の管理用の読み取りは通らなくなった**。この事実は
`tests/presentation/api-scope-actor.test.ts` の
「Bearer だけでは管理用の読み取りは通らない（身元が決まらないため）」で固定してある。

## 入力と前提条件

- `ah-3n1` と `ah-2ro` が済んでいること（同じ原因の別経路が閉じていること）
- 見本の身元が `analyst`（読むだけ）であること
- `resolveIntegrationAccess()`（`src/presentation/composition.ts`）が
  連携の鍵から**作業場所つきの身元**（`ai_service_account`）を組み立てられること

## 出力と成果物

**正しい道は `resolveIntegrationAccess()` である。** 連携の鍵は作業場所に結びついているので、
「どの作業場所の誰か」がそこで決まる。`MCP_TOKEN` にはそれが無い。

決めることは 2 つ。

1. **MCP の呼び出し元に、連携の鍵を持たせるか**
   持たせるなら、`MCP_TOKEN` は「呼んでよい相手か」の門として残し、
   身元は鍵から決める。既存の `resolveIntegrationAccess()` に合流する
2. **持たせないなら、Bearer からは管理用の読み取りを出さない**
   公開の読み取り（読者向け）だけを出す。`ah-2ro` と同じ考え方

**見本の身元へ役を足して元へ戻すのは選択肢に入れない。**
それは「誰が呼んでいるか分からないまま、管理用のデータを出す」に戻すことである。

## 依存関係

`ah-3n1`（済）、`ah-2ro`（済）。認証（`ah-361`）とは独立に決められる
（Bearer は人のログインではなく、機械の呼び出しの話であるため）。

## 実装対象

- `src/presentation/composition.ts`（`actorForScope` / `resolveIntegrationAccess`）
- `src/infrastructure/platform/api-token.ts`（`MCP_TOKEN` の位置づけ）
- `tests/presentation/api-scope-actor.test.ts`（いまは通らないことを固定している）

## Write scope と競合制約

`src/presentation/` と `src/infrastructure/platform/`。

## GitHub publication

`local_only`。

## 実行手順

1. 1 か 2 を決める（決めるまで着手しない。公開範囲の判断であるため）
2. 1 を採るなら、連携の鍵の発行が先。ただし
   `integration_key.manage` は認証が入るまで誰も持たない状態にしてある（意図どおり）
3. `api-scope-actor.test.ts` の該当検査を、通る側へ書き換える

## 受入条件

- Bearer 経由で管理用の読み取りが通るとき、**どの作業場所の誰として通ったかが記録に残る**
- 作業場所をまたいだ読み取りが 1 件も出ない
- 身元が決まらない呼び出しは、見本へ落ちずに断られる（`ah-3n1` / `ah-2ro` の状態を崩さない）

## 検証方法

`pnpm run preview` で、鍵なしの Bearer と鍵ありの Bearer を同じ入口へ投げ、
前者が断られ後者が通ることを見る。

## リスクとロールバック

いちばん危ないのは、急いで通すために**見本へ役を足す**ことである。
それをすると 3 か所の課題が同時に元へ戻り、しかも検査は緑になる
（見本が権限を持っている前提の検査が通ってしまうため）。

## Handoff

**「MCP が動かなくなった」を不具合として直さないこと。**
動いていたのは、身元の分からない呼び出しが管理権限で通っていたからである。

## 規範

- `tasks/task-same-origin-actor-scope.md`（`ah-2ro`）
- `src/infrastructure/platform/api-token.ts` 冒頭（同一サイトの範囲）
- `docs/product/open-doors.md`（開いている扉の数え方）
