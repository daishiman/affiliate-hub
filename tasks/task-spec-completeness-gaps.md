---
graph_node_id: "task-spec-completeness-gaps"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "仕様の完全性評価が FAIL。gaps 9 件を C01 → C03 → C02 の順で片付ける"
owners: ["daishiman"]
created_at: "2026-08-19T08:40:00Z"
updated_at: "2026-08-19T08:40:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-spec-gap-c01-spec-intake","task-spec-gap-c01-decisions","task-spec-gap-c01-qa-ref-scope","task-spec-gap-c03-doctrine-citation","task-spec-gap-c03-fence-repair","task-spec-gap-c03-nonnormative-note","task-spec-gap-c02-doc-refetch","task-spec-gap-harness-input-inventory","task-spec-gap-resume-receipt-invalid"]
resource_scope: ["system-spec","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"2026-08-19 の再評価で verdict が PASS から FAIL へ反転した。反転の理由は機械ゲート（鮮度・カバレッジ・型）ではなく意味層","mvp_fit":"enabling","purpose":"gaps 9 件を 1 束として管理し、C01 → C03 → C02 の順番を記録に残す","rationale":"9 件は 1 回の評価から出た 1 束で、順番まで共有している。バラすと、順番がどこにも書かれていない 9 件になる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-completeness-gaps.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T08:40:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/completeness-report.json","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "完全性評価（assign-system-spec-completeness-evaluator、verdict: FAIL）の gaps から立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-completeness-gaps.md","confidence":0.9}]
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

2026-08-19 の完全性評価で **verdict が `PASS` から `FAIL` へ反転した。**
その `gaps` 9 件を 1 束として管理し、**片付ける順番を記録に残す。**

## 背景

反転の理由は**機械ゲートではない。**鮮度・カバレッジ・型はいずれも緑のままである。
反転したのは**意味層**で、完全性評価が `docs/spec/` 7 枚の日の判定だったのに対し、
いまは 16 枚あり、**9 枚が 1 度も参照されていなかった。**

この 9 枚は独立に見つけていた（`docs/spec/08` ⑤ の点検）。
**同じ紙を 2 通りの経路で数えて同じになった**ので、数え間違いではない。

## 順番

**C01 → C03 → C02。**

C01（書面入力の取り込み）が先なのは、レポート自身が
「取り込み後に C03 再生成 → C05 再評価」と書いているためである。
C03 の 3 件には `depends_on` でこれを入れてある。

**C02 が最後なのは作業順の指定であって、技術的な依存ではない。**
依存として書くと、無い制約を在ることにしてしまうので `depends_on` には入れていない。
順番はこの本文が持つ。

## 焼き付けの禁止

`scripts/spec-freshness.mjs --write` は、**C05 が再び `PASS` した後にのみ**実行する。
先に焼くと「いまの仕様書に対する `PASS`」という虚偽が 1 コマンドで作れる。

門はこの穴を塞いである（`FRESH` かつ `verdict` が `PASS` のときだけ緑）。
焼き付けても赤は消えない。4 通り壊して 4 通り赤を実測済み。

## 子（9 件）

| 課題 | gap | 差し戻し先 |
| --- | --- | --- |
| `task-spec-gap-c01-spec-intake` | 0 | C01 |
| `task-spec-gap-c01-decisions` | 2 | C01 |
| `task-spec-gap-c01-qa-ref-scope` | 7 | C01 |
| `task-spec-gap-c03-doctrine-citation` | 1 | C03 |
| `task-spec-gap-c03-fence-repair` | 4 | C03 |
| `task-spec-gap-c03-nonnormative-note` | 6 | C03 |
| `task-spec-gap-c02-doc-refetch` | 3 | C02 |
| `task-spec-gap-harness-input-inventory` | 5 | harness |
| `task-spec-gap-resume-receipt-invalid` | 8 | 運用 |

**10 件目は無い。**「gaps 9 件 + harness の 1 件」と数えると 1 件多くなる——
harness の追随（`task-spec-gap-harness-input-inventory`）は `gaps[5]` そのものであり、
9 件の内側である。

## 入力と前提条件

- `system-spec/completeness-report.json`（`verdict: FAIL`、`gaps` 9 件）
- `docs/spec/` 16 枚と `system-spec/` 11 枚（鮮度の指紋の入力 27 件）

## 出力と成果物

子 9 件がすべて閉じ、C05 の再評価が `PASS` を返している状態。
そのあとで初めて `scripts/spec-freshness.mjs --write` を打つ。

## 依存関係

C03 の 3 件は `task-spec-gap-c01-spec-intake` の後。ほかは独立。

## 実装対象

`system-spec/` と `docs/spec/`。子ごとに触る場所は分かれている。

## Write scope と競合制約

この親自身はファイルを書かない。**束ねと順番の記録だけを持つ。**

## 実行手順

1. C01 の 3 件（取り込み・decisions・qa_ref 範囲）
2. C03 の 3 件（doctrine 引用・フェンス修復・非規範注記）
3. C02 の 1 件（ドキュメント再取得）
4. harness と運用の 2 件
5. C05 を foreground で再評価（**background では起動しない**——SKILL.md が名指しで禁じている）
6. `PASS` を確認してから `--write`

## 受入条件

- 子 9 件がすべて閉じている
- C05 の再評価が `PASS` を返している
- `pnpm run verify` の「仕様レポートの鮮度」が緑（`FRESH` かつ `verdict: PASS`）
- **`--write` を打った時刻が、再評価より後である**

## 検証方法

門を 4 通り壊して 4 通り赤になることは実測済み（`verdict` が `FAIL` / 欄が無い /
空 / 文字列でない）。**焼き付けても赤は消えない。**

## リスクとロールバック

`docs/spec/` を 1 文字でも直すと指紋が動き、`FRESH` が `STALE` へ戻る。
子を片付ける順に指紋が何度も動くので、**`--write` は最後に 1 度だけ**打つ。
戻すときは直前のタグへ `git revert`。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` 項目 90 の持ち越し（`docs/spec/08` ⑤）を
同じ回で片付け、状態欄を更新する。

## 規範

`system-spec/completeness-report.json`、`scripts/spec-freshness.mjs`、
`docs/product/backlog.md` 項目 90・91

## やらないこと

- **`--write` を、C05 が再び `PASS` する前に打つこと**（虚偽が 1 コマンドで焼ける）
- `system-spec/resume-receipt.json` を手で片付けること
- gaps を「9 件 + harness 1 件」と数え直すこと（harness は `gaps[5]` そのもの）
