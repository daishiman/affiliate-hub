# ブロックエディターの設計 (P02)

- feature: `feat-article-block-editor`
- phase: P02
- 消費: [`requirements-baseline.md`](./requirements-baseline.md), [`block-catalog-decisions.md`](./block-catalog-decisions.md), [`image-upload-decisions.md`](./image-upload-decisions.md)

## 1. 中心の考え — 編集面と公開面が同じ部品を通る

A3 は「公開ページで編集面と同じ見た目で表示される」と言う。
これを「両方で似た見た目になるよう気をつける」と読むと、19 種 × 2 か所 = 38 通りを
人が揃え続けることになり、必ずずれる。

そこで**描画を 1 か所に寄せる**。

```
                 ProseNode[]
                      │
              ┌───────┴───────┐
        (編集面)             (公開面)
     prose-editor.tsx      prose-body.tsx
              └───────┬───────┘
                同じ表示部品
   prose-section / prose-text / prose-table-frame
   rich-text / pick-list
```

編集操作の入力欄と読者向け表示は同じDOMではない。編集面の「本文プレビュー」は公開面と同じ`ProseBody`を使用する。編集欄は`RichText`、表枠、意味色、表の正規化を共有する。入力制御を公開コンポーネントへ持ち込まない。

## 2. 層の配置

| 層 | 置き場所 | 本 feature で担うこと |
| --- | --- | --- |
| domain | `src/domain/blogops/` | 19 種の型、記法の往復、許可リスト、画像の受け入れ規則 |
| application | `src/application/` | 商品検索、配置変更の認可と記事集約、公開モデルへの変換 |
| infrastructure | `src/infrastructure/` | 画像の R2 出し入れ、台帳の読み書き、日次回収 |
| presentation | `src/presentation/prose/`, `.../admin/publish/` | 編集面・公開面の描画 |
| route | `src/app/api/article-images/`, `.../article-products/` | HTTP の口 |

domain は HTTP も R2 も D1 も知らない。
`article-image-policy.ts` が MIME と大きさを決めるが、それは
「送られてきた値の判定」であって、送信そのものは知らない。

## 3. 断片の描画部品

| ファイル | 責務 |
| --- | --- |
| `prose-body.tsx` | `ProseNode[]` を受け取り 19 種へ分岐する入口 |
| `prose-section.tsx` | 節 (`h2`) の枠。断片との層の別を見せる |
| `prose-text.tsx` | 段落・見出し・引用など文字が主の断片 |
| `prose-table-frame.tsx` | `table` / `comparison-table` の枠 |
| `rich-text.tsx` | 行内の装飾 (`prose-inline.ts` と対) |
| `pick-list.tsx` | 検索して選ぶ UI。商品カードが使う |
| `prose-outline.tsx` | 見出し構造の表示 |

`prose-editor.tsx`は文書状態と操作を組み立てる。種類別入力はleaf、履歴と安定IDは`use-prose-draft.ts`、変換は`prose-conversion.ts`に分離する。19種のメタデータはdomainの正本を使う。

## 4. `/` メニューの構成

19 種を平らに並べると選べない。5 群に分ける (`PROSE_MENU_GROUPS`)。

| 群 | 断片 |
| --- | --- |
| 文章 | paragraph, heading, quote, callout, code |
| 一覧 | bullet-list, ordered-list, checklist, toggle |
| 見せ方 | image, image-row, columns, divider |
| データ | table, comparison-table |
| 差し込み | product-card, link-card, cta-button, embed |

群の切り方は「その断片で何をしたいか」であって、実装の都合ではない。

## 5. 見出しレベルを動かさない仕組み (A2)

レベルは**型で固定する**。`ProseNode` の `heading` は `level: 3 | 4` しか取らない。
節の見出しは `ProseNode` ではなく `ArticleBlock` 側にあり、描画は常に `h2`。

つまり「操作のたびにレベルを直す」処理を書かない。
そもそも別のレベルを表現できない型にしてある。
貼り付けで外から `h1` が来ても、パーサが `h3`/`h4` 以外を作れないので入らない。

**注意の分だけ、型で塞ぐ。** これが A2 の実装方針である。

## 6. 商品カードの経路 (A4)

```
[編集面 pick-list] --検索語--> GET /api/article-products?q=…
                   <--候補--   { items: [{ id, name }] }
   候補を選ぶ → ProseNode { kind: "product-card", productId }
```

`productId` を受け取る text 入力は作らない。値は候補の選択でしか入らない。

API が返すのは `id` と `name` だけである。報酬率などの商業データは返さない。
これは注意ではなく**型で塞いである**: use case 側の `guardEditorial` を通すので、
商業データを混ぜようとすると型エラーになる。

