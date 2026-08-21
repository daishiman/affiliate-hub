---
graph_node_id: "task-ranking-unmarked-port"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["architecture","quality","testing"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "順位づけへ「印の無いもの」を渡すと実行時は素通りする（2 つの入口が逆向きの守りをしている）"
owners: ["daishiman"]
created_at: "2026-08-19T06:00:00Z"
updated_at: "2026-08-19T06:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"印 3 値 × 渡し先 2 種の総当たりを表にしたとき、1 通りだけが期待と食い違った","mvp_fit":"enabling","purpose":"順位づけ側と提携側で逆向きになっている守りを、どちらへ揃えるか決める","rationale":"型が止めるので今すぐ壊れはしないが、型を外した回に二段目も無くなる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-ranking-unmarked-port.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T06:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "REQ-FD02 の決定表を書いたときに実測で見つかった非対称を、実装の判断が要る項目として立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-ranking-unmarked-port.md","confidence":0.9}]
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

**同じ製品の中で、2 つの入口が逆向きの守りをしている。**どちらへ揃えるかを決める。

## 背景

`REQ-FD02`（報酬データを推薦スコア入力にしない）は、型と実行時の 2 段で守っている。
2026-08-19 に「印 3 値（editorial / commercial / 無し）× 渡し先 2 種（順位づけ / 提携）」の
総当たり 6 通りを表にしたところ、**1 通りだけが期待と食い違った。**

| 印 | 渡し先 | 実際 |
| --- | --- | --- |
| editorial | 順位づけ | 通る |
| commercial | 順位づけ | 落ちる |
| **無し** | **順位づけ** | **通る** ← ここ |
| editorial | 提携 | 落ちる |
| commercial | 提携 | 通る |
| 無し | 提携 | 落ちる |

順位づけ側（`rank-products.ts`）は `containsCommercial()` を使うので、
落とすのは**商業と名乗っているものだけ**である。提携側（`manage-affiliate.ts`）は逆に
**「商業の印が無い」を落とす**（付け忘れの検出）。

型（`Editorial<T>`）が止めるので、いまこれで壊れることはない。
危ないのは `as any` 相当で型を外した回で、**そのとき二段目も無い**。
実行時の印は「型を外した回を捕まえる」ために置いたものなので、
いちばん効いてほしい場面で効かない形になっている。

## 入力と前提条件

- `src/application/usecases/ranking/rank-products.ts`
- `src/application/usecases/monetization/manage-affiliate.ts`
- `src/domain/shared/data-classification.ts`（`containsCommercial`）
- 実態を書いた表: `tests/architecture/commercial-isolation.test.ts`

## 出力と成果物

1. どちらへ揃えるかの決定（順位づけ側を「全部 editorial の印が要る」へ変えるか、
   いまの非対称を意図として残すか）
2. 決めた側に合わせた実装と、決定表の書き換え

## 依存関係

無し。

## 実装対象

`src/application/usecases/ranking/rank-products.ts` ほか。

## Write scope と競合制約

`src`、`tests`。**組み立て（`createDeps`）の全体に影響する**ので、
順位づけ側を厳しくする場合は、渡している側を 1 つずつ確かめる。

## 実行手順

1. 順位づけの依存に渡っているポートを数え、`markEditorial` が付いていないものを洗う
2. 付いていないものがあれば、それが「付け忘れ」か「付ける意味が無いもの」かを分ける
   （`ids` や `now` のような、データではない依存が混ざっている可能性がある）
3. 分けた結果を見てから、厳しくするか残すかを決める

## 受入条件

- 決定表（`commercial-isolation.test.ts`）の 6 通りが、決めた側と一致している
- 順位づけ側を厳しくした場合、**印を外した状態で赤になることを実測**している
- 残すと決めた場合、**残す理由が表のコメントに書いてある**（いまは残課題 87 を指しているだけ）

## 検証方法

判定式を常に偽へ変えて、決定表が赤になることを測る。
壊す前に scratchpad へ複製を取り、複製から書き戻す。

## リスクとロールバック

厳しくする側へ倒すと、印の付いていない依存を渡している箇所が**組み立て時に落ちる**。
preview まで進めなくなるので、`pnpm run preview` で 1 周してから入れる。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` 項目 87 と要件表 `REQ-FD02` の判定欄を更新する。

## 規範

`docs/product/traceability.md` `REQ-FD02`、`docs/product/required-test-types.md` §4

## やらないこと

- 型（`Editorial<T>`）の側を緩めること
- 決定表から食い違った 1 通りを消すこと（消すと、次に同じことを測った人がまた驚く）
