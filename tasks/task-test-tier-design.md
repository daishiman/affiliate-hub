---
graph_node_id: "task-test-tier-design"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing"]
priority: "critical"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "品質ゲートを 3 段（push / PR / 夜間）に分ける"
owners: ["daishiman"]
created_at: "2026-08-17T11:00:00Z"
updated_at: "2026-08-17T10:59:28.288549Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["quality-gates.config.mjs","scripts",".github/workflows","tests/architecture"]
purpose: null
goal: null
mvp_alignment: {"background":"検査が 1 段しか無く、重いテストを足すと CI が回らなくなる。public リポジトリなので Actions の時間は無料であり、費用の要因は AI 評価セットだけである","mvp_fit":"enabling","purpose":"重いテストを足しても CI が回り続ける置き場所を先に作る","rationale":"順序を逆にすると、重いテストを入れてから「重いテストを消す」判断に流れる。テストを消す・skip する・閾値を下げる代わりに、実行する場所を変える"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-test-tier-design.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"f617384ca360ac64f48db59dd47f9a3bd66f132b508725c3ae98ec371f751d80","evaluator":"pnpm run verify（7 検査すべて通過、45 秒）と、段指定の無いテストを意図的に足して赤になることの実測","evidence_ref":"git:210efdd"}
source_lineage: {"imported_at":"2026-08-17T11:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/spec/10-テスト戦略仕様.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "利用者からのテスト戦略の要求を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-test-tier-design.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T10:59:28Z","evidence_refs":["beads:ah-7iu","git:210efdd","quality-gates.config.mjs","scripts/tier-scan.mjs","scripts/tier-audit.mjs","scripts/run-tests.mjs","scripts/ai-eval-budget.mjs",".github/workflows/nightly.yml",".github/workflows/ai-eval.yml","tests/architecture/quality-gates.test.ts","tests/architecture/ai-eval-budget.test.ts","docs/spec/11-CI-CD・品質ゲート仕様.md"],"policy":"manual","reconciled_at":"2026-08-17T10:59:28Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-17T10:59:28Z","missing_sections":[],"status":"complete"}
---

# 目的

品質ゲートを 1 段・2 段・3 段に分け、**重いテストを足しても CI が回り続ける**状態にする。

## 背景

いま検査は `pnpm verify` の 1 段だけで、すべてが毎回走る。
ここへミューテーションテスト（L）とテスト種別の網羅（M）を足すと、
1 回の実行が数十分になり、やがて「重いテストを消す」判断へ流れる。

順序を逆にしない。**先に置き場所を作ってから、重いものを入れる。**

費用の前提を実測で確かめた結果は次のとおり。

- このリポジトリは **public**。GitHub Actions の標準ランナーは無料・無制限で、
  直近の実行は 40〜70 秒。**実行時間は費用の要因ではない。**
- 課金されるのは **AI の評価セット**（`ah-gzq`、51 件）だけである。

したがって「時間を減らすために CI からテストを外す」という判断はしない。
やることは**実行する場所を変える**ことだけである。

## 入力と前提条件

- `quality-gates.config.mjs` が閾値と検査の唯一の正本である
- `.github/workflows/ci.yml` は `pnpm run verify` を呼ぶだけになっている
- テストは 109 ファイル・2664 件（2026-08-17 実測）

## 出力と成果物

- `quality-gates.config.mjs` に段の定義（`TIERS`）を置く
- `scripts/verify.mjs` が段を受け取って走らせる
- `.github/workflows/ci.yml` は**段を呼ぶだけ**にする（中身を移さない）
- 段の指定が無いテストファイルを検出して落とすゲート
- `docs/spec/11-CI-CD・品質ゲート仕様.md` に CI-AC を追記
- `docs/product/ci-cd-guide.md` に「何が無料で、何にお金がかかるか」を追記

## 依存関係

無し。L と M より**先**に完了させる。

## 実装対象

- `quality-gates.config.mjs`
- `scripts/verify.mjs`
- `scripts/tier-audit.mjs`（新規。段の指定漏れを検出する）
- `.github/workflows/ci.yml`
- `tests/architecture/quality-gates.test.ts`

## Write scope と競合制約

`quality-gates.config.mjs` / `scripts/` / `.github/workflows/` / `tests/architecture/`。

## GitHub publication

`local_only`。

## 実行手順

1. 段の定義を `quality-gates.config.mjs` へ置く（各段に実行場所 `ci` / `local` / `manual` を持たせる）
2. テストファイルに段の印を付ける
3. 段の指定が無いテストを落とすゲートを作る
4. `scripts/verify.mjs` を段対応にする
5. `ci.yml` を段を呼ぶ形にする
6. **わざと段の指定の無いテストを足して、赤くなることを確かめる**

## 受入条件

- 段の指定が無いテストファイルが 1 つでもあれば CI が落ちる
  （**わざと足して赤を確認するまで「完了」と書かない**）
- 各段の実行場所が設定 1 か所で `ci` / `local` / `manual` に切り替わる
- テストファイルが持つのは段の印だけで、実行場所を書かない
- 単体テストを CI から外さない
- AI 評価セットは手動起動のみ。見積り費用と実費用を出し、上限で**途中で止まる**
- 時間の目標は**警告**であって、落とす条件にしない

## 検証方法

段の指定の無いテストを一時的に足し、`node scripts/tier-audit.mjs` が
0 以外で終わることを実測する。確認後に取り除く。

## リスクとロールバック

設定と検査の追加のみ。既存のテストは 1 件も消さない・skip しない・閾値も下げない。

## Handoff

完了後に L（ミューテーション・プロパティベース）へ進む。
