# API 契約 (P02)

- feature: `feat-article-block-editor`
- phase: P02

2026-09-06に本人が承認したWorker経由（`opt-worker-proxy-upload`）のHTTP契約と、現在のローカル実装を記録する。
旧直接PUT承認・現行承認・正規仕様への反映は[image-upload-decisions.md](./image-upload-decisions.md)で区別する。方式承認はremote適用や全受入検査の成功を意味しない。

## 1. `POST /api/article-images` — 画像を預ける

`src/app/api/article-images/route.ts` (`dynamic = "force-dynamic"`)

### 要求

| 項目 | 値 |
| --- | --- |
| 認証 | 必要 (`signedInActor()`) |
| 権限 | workspace全体に対する`content.write` |
| 本文 | `multipart/form-data` |
| `file` | `File`。png / jpeg / webp / gif、1 バイト以上 8 MiB 以下 |
| `articleId` | actor.workspaceId内に存在する未削除の記事ID |
| フィールド | `file`と`articleId`各1個だけ。重複・未知フィールドを拒否 |
| Origin | 要求URLと同一origin（不在・異なるoriginは403） |
| リクエスト全体 | multipart解析前にstreamを上限付きで読む。画像8 MiB＋64 KiB |

### 応答

| 状況 | HTTP | 本文 |
| --- | --- | --- |
| 成功 | 200 | `{ "url": "/api/article-images/<id>" }` |
| 未ログイン | 401 | problem |
| 権限なし | 403 | problem |
| Origin不一致 | 403 | problem |
| 所属記事なし・別workspace | 404 | problem |
| stream上限超過 | 413 | problem |
| form が読めない / `file` や `articleId` が無い | 400 | problem |
| 形式・大きさが規則外 | 400 | problem (理由つき) |
| R2 か D1 がつながっていない | **503** | problem |
| 所属記事を確認できない | 503 | problem |
| 予約・put・finalizeの失敗、確定できない | 502 | problem |

成功応答は `cache-control: no-store`。

### 503 を返す理由

置き場か台帳のどちらかが無いとき、**成功を装わない**。
ここで 200 を返して偽の URL を渡すと、利用者は画像が入ったと思い、
公開して初めて壊れているのに気づく。つながっていないなら、その場で言う。

### 処理順

1. 認証・権限・Origin
2. stream上限検査とformの取り出し
3. 申告MIME/容量と実バイト形式の一致検査 (domain)
4. bindingの取得と所属記事の存在確認
5. `crypto.randomUUID()` で id
6. **D1へpending予約**（IDとobjectKeyを先に確保）
7. **R2へput**
8. 同workspace・同ID・pendingを条件に**readyへfinalize**
9. ready確定時だけ`articleImageHref(id)`を返す

失敗応答でも保存が成立している可能性があるため、即時のR2補償deleteは行わない。
pendingや未参照ready、遅延putの残存物は永続台帳と日次回収で処理する。本文保存と回収の排他は[data-model.md](./data-model.md)を参照。

## 2. `GET /api/article-images/:image` — 画像を取り出す

`src/app/api/article-images/[image]/route.ts`

### 要求

readyの画像だけが対象。URLは`articleImageHref`と一致する正規パスに限定する。
公開画像は認証不要だが、台帳だけでは公開としない。有効サイトの未取り下げ公開記事JSONに同workspaceの画像参照が必要。
下書きは同workspaceのworkspace全体content.read権限と、所属記事が未削除であることを要求する。回収用の保守的なID照合を匿名取得の許可に流用しない。

### 応答

| 状況 | HTTP |
| --- | --- |
| 公開参照あり、または同workspaceの閲覧権限あり、実体あり | 200 + 画像バイト列 |
| 非公開かつ権限なし / 非ready / 台帳なし / 実体なし / 状態確認失敗 | 404 |

成功時のヘッダ:

| ヘッダ | 値 | 意図 |
| --- | --- | --- |
| `content-type` | 台帳の `mime_type` | 推測しない |
| `cache-control` | `private, no-store` | 公開取り下げ・認可変更後に共有キャッシュで再配布しない |
| `x-content-type-options` | `nosniff` | ブラウザに型を推測させない |
| `content-security-policy` | `default-src 'none'; sandbox` | 万一 script になりうる中身でも実行させない |

404 の本文は理由を分けない。「台帳に無い」と「実体が無い」を
外から区別できると、id の当たりはずれが分かってしまう。

## 3. `GET /api/article-products?q=…` — 商品を探す

`src/app/api/article-products/route.ts`

### 要求

| 項目 | 値 |
| --- | --- |
| 認証 | 必要 |
| `q` | 検索語、trim後200文字以内 |
| 件数 | 最大 8 件 |

### 応答

```json
{ "items": [ { "id": "pc_…", "name": "ブランド 商品名" } ] }
```

- `q` が空のとき、**全件ではなく空配列**を返す。
  検索していない人へ一覧を渡さない。
- 返すのは `id` と `name` だけ。報酬率・提携状況などの商業データは返さない。
  use case 側の `guardEditorial` を通しているので、
  混ぜようとすると型エラーになる。

未認証401、権限不足403、入力不正400、レート制限429、外部接続・予期しない失敗502。ドメインエラーのHTTP対応は共通の`statusOf`に従う。空結果と障害を区別する。全応答no-store。

## 4. ブラウザ側の呼び出し口

`src/presentation/admin/publish/article-asset-client.ts` (`"use client"`)

```ts
searchArticleProducts(query: string): Promise<readonly ProductPick[]>
uploadArticleImage(articleId: string, file: File): Promise<string>
```

どちらも**失敗時に空を返さず、投げる**。
検索が落ちたときに空配列を返すと、利用者には「該当なし」と見える。
落ちたことは落ちたこととして伝える。

アップロードの失敗はサーバの文言をそのまま渡す。
「大きすぎます」と「形式が違います」を、こちら側で言い換えて潰さない。

### 例外登録

このファイルは `guardedFetch` を通さず `fetch` を直接呼ぶため、
`tests/architecture/dependency-direction.test.ts` の `FETCH_EXEMPT` に登録した。
理由は 2 つ: 同一オリジンの相対パスしか叩かないこと、
`guardedFetch` が多部分 POST を運べないこと。

## 5. 商品配置と記事保存の契約

新しい公開APIは作らず、既存`review-blog-placements`のsave/removeを使用する。

- 読取は`content.read`、変更は`site.manage`。最新の記事詳細が公開中なら`content.publish`も必要。
- 対象CTAのみを追加・更新・削除し、残りの本文とタグを保持してposition順へ並べる。
- 配置portの`articleUpdate`は同workspace・同記事の集約と読取時`expectedRevision`を持つ。
  既存`saveArticle`の同一batchで配置台帳・記事・revision・公開JSONを確定する。
- 旧版／並行本文更新は`CONFLICT`。途中障害では同batchの変更を取消し、一部だけ成功にしない。
- 台帳単独の互換操作は記事が物理的にない場合だけ。削除済記事は復元後に変更する。
- 監査ログは確定後の追記。追記失敗時は変更済みであることを伝える従来契約を維持する。

画像の保存triggerによる`article_image_unavailable`は、`VALIDATION_FAILED`・field=`blocks`として画像の選び直しを促す。
DBのSQLや内部例外を画面へ返さない。検証の実測結果は[elegant-review.md](./elegant-review.md)へ集約する。
