---
graph_node_id: "task-currency-mix-in-approved-total"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "monetization"
tags: ["money","currency","aggregation"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "確定分の合計が、通貨の違う成果を足して最後の 1 件の通貨で表示する"
owners: ["daishiman"]
created_at: "2026-08-19T13:30:00Z"
updated_at: "2026-08-19T13:30:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"src/application/usecases/monetization/manage-affiliate.ts の確定分合計のループで currency = amount.currency が毎回上書きされる","mvp_fit":"direct","purpose":"通貨が混ざった期間の金額表示を、嘘のない形にする","rationale":"最小単位を跨いで足したうえ、最後の 1 件の通貨の記号を付けて表示するため、桁が合わない数字が金額として出る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-currency-mix-in-approved-total.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T13:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/application/usecases/monetization/manage-affiliate.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "合計のループを読んで、上書きが起きる行を特定した"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-currency-mix-in-approved-total.md","confidence":0.9}]
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

確定分の合計が、**通貨の違う成果を足して、最後の 1 件の通貨で表示する**のを直す。

## 背景

`src/application/usecases/monetization/manage-affiliate.ts` の確定分合計のループ:

```ts
let currency: CurrencyCode = "JPY";
for (const c of raw) {
  ...
  approvedMinor += amount.amountMinor;
  currency = amount.currency;   // ← 毎回上書きされる
}
const total = money(approvedMinor, currency);
```

起きることは 2 つある。**どちらも黙って起きる。**

1. **最小単位を跨いで足す。** `amountMinor` は通貨ごとに意味が違う。JPY は 1 が 1 円、USD は 1 が 1 セント。混ざった期間では、100 円と 1 ドルが「100 + 100 = 200」として足される。
2. **最後の 1 件の通貨で表示する。** 並び順が変わるだけで、同じ期間の同じ成果が違う通貨で表示される。並び順は取り込みの順に依存するので、再取り込みで表示が変わる。

エラーにならない。金額の欄に、桁の合わない数字が金額の顔をして出る。

## 入力と前提条件

`effectiveReward(c)` が `{ amountMinor, currency }` を返す。通貨は成果ごとに付いている。

## 出力と成果物

通貨が混ざった期間で、合計が嘘にならないこと。形は 2 つ考えられる。

- 通貨ごとに分けて出す（`JPY 12,000 / USD 34.00`）
- 混ざっていたら合計を出さず、理由を出す（「通貨が混ざっているため合計できません」）

**どちらを採るかはこの項目で決める。**空やゼロが並ぶ表示には理由を 1 行出す決まりがあるので、
後者を採る場合も「合計できません」だけで終わらせない。

## 依存関係

なし。

## 実装対象

`src/application/usecases/monetization/manage-affiliate.ts`（確定分合計のループ）。

## Write scope と競合制約

`src/application/usecases/monetization/` と、対応する `tests/application/`。

## GitHub publication

`local_only`。

## 実行手順

**先に赤を作る。** 通貨が混ざった期間の成果を並べ、いまの合計が何を返すかを固定してから直す。

## 受入条件

- 通貨が混ざった期間で、最小単位を跨いだ足し算が起きないこと
- 並び順を変えても表示が変わらないこと（いまは変わる）
- 通貨が 1 種類だけの期間は、従来どおりの表示のままであること（陽性対照）

## 検証方法

`tests/application/` に境界値として置く。1 種類だけ・2 種類混在・確定が 0 件の 3 通り。

## リスクとロールバック

表示の形を変えるので、画面側の文言が影響を受ける。合計を出さない形を採ると、
いままで数字が出ていた場所が文になる。

## Handoff

採った表示の形（通貨ごとに分ける／合計を出さない）と、その理由をメモに 1 行残す。

## 規範

`docs/spec/` の金額の扱い。`money()` / `formatMoney()` は既にあるので、そこへ寄せる。