## 7. 画像の経路 (A5)

```
[編集面] --File--> POST /api/article-images (多部分)
                        │ 1. 形式と大きさを判定 (domain)
                        │ 2. D1 に pending を予約
                        │ 3. R2 へ put
                        │ 4. D1 を ready に確定
                   <--- { url: "/api/article-images/<id>" }
   → ProseNode { kind: "image", src: url }

[読者] --GET--> /api/article-images/<id> --台帳--> R2 --> 画像
```

これは2026-09-06の本人回答「ok」で承認された`opt-worker-proxy-upload`と一致するローカル実装経路である。
旧直接PUT承認は履歴として保持し、decision・infrastructure.web・security.webとcanonical章は現行方式へ反映済み。
承認根拠と残る検証の区別は[画像方式の判断状況](./image-upload-decisions.md)を参照。remote適用済みという意味ではない。

D1とR2は同一transactionにできないため、予約を先に残し、`ready`だけを取得・本文保存に使えるようにする。
確定応答が失われても既に`ready`の可能性があるため、失敗応答時にR2を即時補償削除しない。
未完了予約・未参照画像・遅延putの残存物は日次回収へ渡す。状態遷移とDB保護は[data-model.md](./data-model.md)に集約する。

## 8. 許可リスト描画 (A6)

`src/domain/blogops/prose-allowlist.ts` が、公開してよい断片・属性・スタイルを
**数え上げる**。公開面はこれを通ったものだけを描く。

denylist (危ないものを除く) にしない理由: 新しい断片を足したとき、
denylist だと**黙って通る**。allowlist なら**黙って落ちる**。
後者のほうが安全側の壊れ方である。

## 9. 日次回収の配線

`scheduled-maintenance.ts` の 8 番目の仕事として `waitUntil` へ登録する。
他の 7 本と同じく、自分の失敗を自分で記録して完了し、
他の仕事と Cloudflare の再試行へ波及させない。

`runArticleImageReclaim` は `createDeps()` を呼ばない。
`worker-entry.js` から届く経路なので、依存を丸ごと引くとバンドルが重くなる
(`tests/architecture/worker-entry-weight.test.ts` が見張っている)。
必要な `drizzle(binding, { schema })` だけを自前で組む。

台帳は最終点検時刻で500件ずつ循環し、同workspaceの本文・公開JSON・復元対象の参照を保護する。
回収はD1で不可逆の`deleting`をclaimしてからR2を削除し、台帳は`deleted`墓標として残す。
保存側triggerが非`ready`画像への再参照を拒む。R2側は`article-images/`を永続cursorで100件ずつ巡回し、旧孤児と遅延putを回収する。
猶予、JSONの復号照合、cursorの版番号CAS、障害時の扱いは[operations.md](./operations.md)を参照。

## 10. 商品と構造化表現の公開境界

`publishedProseProductIds`が本文中の参照を抽出し、D1 readerが公開行のworkspaceから必要な商品だけを取得する。`inlineProductCards`を`ArticleView`→canonical section→`ProseBody`へ渡す。末尾の商品一覧へ複製しない。商品名は本文へ焼き付けない。

ExpressionBlockは取得時に`structuredBlocks`へデコードして返し、管理画面の境界で専用入力に接続する。保存は既存carrier形式を維持し、同じIDを通常編集と暗黙保持の両方で二重保存しない。結論/要点/FAQは公開モデルの専用欄、出典/鮮度/CTA/仕様等は`expression-prose.ts`で明示的に変換する。壊れたcarrierのJSONを読者面へ露出させない。

## 11. 商品配置と記事保存の原子性

`review-blog-placements`は記事詳細とrevisionを読み、最新の公開状態で認可した上で対象CTAだけを変更する。
配置repositoryは同workspace・同記事の`articleUpdate`を必須とし、台帳SQLを既存`saveArticle`のbatchへ同梱する。
本文・タグ・revision・公開JSON・配置台帳を一括確定し、本文保存との競合や途中障害では一括取消する。公開用の別保存経路は作らない。

台帳単独の互換経路は記事が物理的に存在しない場合だけ許す。削除済み記事は復元してから変更する。
復元も記事revisionを増やし、読取時のrevision・deletedAtと勝者tokenでbatchを保護する。別の復元や配置保存に負けた処理はCONFLICTとなり、古い公開JSONを投影しない。同一時刻の復元→再削除もrevisionで区別する。
監査ログは従来どおり確定後に追記し、失敗時は保存済みであることを明示する。
