---
graph_node_id: "task-tracking-code-issuance"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "analytics"
tags: ["analytics","monetization","measurement"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "公開のときに合言葉を発行して、転送の写しを作る"
owners: ["daishiman"]
created_at: "2026-08-18T00:00:00.000000Z"
updated_at: "2026-08-18T00:00:00.000000Z"
status: "draft"
depends_on: ["task-click-tracking-go-route"]
related_nodes: []
resource_scope: ["src/application/usecases","src/infrastructure/persistence/d1","src/application/read-models","tests"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-tracking-code-issuance.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":"docs/spec/03-分析・解析基盤仕様.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "転送経路（task-click-tracking-go-route）の書き込み側。仕様 03 §1.2 の resolver store 投影に直接対応する"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-tracking-code-issuance.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"not_applicable"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

**転送の入口 `/go/<合言葉>` に、実際に読者を通せるようにする。**

読む側（`/go/` の経路、写しを引く口、順位表と商品カードの描画）は
すべて済んでいて、本物のランタイムでも動くことを確かめてある。
**書く側が 1 か所も無い。** 合言葉を発行して `redirect_resolutions` へ
写しを置く経路が無いので、`trackingCode` は誰も埋めず、
実運用では順位表は今でも ASP の URL を直に出している。

## 背景

以下は着手前に確かめた事実である。

| 経路 | 状態 |
| --- | --- |
| `redirect_resolutions` を**読む** | 済み（`persistence/d1/redirect-repository.ts`。`select` だけ） |
| `redirect_resolutions` へ**書く** | **無い**。`src/` を全文検索しても `insert` が 1 件も無い |
| 読み取り用の型の `trackingCode` | 欄はある（`application/read-models/published-article.ts`）が、埋める経路が無い |
| 画面 | `trackingCode` があれば `/go/` を、無ければ ASP の URL を出す（実装済み） |

つまり今の状態は「入口は開いているが、そこへ通じる道を誰も敷いていない」である。
画面は普通に動くので、**この欠落は画面からは一切見えない**。

## 決めたこと（着手前の判断）

**写しに書く作業場所は、読者の身元ではなく「ブログを持っている側」の作業場所にする。**

数字は作業場所ごとに数える（`telemetry-repository.ts` の `query` は
`workspaceId` で絞る）。写しに読者の身元（所属なし＝`ws_public`）を書くと、
記録は貯まるのに管理画面は 0 のままになる。
実機確認のときに実際にこの形で 0 が出た（残課題 56 に記録）。
残課題 25 とまったく同じ壊れ方で、**貯まっているのに 0 と出るのは
いちばん切り分けにくい**。

**合言葉は推測できない値にする。** 連番や商品 ID から作ると、
他人のリンクを総当たりで引ける。`/go/` 側の形の検査は
`^[a-z0-9]{6,32}$` なので、この範囲の乱数にする。

## 入力と前提条件

- `redirect_resolutions` 表（`drizzle/0014_dazzling_viper.sql`）は済み
- `/go/[code]` の経路は済み・実機確認済み
- `affiliate_links` の表はまだ無い。転送先 URL は公開時点の値を写す

## 出力と成果物

1. 合言葉を発行して `redirect_resolutions` へ書く口（`RedirectResolutionPort` の書き込み側）
2. 公開の手続きから、その記事に載る成果リンクぶんの写しを作る
3. 読み取り用の型の `trackingCode` を、写しから埋める
4. 停止・期限切れを写しへ反映する口（貼り替え・提携終了のとき）
5. 上記の検査

## 受入条件

- 公開すると、その記事の成果リンクぶんの写しが `redirect_resolutions` に入る
- 写しの作業場所が、そのブログを持っている側の作業場所になっている
- 同じリンクを 2 回公開しても、合言葉が 2 つできない
- 合言葉は推測できない（連番でも商品 ID でもない）
- 写しに書く転送先は `https` のものだけ（`isSafeDestination` を通す）
- 公開した記事の順位表が、実際に `/go/<合言葉>` を描く

## 検証方法

`pnpm run preview`（Workers ランタイム）で記事を公開し、
`redirect_resolutions` に行が増えること、公開ページの順位表の
リンク先が `/go/` になっていること、押すと `/admin/analytics` の
リンククリック数が増えることを見る。**自動検査だけで済ませない。**

## 依存関係

`task-click-tracking-go-route`（読む側）。

## 実装対象

- `src/application/usecases/`（公開の手続き）
- `src/infrastructure/persistence/d1/redirect-repository.ts`（書き込み側）
- `src/application/read-models/published-article.ts`（`trackingCode` を埋める）

## Write scope と競合制約

`src/application/usecases/`、`src/infrastructure/persistence/d1/redirect-repository.ts`、
`src/application/read-models/`。`/go/` の経路と画面側は**触らない**（済んでいる）。

## 実行手順

1. 合言葉の発行と写しの書き込みを足す
2. 公開の手続きから呼ぶ
3. 読み取り用の型の `trackingCode` を写しから埋める
4. 停止・期限切れの反映を足す
5. `pnpm run preview` で公開して実際に押す

## GitHub publication

`local_only`。

## Handoff

**「転送は動いている」を額面どおりに受け取らないこと。**
動いているのは読む側だけで、実運用の読者は今も ASP の URL を直に踏んでいる。
残課題 56 の実機確認は、写しを手で入れて行ったものである。

## リスクとロールバック

いちばん危ないのは**作業場所の取り違え**である。画面は正常に見え、
数字だけが 0 のまま増えない。写しを書くところで作業場所を検査で固定する。

次に危ないのは**同じリンクに合言葉が 2 つできる**ことで、
クリックが 2 系統に割れて、どちらも実数より少なく見える。

戻すときは写しを作る呼び出しを外せば、画面は ASP の URL へ落ちる（いまの状態）。

## 規範

- `docs/spec/03-分析・解析基盤仕様.md` §1.2
- `docs/product/backlog.md` 25 / 56
- `src/domain/monetization/tracking-link.ts`
