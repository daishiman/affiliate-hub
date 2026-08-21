---
graph_node_id: "task-spec-gap-c03-fence-repair"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "backend.md のコードフェンス対が壊れ、本文が重複している"
owners: ["daishiman"]
created_at: "2026-08-19T08:40:00Z"
updated_at: "2026-08-19T08:40:00Z"
status: "draft"
depends_on: ["task-spec-gap-c01-spec-intake"]
related_nodes: ["task-spec-completeness-gaps"]
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"90 行目・259 行目でフェンス対が破損し、239〜266 行目が重複している。qa_log の取り込み時にフェンスが退避されていない","mvp_fit":"enabling","purpose":"取り込み時のフェンス退避で解消する","rationale":"壊れた記法は読み手にだけ影響するように見えるが、指紋・差分・検索のすべてを狂わせる。残課題 83（見えない 1 バイトで git diff が黙る）と同じ族"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-gap-c03-fence-repair.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T08:40:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/completeness-report.json","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "完全性評価（assign-system-spec-completeness-evaluator、verdict: FAIL）の gaps から立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-gap-c03-fence-repair.md","confidence":0.9}]
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

取り込み時のフェンス退避で解消する

## 背景

90 行目・259 行目でフェンス対が破損し、239〜266 行目が重複している。qa_log の取り込み時にフェンスが退避されていない

## 評価器の指摘（原文）

> [C03 run-system-spec-compile へ差し戻し / medium] backend.md のコードフェンス対の破損 (90 行目・259 行目) と 239〜266 行目の本文重複を、qa_log 取り込み時のフェンス退避で解消する。

出典は `system-spec/completeness-report.json` の `gaps[4]`。
**この文は完全性評価器（`assign-system-spec-completeness-evaluator`、`context: fork`）が
書いたもので、outer session は 1 文字も書いていない。**

## なぜこれを落とすのか

壊れた記法は読み手にだけ影響するように見えるが、指紋・差分・検索のすべてを狂わせる。残課題 83（見えない 1 バイトで git diff が黙る）と同じ族

## 入力と前提条件

`system-spec/completeness-report.json` の `gaps[4]`。
`task-spec-gap-c01-spec-intake` が済んでいること。

## 出力と成果物

指摘が解消し、C05 の再評価でこの `gap` が返らない状態。

## 依存関係

`task-spec-gap-c01-spec-intake` の後。
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

`system-spec/completeness-report.json` `gaps[4]`、`docs/product/backlog.md` 項目 90・91

## やらないこと

- `scripts/spec-freshness.mjs --write` を、C05 が再び `PASS` する前に実行すること
- `system-spec/resume-receipt.json` を手で片付けること（落ちる形で残っていること自体が記録）
- **語で数えて「解消済み」と書くこと**（同じ語を持つ別の文に当たる。残課題 90）
