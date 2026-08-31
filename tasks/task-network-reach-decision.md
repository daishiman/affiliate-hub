---
graph_node_id: "task-network-reach-decision"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "data"
tags: ["data","dx"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "設計図を持つ 5 本のうち 2 本しか公開していないのは、決めた結果ではない"
owners: ["daishiman"]
created_at: "2026-08-31T06:30:00Z"
updated_at: "2026-08-31T06:30:00Z"
status: "draft"
depends_on: ["task-seed-satisfies-public-entry"]
related_nodes: ["task-seed-satisfies-public-entry"]
resource_scope: ["scripts","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"見本の設計図は 5 本あるが、site_network_node に載るのは 2 本だけで、残り 3 本は 404 になる","mvp_fit":"enabling","purpose":"設計図を持つブログのうち何本を公開扱いにするかを決め、決めた形を機械で見張る","rationale":"いまの 2 本は誰かが決めた本数ではなく、書いた順に 2 本入れた結果である。決めていないことと、決めた結果 2 本であることは、画面から区別が付かない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-network-reach-decision.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-31T06:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/infrastructure/persistence/d1/blog-ops-repository.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "公開範囲の決め方そのものを問う仕様判断。実装ではなく決定が先に要る"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-network-reach-decision.md","confidence":0.9}]
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

見本の設計図を持つ 5 本のブログのうち、**何本を公開扱いにするか**を決める。
決めたうえで、その本数を機械が見張る形にする。

## 背景

`resolvePublicSiteIdentity` は `site_network_node` に `status='active'` の行が在ることを
公開の条件にしている。見本データはこの表に **2 本しか載せない**。

一方、`sampleSites()` は設計図を **5 本**持っている。差の 3 本
（`first-camera` / `run-and-recover` / `mobile-plan-navi`）は、設計図は在るのに
`/s/<名前>` を開くと 404 になる。

これは実装の誤りではない。誤りではないが、**決めた結果でもない。**
seed が網に載せるのは親と子の 2 本で、そう書いてあるからそうなっているだけで、
「3 本目以降を公開しない」という判断がどこかに記録されているわけではない。

**決めていないことと、決めた結果 2 本であることは、画面から区別が付かない。**
`task-seed-satisfies-public-entry` で直した 3 つの壊れ方と、症状が同じ形をしている。

## 実装対象

- `scripts/seed/local-seed-data.ts` の `seedNetwork()`
- `tests/architecture/seed-satisfies-public-entry.test.ts`（本数の主張を足す先）

## 入力と前提条件

- `task-seed-satisfies-public-entry` が済んでいること（設計図が入るようになっている）
- 何本を公開扱いにするかの判断。**これは人が決める。**

## 出力と成果物

- 公開扱いにする本数と、その理由を書いた記述
- 決めた本数から外れたら落ちる検査

## 実行手順

1. 3 本目以降を公開しない理由が在るのかを確かめる（親子関係の見本が 2 本で足りる、など）
2. 在るなら書き残す。無いなら 5 本とも網に載せる
3. 決めた本数を検査に固定する

## 受入条件

- `seedNetwork()` が載せる本数が、決めた本数と一致する
- 本数が変わったら落ちる検査がある
- なぜその本数なのかが、コードか文書のどちらかに書いてある

## 検証方法

`pnpm db:migrate:local` からやり直し、`/s/<5 本の名前>` をすべて開いて
**公開すると決めた本数だけが 200 を返す**ことを実測する。

## 依存関係

`task-seed-satisfies-public-entry` の後。設計図が入っていないと、
そもそも網に載せても 404 になるので判断が確かめられない。

## Write scope と競合制約

`scripts/seed/` と `tests/architecture/`。
`task-seed-satisfies-public-entry` と同じファイルを触るので、**同時に着手しない。**

## リスクとロールバック

網に載せる本数を増やすと、`seed-covers-cases.test.ts` が数える版面・固定ページ・
記事の件数が変わる。検査側の母数も併せて直す必要がある。
戻すときは `seedNetwork()` の配列を戻して `pnpm seed:local` を当て直す。

## Handoff

**「404 が出ているから壊れている」でも「仕様どおりだから正しい」でもない。**
仕様どおりではあるが、その仕様を誰も決めていない、という状態である。
決めるところから始めること。

## GitHub publication

`local_only`。

## 規範

- `src/infrastructure/persistence/d1/blog-ops-repository.ts`（公開条件の正本）
- `tasks/task-seed-satisfies-public-entry.md`（同じ形の壊れ方を 3 つ直した記録）
