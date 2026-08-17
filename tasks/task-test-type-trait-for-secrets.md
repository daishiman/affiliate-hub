---
graph_node_id: "task-test-type-trait-for-secrets"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing","security"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "秘密情報の要件に当てはまる「性質」が語彙に無い（REQ-SEC10 が宣言できない）"
owners: ["daishiman"]
created_at: "2026-08-17T23:50:00Z"
updated_at: "2026-08-17T23:50:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"REQUIRED_TEST_TYPES の性質は 8 つで、入力・状態・権限・テナント・外部・画面・計算・AI文章。秘密情報の取り扱い（REQ-SEC10）はどれでもない","mvp_fit":"enabling","purpose":"秘密情報の要件に必須テスト種別を宣言できるようにする","rationale":"種別として secrets はあるのに、そこへ至る性質が無い。このままだと秘密情報の要件は永久に未宣言のまま残る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-test-type-trait-for-secrets.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T23:50:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/required-test-types.md","source_plugin":null,"source_version":null}
classification_confidence: 0.85
classification_reason: "ah-99p で 24 件中 23 件は宣言できたが、REQ-SEC10 だけは性質の語彙に対応するものが無く保留した"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-test-type-trait-for-secrets.md","confidence":0.85}]
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

秘密情報の取り扱い（`REQ-SEC10`）に、必須テスト種別を**宣言できる状態**にする。
いまは宣言しようとしても、当てはめる「性質」が語彙に無い。

## 背景

`quality-gates.config.mjs` の `REQUIRED_TEST_TYPES` は、
要件の**性質**から必要な**種別**を引く表である。性質は 8 つある。

`has-input` / `has-state` / `has-permission` / `has-tenant` /
`has-external` / `has-screen` / `has-calculation` / `has-ai-text`

`REQ-SEC10` は「リポジトリに秘密（API キー・トークン）が入っていないこと」であり、
入力でも状態でも画面でも計算でもない。**8 つのどれでもない。**

一方で、種別の一覧 `TEST_TYPES` には `secrets` が入っている。
**種別はあるのに、そこへ至る性質が無い**という食い違いが残っている。

同じ形の食い違いは `secrets` だけではない。
`ssrf` / `audit-log` / `db-migration` / `decision-table` / `property` も、
どの性質からも指されていない。

`ah-99p`（権限・テナント・セキュリティ 24 件の宣言）では、
23 件を宣言し、この 1 件だけを保留した。
**性質を無理に当てはめると、その性質を持つ他の要件の判定まで変わる**ため、
その課題の範囲では触れないことにした。

## 入力と前提条件

- `quality-gates.config.mjs` の `REQUIRED_TEST_TYPES` / `TEST_TYPES`
- `docs/product/required-test-types.md` §4 の保留の記録
- `scripts/required-test-types.mjs`（判定の実装）
- 宣言済みは 36 件、未宣言は 205 件（上限も 205）

## 出力と成果物

- `REQ-SEC10` が宣言表に載り、`secrets` の種別が要求される
- どの性質からも指されていない種別が無くなる、
  または「指されない理由」が `TEST_TYPES` のそばに書かれている
- `TEST_TYPES_MAX_UNDECLARED` が 205 から 204 へ**減る**

## 依存関係

無し。ただし `ah-99p` の宣言表（36 行）が前提になる。

## 実装対象

- `quality-gates.config.mjs`（`REQUIRED_TEST_TYPES` の語彙）
- `docs/product/required-test-types.md`（宣言表と §4 の記録）
- `tests/`（新しい性質が要求する種別の実体）

## Write scope と競合制約

`quality-gates.config.mjs` と `docs/product/required-test-types.md`。
語彙を足すと**既存 36 件の判定が変わり得る**ため、
同じファイルを触る宣言作業（残課題 45 の続き）と同時に進めない。

## GitHub publication

`local_only`。

## 実行手順

1. 語彙を足す前に、**いま宣言済みの 36 件のうち何件が新しい性質に当たるか**を数える。
   当たる件数が分かってから足す（足してから数えると、赤を消す作業になる）
2. `has-secret`（仮）を `REQUIRED_TEST_TYPES` に足し、`secrets` を要求させる
3. `REQ-SEC10` を宣言表に足す
4. `secrets` の実体が無ければ書く。あるなら `@types secrets` を付ける
5. `TEST_TYPES_MAX_UNDECLARED` を 204 へ下げる
6. 指されない種別が他にも残るなら、その一覧と理由を §4 に書く

## 受入条件

- `node scripts/required-test-types.mjs` が緑
- `REQ-SEC10` の行から `@types secrets` の印を外すと**赤になる**（実測する）
- `TEST_TYPES_MAX_UNDECLARED` が減っている（増えていない）
- 語彙を足したことで、既存の宣言済み 36 件のうち赤になったものが 0 件

## 検証方法

`node scripts/required-test-types.mjs` で緑を確認したあと、
**印を 1 つ外して赤になることを実際に見る**（緑だけでは、門が効いているか分からない）。
確認したら印を戻し、`pnpm run verify` で他の門を巻き込んでいないことを見る。

## リスクとロールバック

**いちばん危ないのは、語彙を足したことで既存の要件が静かに赤になり、
それを消すために上限を上げること。** 上限は減る方向にしか動かさない。
既存が赤になったら、上限ではなく**足りない検査を書く**か、
理由つき除外（こちらにも上限がある）で受け止める。

戻すときは `REQUIRED_TEST_TYPES` の追加行を消すだけでよい。

## Handoff

`secrets` という種別名があることを「対応済み」と読まないこと。
**どの性質からも指されていない種別は、一度も要求されない。**
一覧に名前があるだけで、門としては存在していない。

## 規範

- `docs/spec/10-テスト戦略仕様.md` §14
- `docs/product/required-test-types.md` §4「2026-08-17 に減らしたぶん」
- `quality-gates.config.mjs`（語彙と上限の正本）
