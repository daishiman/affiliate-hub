---
graph_node_id: "task-same-origin-actor-scope"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "security"
tags: ["security","identity"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "同一サイトからの読み取りが、見本の身元の権限で通っている"
owners: ["daishiman"]
created_at: "2026-08-17T23:30:00Z"
updated_at: "2026-08-17T23:30:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"ah-3n1（画面の写しの取り出し口）を閉じる作業中に、同じ形の穴がもう 1 か所あることが分かった","mvp_fit":"enabling","purpose":"same-origin の読み取りが持つ権限を、公開ページと同じ範囲まで下げる","rationale":"意図は『公開ページと同じ読み取り範囲』だが、実際に効いている身元は analyst と feedback_admin を持つ見本で、意図より広い"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-same-origin-actor-scope.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T23:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/infrastructure/platform/api-token.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-3n1 の調査中に見つけた、同じ原因（currentActor の見本への落ち込み）による別経路"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-same-origin-actor-scope.md","confidence":0.9}]
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

同一サイトからの読み取り（`same-origin`）で動く身元を、
**書いてある意図どおり「公開ページと同じ読み取り範囲」まで下げる**。

## 背景

`ah-3n1`（画面の写しの取り出し口）を閉じる作業中に見つけた。**原因が同じ**である。

`src/infrastructure/platform/api-token.ts` には
「これは書き込みを守る仕組みではなく、**公開ページと同じ読み取り範囲**を許すだけのもの」
と書いてある。ところが `/api/tools/<tool>` と `/api/mcp` は、その判定を通った後に
`currentActor()` を呼ぶ。`currentActor()` はログインできていないとき**見本の身元へ落ちる**。

見本の身元が持つ役割は `researcher` `writer` `reviewer` `analyst` `feedback_admin` で、
これは公開ページの読者よりはるかに広い。つまり **書いてある意図と、実際に効いている範囲がずれている**。

歯止めは 2 つ効いているので、いますぐ全部が読めるわけではない。

1. `isToolAllowedForScope()` により、`same-origin` では**読み取りの道具しか**呼べない
2. `checkOrigin()` により、よそのサイトのページからは呼べない

したがって深刻度は `ah-3n1` より低い（あちらは画像そのものが出ていた）。
それでも、**ログインしていない人がブラウザから管理用の読み取りを通せる**ことに変わりはない。

`ah-3n1` で足した `signedInActor()`（見本へ落ちない身元の取り方）が、そのまま使える。

## 入力と前提条件

- `ah-3n1` が済んでいること（`signedInActor()` があること）

## 出力と成果物

- `same-origin` のときに使う身元を、公開ページの読者と同じ範囲にする
- `bearer` のときは従来どおり（あちらは鍵で身元が決まる）
- ずれが戻らないことを機械で見る検査

## 依存関係

`ah-3n1` の後。

## 実装対象

- `src/app/api/tools/[tool]/route.ts`
- `src/app/api/mcp/route.ts`
- `src/presentation/composition.ts`（`readerActor()` と `signedInActor()` の使い分け）

## Write scope と競合制約

`src/app/api/` と `src/presentation/composition.ts` と `tests/`。
`ah-3n1` と同じファイルを触るので、**同時に着手しない**。

## GitHub publication

`local_only`。

## 実行手順

1. `same-origin` のときの身元を決める（読者と同じか、ログイン必須にするか）
2. 決めた身元を `/api/tools` と `/api/mcp` に通す
3. **先に検査を赤くしてから**直す（いまの状態で落ちる検査を書く）

## 受入条件

- ログインしていないブラウザからの `same-origin` 呼び出しが、
  公開ページの読者が読める範囲しか読めない
- `bearer` の経路は挙動が変わらない
- 上のずれが戻ったら落ちる検査がある

## 検証方法

`same-origin` の見出しだけを付けた呼び出しで、管理用の読み取りの道具を叩き、
**拒否されることを実測する**。直す前に同じ検査が緑になることも確認しておく
（緑なら、それが穴が開いている証拠になる）。

## リスクとロールバック

WebMCP（読者ページに出す AI 向けの口）がこの経路を使っているため、
下げすぎると読者ページの AI 案内が動かなくなる。読者ページからの呼び出しを
1 つ実際に通して確かめてから入れる。戻すときは身元の取り方を 1 行戻す。

## Handoff

**「読み取りだから安全」で片付けないこと。** 読み取りで出るのは、
商品・根拠・改善要望といった、まだ公開していない業務のデータである。

## 規範

- `src/infrastructure/platform/api-token.ts` の冒頭（意図が書いてある場所）
- `docs/product/traceability.md` REQ-FB13（`ah-3n1` で足した身元の使い分け）
