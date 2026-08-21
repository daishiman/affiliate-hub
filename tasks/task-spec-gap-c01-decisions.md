---
graph_node_id: "task-spec-gap-c01-decisions"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "decisions[] が 1 件しかなく、利用者本人の確定が要る 5 件が記録されていない"
owners: ["daishiman"]
created_at: "2026-08-19T08:40:00Z"
updated_at: "2026-08-19T08:40:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-spec-completeness-gaps"]
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"decisions[] は decision-auth-method の 1 件だけで、D1 二系統分離・Redirect Resolver の Queue/Cron・LLM プロバイダ・UI テーマ実装方式・テスト/CI ツールが入っていない","mvp_fit":"enabling","purpose":"5 件を 2〜3 案の比較つきで記録し、利用者本人の確定を得る","rationale":"本人しか決められない境界（課金・契約・公開・技術選定の乗り換え費用）に当たる。こちらで決めると、あとで戻せない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-gap-c01-decisions.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T08:40:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/completeness-report.json","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "完全性評価（assign-system-spec-completeness-evaluator、verdict: FAIL）の gaps から立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-gap-c01-decisions.md","confidence":0.9}]
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

5 件を 2〜3 案の比較つきで記録し、利用者本人の確定を得る

## 背景

decisions[] は decision-auth-method の 1 件だけで、D1 二系統分離・Redirect Resolver の Queue/Cron・LLM プロバイダ・UI テーマ実装方式・テスト/CI ツールが入っていない

## 評価器の指摘（原文）

> [C01 run-system-spec-elicit + 利用者確定 / medium] decisions[] を decision-auth-method 1 件から拡張し、D1 二系統分離・Redirect Resolver の Queue/Cron・LLM プロバイダ・UI テーマ実装方式・テスト/CI ツールを 2〜3 案比較で記録して利用者本人の確定を得る。

出典は `system-spec/completeness-report.json` の `gaps[2]`。
**この文は完全性評価器（`assign-system-spec-completeness-evaluator`、`context: fork`）が
書いたもので、outer session は 1 文字も書いていない。**

## なぜこれを落とすのか

本人しか決められない境界（課金・契約・公開・技術選定の乗り換え費用）に当たる。こちらで決めると、あとで戻せない

## 入力と前提条件

`system-spec/completeness-report.json` の `gaps[2]`。
先行する課題は無い。

## 出力と成果物

指摘が解消し、C05 の再評価でこの `gap` が返らない状態。

## 依存関係

独立。ほかの子とは触る場所が分かれている。
束ねの親は `task-spec-completeness-gaps`（順番 C01 → C03 → C02 はそちらの本文が持つ）。

## 実装対象

`system-spec/`

## Write scope と競合制約

`system-spec/`。ほかの子とは触る場所が分かれている。

## 実行手順

1. 上の「評価器の指摘（原文）」を読む
2. 指摘された当てどころを実際に開いて、いまの状態を数える（**語ではなく文で数える**——残課題 90）
3. 直す
4. 親の課題がすべて閉じてから、C05 を foreground で再評価する

## 受入条件

- 指摘された当てどころが、指摘の文言どおりの状態になっている
- **数え直しを語ではなく文で行っている**（同じ語を持つ別の文にも当たるため）
- `docs/spec/` を触った場合、`--write` を打っていない（親が最後に 1 度だけ打つ）

## 検証方法

C05 の再評価でこの `gap` が返らないこと。**単体で確かめる手段は無い**ので、
親の再評価まで「直したつもり」であることを認める。**つもりのまま閉じない。**

## リスクとロールバック

`docs/spec/` `system-spec/` を触ると鮮度の指紋が動き、`FRESH` が `STALE` へ戻る。
これは想定どおりで、`--write` は親が最後に 1 度だけ打つ。戻すときは `git revert`。

## GitHub publication

`local_only`。

## Handoff

完了時に親（`task-spec-completeness-gaps`）へ結果を伝え、`docs/product/backlog.md` の状態欄を更新する。

## 規範

`system-spec/completeness-report.json` `gaps[2]`、`docs/product/backlog.md` 項目 90・91

## やらないこと

- `scripts/spec-freshness.mjs --write` を、C05 が再び `PASS` する前に実行すること
- `system-spec/resume-receipt.json` を手で片付けること（落ちる形で残っていること自体が記録）
- **語で数えて「解消済み」と書くこと**（同じ語を持つ別の文に当たる。残課題 90）
