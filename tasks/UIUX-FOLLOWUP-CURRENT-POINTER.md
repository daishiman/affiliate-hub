---
graph_node_id: "UIUX-FOLLOWUP-CURRENT-POINTER"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-dev-planner","quality"]
priority: "medium"
start_date: "2026-09-09"
target_date: null
iteration: null
title: "feat-uiux-overhaul の current ポインタが無く、計画の決定論検証が入口で止まる"
owners: ["daishiman"]
created_at: "2026-09-09T00:00:00Z"
updated_at: "2026-09-09T00:00:00Z"
status: "blocked"
depends_on: []
related_nodes: []
resource_scope: ["docs","feature-package"]
purpose: null
goal: null
mvp_alignment: {"background":"feat-auth-workspace は published/generations/<世代>/ の形で置かれ state/current/ に対応行があるが、feat-uiux-overhaul は published/feature-package-feat-uiux-overhaul/ に世代なしで置かれている。2026-08-23 に利用者判断で保留。完成度 verdict が FAIL (C08 doc_freshness が apple-hig の last_updated を再取得できず INDETERMINATE) である以上、promote を通すには verdict を PASS にする必要があり、それは今の証跡では嘘になる。","mvp_fit":"enabling","purpose":"feat-uiux-overhaul の published が世代ディレクトリと current ポインタを持たないため、validate-system-plan.py が入口で exit=2 になる。promotion 手続きを通してポインタを生成し、検証を再開できる状態にする。","rationale":"ポインタを手で書いて通すことはしない。手で書いた値を自分で検証することになり、検証にならない。"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/UIUX-FOLLOWUP-CURRENT-POINTER.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-09-09T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/spec/feat-uiux-overhaul/evidence/08-plan-validation.txt","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "bd issue ah-k9b の external_ref が指す先の node が存在せず、lint-orphan-external-ref が OE-001 (true_orphan) として検出したため実在させた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/UIUX-FOLLOWUP-CURRENT-POINTER.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-k9b","github_mirror":null,"linked_at":"2026-09-09T00:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

`feat-uiux-overhaul` の published が世代ディレクトリと current ポインタを持ち、
`validate-system-plan.py --feature-package feature-package/feat-uiux-overhaul` が
入口で止まらずに検証結果を返す状態にする。

## 背景

各 phase 仕様書の Verification 節はこのコマンドを要求しているが、この feature では
`[validate fail-closed] current pointer が無い` で exit=2 になり、検証が始まらない。

原因は published の置かれ方の違いである。`feat-auth-workspace` は
`published/generations/<世代>/` の形で置かれ `state/current/<feature>` に対応する行があるのに対し、
`feat-uiux-overhaul` は `published/feature-package-feat-uiux-overhaul/` に世代なしで置かれ、
current ポインタが生成されていない。

2026-08-23 に利用者判断で保留となった。`ah-5j1` で実装 readiness ゲートが完成度レポートの
verdict を読むようになり、現状は正直に赤である
(`status=incomplete` / `missing=['completeness_evaluation:producer-verification-failed']`)。
verdict が FAIL だった理由は 1 点で、doc_freshness 監査 (C08) が apple-hig の last_updated
(HTTP Last-Modified 由来) を再取得できず INDETERMINATE を返したことによる。

証跡: `docs/spec/feat-uiux-overhaul/evidence/08-plan-validation.txt`

## 入力と前提条件

- 入力: `feature-package/feat-uiux-overhaul` 配下の staged package、`system-spec/completeness-report.json`
- 前提: 完成度 verdict が PASS であること。門が閉じている以上、promote を通すには verdict を
  PASS にする必要があり、証跡が揃わないうちにそれを行えば嘘になる。

## 出力と成果物

- 生成物: `published/generations/<世代>/` と `state/current/feat-uiux-overhaul` ポインタ
- 更新対象: `docs/spec/feat-uiux-overhaul/evidence/08-plan-validation.txt`

## 依存関係

- `depends_on`: `gap-doc-freshness-unreachable-header` の解消 (C02 再取得 → C08 再監査 → verdict PASS)
- ブロッカー: 完成度 verdict が PASS でない間は promote を通さない

## 実装対象

- `promote-system-plan.py` を通した feature 別 promotion 手続き
- promotion 後の `validate-system-plan.py` 再実行

**ポインタを手で書いて通すことはしない。** 手で書いた値を自分で検証することになり、検証にならない。

## Write scope と競合制約

- touches: `docs`, `feature-package`
- 排他資源: `state/current/feat-uiux-overhaul` (promotion 手続きが単一 writer)
- 他 feature の published/current には触れない

## GitHub publication

- mode: `local_only`
- labels / milestone / project_aliases: 設定しない

## status の意味論 (二重正本の禁止)

status の正本は本 node である。bd issue `ah-k9b` は投影であり、
graph 側の `blocked` と bd 側の `blocked` は同じ事実を指す。
どちらか一方だけを動かさない。

## 実行手順

1. `gap-doc-freshness-unreachable-header` を解消し、C02 で apple-hig の出典を再取得する
2. C08 doc_freshness 監査を再実行し、完成度 verdict を PASS にする
3. `promote-system-plan.py` で世代ディレクトリと current ポインタを生成する
4. `validate-system-plan.py --feature-package feature-package/feat-uiux-overhaul` を再実行する

## 受入条件

- `validate-system-plan.py --feature-package feature-package/feat-uiux-overhaul` が exit 0 を返す
- current ポインタが promotion 手続きの出力として存在し、手書きの痕跡がない
- 完成度 verdict が PASS であり、その根拠が実際の再取得に接地している

## 検証方法

```
python3 <planner>/scripts/validate-system-plan.py --feature-package feature-package/feat-uiux-overhaul
```

exit 0 と、`state/current/feat-uiux-overhaul` が指す世代が published 側に実在することを確認する。

## リスクとロールバック

- リスク: verdict を PASS にするために証跡を書き換えると、検証そのものが無意味になる。
  doc_freshness が再取得できない環境では待つ以外の正しい手がない。
- ロールバック: promotion は世代ディレクトリを増やす操作なので、current ポインタを
  前世代へ戻せば元に戻る。旧世代を削除しない。

## Handoff

- owner: daishiman
- 解除条件が満たされた時点で本 node を `active` へ上げ、promotion を実行する
