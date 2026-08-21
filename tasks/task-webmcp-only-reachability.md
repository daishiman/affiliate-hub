---
graph_node_id: "task-webmcp-only-reachability"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["architecture","quality","testing"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "「WebMCP でしか到達できない機能を作らない」を見ている検査が無い（写しの一致と、到達できることは別）"
owners: ["daishiman"]
created_at: "2026-08-19T06:05:00Z"
updated_at: "2026-08-19T06:05:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-judgment-column-audit"]
resource_scope: ["src","tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"REQ-FD04 の判定欄が指す検査は、カタログが 4 入口へ同じ形で写っていることしか見ていない","mvp_fit":"enabling","purpose":"各機能が画面からも到達できることを見る検査を置く","rationale":"AI からしか使えない機能ができると、AI が止まった日に業務が止まる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-webmcp-only-reachability.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T06:05:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "FD 群の判定欄の点検で、要件そのものを見ている検査が無いことが分かったため立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-webmcp-only-reachability.md","confidence":0.9}]
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

**要件 `REQ-FD04`（WebMCP でしか到達できない機能を作らない）を見ている検査を置く。**

## 背景

判定欄には「1 つのカタログを 4 入口へ写す」と書いてあり、その検査は実在する。
カタログから群を 1 つ落とすと 12〜15 件が赤になることも実測した（2026-08-19）。

**しかしそれは「入口ごとに実装が分かれていない」ことであって、
「各機能が画面からも到達できる」ことではない。**

WebMCP にだけ載って画面に無い道具を足しても、落ちる検査が 1 つも無い。
`TM04` 型（検査は実在するが別のことを見ている）である。

これが破れると、**AI からしか使えない機能ができる**。
AI の側が止まった日に、その業務だけが人の手で回せなくなる。

## 入力と前提条件

- `src/presentation/tools/catalog.ts`（`buildToolCatalog`。13 の群 + 別名）
- `src/presentation/composition.ts`
- 画面側の道の一覧: `tests/ui/route-table.ts`（`ENTRY` / `ADMIN` / `READER`）

## 出力と成果物

1. 「カタログの各道具に、対応する画面の道がある」を突き合わせる検査
2. 対応が無い道具が見つかった場合、画面を足すか、道具を落とすかの判断

## 依存関係

`tasks/task-judgment-column-audit.md`（判定欄の点検の正本）。

## 実装対象

`tests/`、必要なら `src/presentation/`。

## Write scope と競合制約

`tests`、`docs`。実装は、対応の無い道具が実際に見つかった場合にのみ触る。

## 実行手順

1. **対応表をどこに置くか先に決める。**これが決まらないと書けない
2. カタログの全道具を列挙し、対応表と突き合わせる
3. 対応の無いものを一覧で出す。**0 件になるまで実装を直すのではなく、
   まず何件あるかを見る**（多ければ、それ自体が設計の合図である）

## 受入条件

- 対応表が**実装から作られていない**こと。
  道具が増えたぶんだけ表も増える作りにすると、道具を足しても緑のままになる
  （残課題 78 の 5 つ目「一覧を実装と共有している検査は、一覧が減ったことを言えない」）
- **画面に無い道具を 1 つ足して赤になることを実測**している
- 対応表そのものが空でないことの確認（空振り防止）がある

## 検証方法

カタログへ「画面から呼ばれない道具」を 1 つ足し、赤になるところまで見る。
壊す前に scratchpad へ複製を取り、複製から書き戻す。

## リスクとロールバック

**対応表を実装から作ると、この課題は「やった形」だけ残って何も守らない。**
これがいちばん起きやすい失敗なので、受入条件の 1 つ目を先に確かめる。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` 項目 88 と要件表 `REQ-FD04` の判定欄を更新する。

## 規範

`docs/product/traceability.md` `REQ-FD04`、`tasks/task-judgment-column-audit.md`

## やらないこと

- 「4 入口へ写っている」検査を、要件を見ている証拠として数え直すこと
- 対応の無い道具を、表へ例外として足して閉じること（理由を書かずに足さない）
