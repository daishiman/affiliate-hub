---
graph_node_id: "task-click-tracking-go-route"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "analytics"
tags: ["analytics","monetization","measurement"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "読者が成果リンクを押したことを、どのリンクか分かる形で記録する"
owners: ["daishiman"]
created_at: "2026-08-18T00:03:17.325065Z"
updated_at: "2026-08-18T00:03:17.325065Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/db/schema.ts","drizzle","src/app/go","src/infrastructure/persistence/d1","src/presentation/ui/patterns","tests"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-click-tracking-go-route.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":"docs/spec/03-分析・解析基盤仕様.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "計測とマネタイズにまたがる実装課題。仕様 03 §1.1/§1.2 と REQ-E13 に直接対応する"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-click-tracking-go-route.md","confidence":0.95}]
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

**読者が成果リンクを押したことを、どのリンクか分かる形で記録する。**

いまは押された回数が商品単位でしか残らず、
「どのASPのどのリンクが効いたか」が一度も記録されていない。
成果の突合も、改善ループの入力も、ここが埋まらないと始まらない。

## 背景

以下はすべて着手前に読んで確かめた事実である。

「クリックを1度も記録していない」は**半分だけ正しい**。

| 経路 | 状態 |
| --- | --- |
| 画面から送る `affiliate_click`（`src/presentation/telemetry/collector.tsx`） | **動いている**。`telemetry_events` へ入り、`affiliate_click_count` が導かれる |
| サーバ側の記録 `ClickTrackingPort.recordClick` | **スタブ**。呼ぶと必ず失敗する（`analytics-sample-repository.ts`） |
| `/go/<合言葉>` の転送経路 | **無い**。`src/app` のどこにも存在しない |

実際に欠けているのは次の 3 つである。

1. **どのリンクか分からない。** `AffiliateLink` 部品は
   `linkId ?? productId ?? "(リンクID未設定)"` を印にしており、
   呼び出し側（`product-card.tsx`）は `productId` しか渡していない。
   ASP・プログラムまで辿れないので、報酬との突合ができない
2. **順位表からのクリックが1件も数えられない。** 読み取り用の型
   `PublishedRankingEntry.affiliateUrl` は、`ranking-table.tsx` が**一度も読んでいない**。
   順位記事の成果リンクは画面に出ていない
3. **画面の JS が動かない場合に何も残らない。** 広告ブロックや JS 無効で欠測する。
   仕様 `docs/spec/03-分析・解析基盤仕様.md` §1.2 が定める
   `/go/{tracking_link_id}` のサーバ側記録が無い

ドメインの型（`src/domain/monetization/tracking-link.ts`）と
要件 REQ-E13 は済んでいる。**足りないのは保存先と転送経路と画面側の接続**である。

## 決めたこと（着手前の判断）

**クリックを `click_events` という別表に貯めない。`telemetry_events` の
`affiliate_click` へ寄せる。**

残課題 25 で「事実だけを貯め、指標は毎回導く」と決め、
計測と指標を 1 つの表へ寄せた。ここで別表を足すと、
**同じ「クリック数」が 2 つでき、食い違ったときにどちらが正しいか決められない**。
画面側の記録がすでにこの表へ入っている以上、別表は必ず食い違う。

二重計上は**印の付け方**で防ぐ。転送経路（`/go/`）を通るリンクは
サーバが記録するので、画面側は数えない。ASP が転送を許さない面
（仕様 §1.1 の `redirect_mode=direct_only`）は従来どおり画面側で数える。
どちらで数えたかは記録に残す。

## 入力と前提条件

- `src/domain/monetization/tracking-link.ts`（型と判定は実装済み）
- `telemetry_events` 表と D1 の記録先（接続済み・実機確認済み）
- `affiliate_links` 表は**まだ無い**。転送先 URL は仕様 §1.2 の
  resolver store（`redirect_resolutions`）に投影して持つ。
  この形なら提携先の表が無くても転送できる

## 出力と成果物

1. `redirect_resolutions` 表（仕様 §1.2 の形）とマイグレーション
2. `/go/[code]` の転送経路（302／未知は 404／停止・期限切れは 410）
3. `ClickTrackingPort` の実装（記録先は `telemetry_events`）
4. `AffiliateLink` 部品が転送経路の URL を受け取れるようにする
   （受け取ったときは画面側で数えない）
5. 上記の検査

## 受入条件

- 有効な合言葉で `/go/<合言葉>` を開くと、**ASP の URL へ 1 文字も変えずに** 302 する
- 未知の合言葉は 404、停止・期限切れは 410。**転送先を推測しない**
- `https` 以外の転送先は保存も転送もできない（オープンリダイレクトにしない）
- 記録に失敗しても 302 は返る（仕様 §1.2 の劣化契約）
- 同じクリックが画面側とサーバ側で二重に数えられない
- 順位表からの成果リンクが画面に出て、押すと記録される

## 検証方法

`pnpm run preview`（Workers ランタイム）で `/go/<合言葉>` を実際に開き、
転送先へ飛ぶことと、`/admin/analytics` にリンククリック数が増えることを見る。
**自動検査だけで済ませない。**

## 依存関係

無し。ドメインの型も `telemetry_events` も済んでいる。

## 実装対象

- `src/db/schema.ts` / `drizzle/`（`redirect_resolutions` 表）
- `src/app/go/[code]/route.ts`（転送経路）
- `src/infrastructure/persistence/d1/`（`ClickTrackingPort` の実装と合言葉の解決）
- `src/infrastructure/composition.ts`（スタブの差し替え）
- `src/presentation/ui/patterns/disclosure.tsx` / `ranking-table.tsx`（画面側の接続）

## Write scope と競合制約

`src/app/go/`、`src/infrastructure/persistence/d1/`、`src/presentation/ui/patterns/`、
`src/db/schema.ts`。`telemetry_events` の**列は変えない**（既存の記録を壊さないため）。

## 実行手順

1. `redirect_resolutions` 表とマイグレーションを足す
2. 合言葉の解決と `ClickTrackingPort` の実装を書く（記録先は `telemetry_events`）
3. `/go/[code]` を足す。302 / 404 / 410 と、記録の失敗が転送を止めないことを検査で固定する
4. 画面側を接続する。転送経路の URL を受け取ったときは画面側で数えない
5. 順位表の成果リンクを画面へ出す
6. `pnpm run preview` で実際に開いて確かめる

## GitHub publication

`local_only`。

## Handoff

**「クリックを記録していない」を額面どおりに受け取らないこと。**
画面から送る経路はすでに動いていて、`telemetry_events` に入っている。
足りないのは「どのリンクか」「順位表から」「JS が動かないとき」の 3 つである。
別表を作って数え直すと、いま入っている数字と食い違う。

## リスクとロールバック

いちばん危ないのは**オープンリダイレクト**である。
合言葉から URL を組み立てる経路を作らず、保存済みの `https` の値だけを返す。

次に危ないのは**二重計上**で、これは数字が増える方向に壊れるため気づきにくい。
どちらの経路で数えたかを記録へ残し、検査で固定する。

戻すときは `/go/` の経路を消せば、画面側の記録だけが残る（いまの状態に戻る）。

## 規範

- `docs/spec/03-分析・解析基盤仕様.md` §1.1 / §1.2
- `docs/spec/01-要求仕様書-v1.0.md` §19.2.1（REQ-E13）
- `src/domain/monetization/tracking-link.ts`
- `docs/product/backlog.md` 25（事実だけを貯め、指標は毎回導く）
