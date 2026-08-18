---
graph_node_id: "task-real-machine-verification-ledger"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","verification","release"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "自動検査では固定したが、本物のランタイムで一度も動かしていないものを一覧にする"
owners: ["daishiman"]
created_at: "2026-08-18T00:00:00.000000Z"
updated_at: "2026-08-18T00:00:00.000000Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs/product","scripts","tests"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-real-machine-verification-ledger.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":"docs/spec/10-テスト戦略仕様.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "品質ゲートの穴を埋める作業。どの仕様の実装でもなく、確かめ方そのものの課題"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-real-machine-verification-ledger.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"not_applicable"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

**「検査は緑だが、本物のランタイムでは一度も動かしていない」ものを名指しで一覧にする。**

いま、どの機能を実機で確かめたかを書いてある場所が無い。
残課題の各項目には「赤を実測済み」が書いてあるが、それは
`vitest`（Node と jsdom）の話で、**Cloudflare Workers のランタイムで
動かしたかどうかとは別**である。両者は D1 の型変換・`server-only`・
`AsyncLocalStorage`・キャッシュ既定値・ヘッダの扱いで実際に食い違う。

## 背景

以下は着手前に確かめた事実である。

1. 転送の入口（`/go/`）は、単体検査が 12 件緑になった**後で**
   本物のランタイムに載せたところ、**管理画面の数字が 0 のまま**だった。
   原因は写しの作業場所の取り違えで、単体検査は 1 件も落ちない形だった
   （残課題 56）。**この形の食い違いは検査では拾えない。**
2. `docs/product/stub-ledger.md` は「まだ中身が無い口」を数えているが、
   **中身がある口を実際に叩いたか**は数えていない。
3. `scripts/verify.mjs` の 11 の門に、本物のランタイムを起こす門は無い。

## 決めたこと（着手前の判断）

**「実機で確かめた」を、書ける場所を 1 つ決めて、そこにだけ書く。**

各所に散らすと、次に読む人が全部を突き合わせないと状態が分からない。
残課題（`docs/product/backlog.md`）は「何が起きたか」の記録で、
**いま確かめられているかどうかの一覧**とは役割が違う。

**「未確認」を、済みと同じ重さで書く。** 空欄にすると
「書き忘れ」と「確かめていない」が区別できなくなる。

## 入力と前提条件

- `pnpm run preview`（Workers ランタイム、`localhost:8788`）が動く
- D1 の実物（ローカル）にマイグレーションが当たっている

## 出力と成果物

1. 確認台帳（`docs/product/runtime-verification.md`）。
   経路ごとに「確かめた日 / 確かめ方 / 結果」または「未確認」を書く
2. まず埋める対象は、本物の保存先につながっている次の経路:
   - HTTP の入口 7 件（`/go/[code]`、`/api/telemetry`、`/api/tools`、
     `/api/tools/[tool]`、`/api/mcp`、`/api/feedback/pending`、
     `/api/feedback-captures/[capture]`）
   - D1 の保存先 13 件（`src/infrastructure/persistence/d1/` の各リポジトリ）
   - R2 の置き場（画面の写し）
3. 確認に使う手順（叩く URL と、見るべき数字）を台帳に併記する

## 受入条件

- 台帳に、上記の経路が 1 つ残らず「確認済み（日付つき）」か「未確認」で載っている
- 「未確認」の行に、確かめるための手順が書いてある（読んだ人がそのまま実行できる）
- 台帳に無い経路を足したときに気づける（件数を検査で固定するか、
  台帳の生成をスクリプト化する）

## 検証方法

台帳の「確認済み」の行を無作為に 2 件選び、書いてある手順を
`pnpm run preview` でそのまま実行して同じ結果になることを見る。
**台帳が実物とずれていないことまで見る。**

## 依存関係

無し。

## 実装対象

- `docs/product/runtime-verification.md`（新規）
- 必要なら `scripts/` に一覧の生成を足す

## Write scope と競合制約

`docs/product/`、`scripts/`。**アプリの実装は触らない。**

## 実行手順

1. 台帳の形を決めて、上記の経路を「未確認」で全部並べる
2. `pnpm run preview` を起こし、1 件ずつ叩いて埋める
3. 埋めながら見つかった食い違いは、その場で残課題として起票する
4. 経路の数え漏れに気づける形（件数の固定か生成）を足す

## GitHub publication

`local_only`。

## Handoff

**この作業の値打ちは、埋まった行ではなく、埋めている途中で落ちる行にある。**
転送の入口のときは、検査 32 件が緑の状態から実機で 1 件見つかった。
落ちたものを「あとで直す」で流さず、その場で起票すること。

## リスクとロールバック

台帳が実物とずれると、**確かめていないものを確かめたことにする**ため、
無いよりも悪い。だから受入条件に「台帳の行をそのまま再実行できること」を入れている。

## 規範

- `docs/spec/10-テスト戦略仕様.md`
- `docs/product/backlog.md` 56
- `docs/product/stub-ledger.md`
