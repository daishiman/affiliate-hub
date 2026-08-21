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
- **合言葉が発行されていないリンクが順位表に出たとき、それが分かる。**
  いまは黙って ASP の URL が出る。全部が一度に切り替わることはないので、
  切り替わっていない分が**何件あるか**を管理側から読めるようにする。
  0 件になるまで、突合できるクリック計測は完成していない
- **作業場所の食い違いを、検査で止められないかを 1 度考える。**
  残課題 25 と 56 で 2 回起きている。3 回目を機械で止められるなら止める。
  無理なら「無理だった」と理由を書く（考えずに通すことだけしない）

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

## 実施結果: 作業場所の食い違いを、検査で止められたか

**止められた。ただし全部ではない。** 3 つ置き、どれも壊してみて赤になることを確かめた。

| 歯止め | 置いた場所 | 何を止めるか | 赤の実測 |
| --- | --- | --- | --- |
| ① 身元を作らない構造 | `src/infrastructure/persistence/tracking-issuing-writer.ts` | 写しへ書く作業場所は `save(workspaceId, ...)` の**引数そのまま**。発行の側は身元を組み立てないので、読者の身元が入る経路が型の上で無い | 引数の代わりに `"ws_public"` を書いたら 4 件赤 |
| ② 往復で見る | `tests/integration/d1-tracking-issuance.test.ts`「作業場所の往復」 | 書いた身元で読み直して **1 件**、読者の身元で **0 件**。**両方見る**のが要で、読み直せることだけを見ると全部を同じ作業場所へ書く実装でも緑になる | 同上の 4 件に含まれる |
| ③ 読者の身元は 1 か所でしか作らない | `tests/architecture/tenant-scoped-ports.test.ts`「読者の身元は 1 か所でしか作らない」 | `src/` 全体を構文として読み、`ws_public` という文字列を書けるのは `presentation/composition.ts` だけに閉じる。保存する側が自分で読者を名乗れなくなる | 発行の実装に `"ws_public"` を書いたら 1 件赤 |

**止められないもの（正直に書く）。** 呼び出し元が渡す作業場所が、渡された時点ですでに
間違っている場合は、③ では分からない。文字列としては正しい形をしているので、
静的には見分けようがない。そこは ② の往復が受け持つ。**①②③ で 1 組**であり、
どれか 1 つでは越境した実装が緑のまま通る。

③ を grep ではなく構文木で見ているのは、この語が複数のファイルの**説明文**に出てくるためで、
grep にすると説明を書いた人が落ちる。落ちてほしいのは説明ではなく実装である。

## 実施結果: 実機（Workers ランタイム）で確かめたこと

`pnpm run preview`（localhost:8787）で実際に開いた結果を、返ってきた文ごと残す。

| 日付 | 見たもの | 実際に返ってきたもの |
| --- | --- | --- |
| 2026-08-18 | `/admin/analytics`（記事 0 本） | 「成果リンクがまだ 1 件もありません」「記事に成果リンクが入ると、ここに『クリックを突合できる件数』が出ます。0 件は、まだ出していないという意味です。」 |
| 2026-08-18 | `/admin/analytics`（成果リンク 1 件・合言葉なしの記事を 1 本入れた後） | 「成果リンク 1 件のうち 1 件は、クリックを突合できません」「この 1 件は ASP の URL を読者へ直に出しています。読者は普通に買えますが、押されたことは記録に残りません。（略）残っている記事: sample-site/runtime-check」 |

**確かめられなかったこと（下の節の理由による）。** 実機で記事を公開して
`redirect_resolutions` の行が増えるところは見られていない。公開の手続きから
成果リンクの載った記事が出てこないので、**実機で公開しても発行される合言葉は 0 件**になる。
発行そのものは本物の D1（`getPlatformProxy` = workerd の D1）に対して 8 件の検査で確かめてあるが、
**HTTP の入口から通したわけではない**。

## 実施結果: この作業で見つかった、より手前の欠落

**公開された記事には、成果リンクが 1 件も載らない。**

`src/application/usecases/site/publish-article.ts` の `buildArticle` は
`ranking` も `productCards` も作らない。読み取り用の型には両方の欄があり、
画面も順位表を描けるが、**それを埋めているのは見本データだけ**である
（`src/` 全体で `productCards:` を書いているのは見本の 1 か所と、埋め戻しの計算だけ）。

つまり今回の作業で繋いだのは「発行の口 → 保存先」であり、
**その手前（記事に成果リンクを載せる）が繋がっていない**。
残課題 56 で見つけた形（口はあるが、その経路からは動かない）が
1 段上でもう一度起きている。

この欠落は画面から見えない。順位表が空でも記事としては成立して見えるためである。
唯一の手がかりが `/admin/analytics` の「成果リンクがまだ 1 件もありません」で、
**この一文が無ければ 0 件であること自体に誰も気づけない**。

この作業の範囲は「発行の口」なので、ここでは直さず残課題へ起票する。
**REQ-E13 は完了にしない。**

## 規範

- `docs/spec/03-分析・解析基盤仕様.md` §1.2
- `docs/product/backlog.md` 25 / 56
- `src/domain/monetization/tracking-link.ts`
