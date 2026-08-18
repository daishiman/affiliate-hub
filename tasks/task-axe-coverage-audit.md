---
graph_node_id: "task-axe-coverage-audit"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["a11y","quality","testing"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "axe が見ていない領域を一度洗う（個別に塞ぐやり方が 3 回続いた）"
owners: ["daishiman"]
created_at: "2026-08-19T05:00:00Z"
updated_at: "2026-08-19T05:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"読み上げの総当たり (axe) を通っているのに、壊しても赤にならない箇所が 3 例たまった","mvp_fit":"enabling","purpose":"axe の当たり範囲を洗い、要件表の a11y 欄が何を根拠に「対応」と言えるのかを決め直す","rationale":"1 件ずつ個別テストで塞ぐやり方が 3 回続いた時点で、それは見落としではなく道具の範囲の問題である"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-axe-coverage-audit.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T05:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "2026-08-19 の TM 群の宣言作業で、表の見出しの向きを壊しても緑だったことから 3 例目として立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-axe-coverage-audit.md","confidence":0.9}]
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

**読み上げの自動検査（axe）が、実際には何を見ていて何を見ていないのかを一度洗う。**

そのうえで、要件表の a11y 欄が「対応」と書けるのは何を根拠にしたときかを決める。

## 背景

2026-08-19 までに、**axe を含む全件が緑のまま通ってしまう壊し方が 3 例**たまった。

| 例 | 壊したもの | 結果 |
| --- | --- | --- |
| 1 | 道具の並び（`role="group"`）から名前を消す | 緑。axe は名前の無い `group` を違反に上げない |
| 2 | 操作部品が `role` を名乗らない | 緑 |
| 3 | 表の行の見出し (`<th scope="row">`) をただのマスにする／列の見出しから `scope` を全部落とす | 緑（2 通りとも） |

3 例とも、**壊した変更は axe まで確かに届いていた**。届いているのに測る側が見ていない。
残課題 78 の②「壊しても赤にならない理由が、守られていないからではなく
**壊し方が測定対象に届いていないから**」ではなく、その先の形である。

**1 件ずつ個別テストで塞ぐやり方が 3 回続いた。**
3 回続いたなら、それは 1 件ずつの見落としではなく**道具の範囲の問題**である。

いちばん重いのは、こちらの文書が 3 度「axe が通った＝アクセシブルではない」と
書いているのに、**要件表の a11y 欄はいまも axe を根拠に「対応」と書ける形のまま**である点。

## 入力と前提条件

- `tests/support/a11y.ts`（`TAGS` は WCAG 2.2 AA まで。`color-contrast` は無効にしてある）
- `tests/ui/page-render.test.tsx`（全ルートを回す総当たり）
- `docs/product/traceability.md` の a11y 欄
- 3 例の記録: `docs/product/required-test-types.md` §4、`docs/product/backlog.md` 項目 78 / 84

## 出力と成果物

1. **axe の規則のうち、この作業場所で実際に効くものと効かないものの一覧**
   （jsdom では常に判定不能になるもの、既定で無効にしてあるもの、規則自体が無いもの）
2. 上を踏まえた a11y 欄の書き方の決めごと（`docs/product/traceability.md` の凡例へ）
3. 効かない領域のうち、**自分で見るべきもの**の一覧（表の見出しの向き・名前の無いまとまり など）

## 依存関係

無し。ただし残課題 78 と同じ根（測る側の範囲）を扱う。

## 実装対象

`tests/support/a11y.ts` と、a11y を名乗っているテスト。

## Write scope と競合制約

`docs/`、`tests/`。実装（`src/`）は原則触らない。

## 実行手順

1. `axe-core` の規則一覧を取り、`TAGS` で有効になるものを機械で数える
2. そのうち **jsdom で常に判定不能（incomplete）になるもの**を実測で分ける
   （`axe.run` の `incomplete` を捨てずに見る。いまは `violations` しか見ていない）
3. 3 例の壊し方を当てて、**どの規則が拾うはずだったのか**を突き止める
   （拾う規則が無いのか、あるが無効なのか、あるが jsdom で判定不能なのかを分ける）
4. 「自分で見るべきもの」の一覧を作る
5. a11y 欄の凡例を決める。**「axe を回している」を根拠にしない書き方にする**

## 受入条件

- 効く規則と効かない規則が、推測ではなく**実測の一覧**として残っている
- 3 例それぞれについて、緑だった理由が上の 3 分類のどれかに割り当たっている
- a11y 欄の凡例が決まり、少なくとも 1 件の要件でその書き方に直っている

## 検証方法

一覧が実測であることは、**規則を 1 つ選んで意図的に違反を作り、赤くなるか**で確かめる。
壊すときは先に scratchpad へ複製を取り、複製から書き戻す。
`git checkout --` / `git restore` / `git clean` / `rm` は後始末に使わない。

## リスクとロールバック

`tests/support/a11y.ts` の設定を変えると、全画面の総当たりが一斉に赤くなりうる。
**規則を有効にする変更は 1 つずつ入れる。**一度に増やすと、どれが原因か分からなくなる。

## リスク: 「洗った」で終わること

一覧を作って終えると、**次に壊れたときも個別に塞ぐ**ことになる。
一覧そのものではなく、**a11y 欄の書き方が変わったか**が成果である。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` 項目 84 と、項目 78 の②の記述を更新する。

## 規範

`docs/spec/10-テスト戦略仕様.md` §3-4、`tasks/task-judgment-column-audit.md`

## やらないこと

- 個別画面の a11y テストをこの作業で足すこと（範囲が分かってから決める）
- 落ちる規則を無効にして緑にすること
