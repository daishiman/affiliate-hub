---
graph_node_id: "task-test-type-vocabulary-gap"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing","traceability"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "語彙に無いという理由で未宣言に残った要件が 4 件たまった"
owners: ["daishiman"]
created_at: "2026-08-19T05:10:00Z"
updated_at: "2026-08-19T05:10:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"実装にも検査にも問題は無いのに、付ける名前が語彙に無いという理由で宣言できない要件が 4 件たまった","mvp_fit":"enabling","purpose":"性質の語彙の不足を 1 件として扱い、足すか足さないかを決める","rationale":"1 件ずつなら「仕方ない」で流れるが、4 件たまった時点でこれは個別の残り物ではなく語彙の不足である"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-test-type-vocabulary-gap.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T05:10:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/required-test-types.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "TS06 / TS09 / TS10 / TM12 が同じ理由で未宣言に残ったため、4 件を 1 つの不足として立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-test-type-vocabulary-gap.md","confidence":0.9}]
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

**性質の語彙（`REQUIRED_TEST_TYPES`）の不足を、1 件の課題として扱う。**

「実装にも検査にも問題は無いが、付ける名前が無い」で未宣言に残った要件を並べ、
語彙を足すか、足さないと決めてその理由を書くかを決める。

## 背景

未宣言に残った理由は 3 通りある。

1. まだ書いていない（書けば宣言できる）
2. **当てどころが実装に無い**（実装が変われば宣言できる。例: `REQ-CI08` `REQ-CI12`）
3. **検査は実在して機能しているが、付ける名前が語彙に無い**

3 番目が 4 件たまった。

| 要件 | 実在する検査 | 足りないもの |
| --- | --- | --- |
| `REQ-TS06` | — | `a11y` を単独で要求する当てどころ |
| `REQ-TS09` | — | 同上（テスト戦略の 4 件のうち） |
| `REQ-TS10` | — | 同上 |
| `REQ-TM12`（層の分離） | `tests/architecture/dependency-direction.test.ts`（**壊すと赤くなる**） | 「層の分離・依存の向き」に当たる性質 |

**1 件ずつなら「仕方ない」で流れる。**実際、3 つの群でそのつど 1 件ずつ流れた。
4 件並べると、これは個別の残り物ではなく**語彙の不足**である。

**除外の枠（7/7 満杯）はこの課題の理由ではない。**上限を上げても何も解決しない。
除外は「宣言したうえで、この種別は**書かないと決めた**」の意味であり、ここはそうではない。

## 入力と前提条件

- `quality-gates.config.mjs` の `REQUIRED_TEST_TYPES`（性質 → 種別の対応表）
- `docs/product/required-test-types.md` §3・§4
- `tests/architecture/dependency-direction.test.ts`

## 出力と成果物

次の 3 つのいずれかに決着させ、決めたことを `docs/product/required-test-types.md` に書く。

1. **性質を足す**（例: 層の分離・依存の向き）
2. 足したうえで、**その性質を持つ要件を横断で洗い直す**
   （いま宣言済の要件の中にも、名乗るべきものがあるはず。ここを飛ばすと、
   新しい性質が「この 4 件のためだけの名前」になる）
3. **足さないと決める**。決めたなら理由を書き、以後この 4 件を「未宣言」ではなく
   **「語彙の外」として数える**（未宣言の上限に混ぜたままにしない）

## 依存関係

無し。ただし `ah-9id`（判定欄の点検）を進めるたびに同じ形が増えうる。

## 実装対象

`quality-gates.config.mjs`、`scripts/required-test-types.mjs`、`docs/product/required-test-types.md`

## Write scope と競合制約

`docs/`、`quality-gates.config.mjs`、`scripts/`。

## 実行手順

1. 4 件の要件を 1 つずつ読み、**何を守っているのか**を 1 行で書く
2. 4 つに共通する性質があるか見る（無ければ、まとめて 1 つの名前にしない）
3. 足すと決めたら、その性質から要求する種別を決める
4. **横断で洗い直す**（`docs/product/traceability.md` の全要件に対して、
   新しい性質に当たるものを探す）
5. 上限（`TEST_TYPES_MAX_UNDECLARED`）を実測に合わせて**下げる**

## 受入条件

- 4 件それぞれの行き先（性質を足した／語彙の外として数える）が決まっている
- 性質を足した場合、その性質を名乗る要件が **4 件より多い**
  （4 件だけなら、それは名前ではなく言い訳である）
- 上限は下げる方向にしか動いていない

## 検証方法

足した性質が効いていることは、**その性質を持つ要件から検査の印を外して赤になるか**で見る。
外した印は同じコミットで戻す。後始末に `git checkout --` / `git restore` を使わない。

## リスクとロールバック

性質を足すと、**いま緑の要件が一斉に赤くなりうる**（新しい種別を要求されるため）。
先に 1 件で試し、赤くなる件数を数えてから決める。
数が多ければ「足す」ではなく「足して、当面は除外理由つきで通す」も選択肢になるが、
**除外の枠は 7/7 で満杯**なので、その道を採るなら既存の除外を消すのが先である。

## リスク: 名前を作って満足すること

語彙を足すこと自体は成果ではない。**未宣言の数が減り、かつ嘘が増えていない**ことが成果である。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` 項目 86 と `docs/product/required-test-types.md` §4 を更新する。

## 規範

`docs/product/required-test-types.md`、`docs/spec/10-テスト戦略仕様.md`

## やらないこと

- 4 件を通すためだけの性質を作ること
- 除外の上限を上げること
