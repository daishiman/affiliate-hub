---
graph_node_id: "task-layer-coverage-one-way"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["architecture","quality","testing"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "層別カバレッジの一覧が、src に層が増えた側を見ていない"
owners: ["daishiman"]
created_at: "2026-08-19T07:10:00Z"
updated_at: "2026-08-19T07:10:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-test-type-traits-remaining"]
resource_scope: ["tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"tests/architecture/quality-gates.test.ts の「層の一覧が src の実際の作りと一致する」は LAYER_COVERAGE の側からしかたどっていない","mvp_fit":"enabling","purpose":"src に層が増えたときに、測られていない層が緑で通らないようにする","rationale":"測られていない層は、カバレッジの数字の外側で育つ"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-layer-coverage-one-way.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T07:10:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "REQ-TS10 の未宣言理由を読み直したときに、コードを読んで見つけた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-layer-coverage-one-way.md","confidence":0.9}]
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

**`src` に層が増えたときに、測られていない層が緑で通らないようにする。**

## 背景

`tests/architecture/quality-gates.test.ts` の「層の一覧が `src` の実際の作りと
一致する」は、`LAYER_COVERAGE` を回して**その `dir` が存在するか**だけを見ている。

向きが片方しかない。`src` の下に層が増えて `LAYER_COVERAGE` に無い場合、
その層はカバレッジの下限を持たないまま、検査は緑を返す。

残課題 78 の 5 つ目（見ている範囲が、守りたい範囲より狭い）と同じ形である。
`REQ-TS10` を未宣言のまま残す理由を読み直したときに、**コードを読んで**見つけた。
壊して測ってはいない（測るには `src` の下に置き場を作る必要があり、
この作業場所では後始末に消す操作を使わない決まりのため）。

## 入力と前提条件

- `quality-gates.config.mjs` の `LAYER_COVERAGE`
- `tests/architecture/quality-gates.test.ts`「層の一覧が `src` の実際の作りと一致する」
- `src/` 直下の実際のディレクトリ

## 出力と成果物

1. `src` 直下の実ディレクトリ側から `LAYER_COVERAGE` を突き合わせる検査
2. 対応が無い層が見つかった場合、下限を決めるか、層でないことを明示するか

## 依存関係

`tasks/task-test-type-traits-remaining.md`（未宣言の点検の正本）。

## 実装対象

`tests/architecture/quality-gates.test.ts`、必要なら `quality-gates.config.mjs`。

## Write scope と競合制約

`tests`、`docs`。下限の数字は**下げる方向にしか動かさない**。

## 実行手順

1. `src` 直下のディレクトリを実際に読み、`LAYER_COVERAGE` と突き合わせる
2. 対応の無いものを一覧で出す。**0 件にするために表へ足すのではなく、
   まず何件あるかを見る**（層でないものが混ざっているなら、除く条件を明示する）
3. 除く条件は一覧ではなく規則で書く（`__tests__` のような形）

## 受入条件

- **`src` 直下に層を 1 つ増やして赤になることを実測**している
- 除外の条件が「名前の一覧」ではなく規則で書かれている
  （一覧にすると、増えた日に足せてしまう）
- 突き合わせる元の集合が空でないことの確認（空振り防止）がある

## 検証方法

`src` の下に置き場を 1 つ作り、赤になるところまで見る。
**後始末に消す操作を使わない。**壊す前に scratchpad へ複製を取り、
複製から書き戻す。作った置き場は、この課題を進める人が
`git` の追跡に入れないまま残しても構わない。

## リスクとロールバック

**表の側に足して緑にすると、この課題は「やった形」だけ残って何も守らない。**
守りたいのは「測られていない層が無いこと」であって、表が長いことではない。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` と `docs/product/required-test-types.md` §4
（`REQ-TS10` を残した理由の節）を更新する。

## 規範

`docs/product/required-test-types.md` §4、`docs/product/backlog.md` 項目 78

## やらないこと

- カバレッジの下限そのものを動かすこと（上げるのも下げるのも、この課題の外）
- `REQ-TS10` の宣言（層の一覧は要件の中心ではない。理由は §4 に書いてある）
