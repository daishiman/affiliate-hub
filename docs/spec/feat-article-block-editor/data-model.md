# データモデル (P02)

- feature: `feat-article-block-editor`
- 実装観察更新: 2026-09-06。方式の承認状況は[image-upload-decisions.md](./image-upload-decisions.md)

## 1. 記事本文と配置

記事本文の列型は文字列のまま、19種の記法を拡張する。列型の維持は全既存記事の往復互換を保証しない。
検証範囲は[requirements-baseline.md](./requirements-baseline.md)のA7に従う。

商品配置は既存の`blog_affiliate_placement`とCTA carrierを使い、新しい公開用台帳を作らない。
配置変更の`articleUpdate`には読取時の`expectedRevision`を必須とし、通常の`saveArticle`で
記事本体・ブロック・タグ・公開JSON・配置台帳を同一batchに含める。別workspace・別記事の集約は拒否する。

## 2. article_image — 所有情報と永続状態

正本は`src/db/schema.ts`の`articleImages`、操作は`article-image-repository.ts`。

| 列 | 制約・意味 |
| --- | --- |
| id | text PK。URLに使う画像ID |
| workspace_id / article_id | not null。所属と初回の貼り先 |
| object_key | not null、unique。R2の保存キー |
| mime_type / byte_size | not null。保存時形式と容量、容量は正数 |
| lifecycle | pending / ready / deleting / deleted。既存行の移行既定はready、新規予約は明示的にpending |
| referenced | 前回確認した参照状態。現在の真実として単独で回収判定しない |
| last_referenced_at | nullable。参照を確認した時刻と、参照を外す保存処理の時刻を保持 |
| last_checked_at | nullable。点検の循環順を決める |
| created_at | not null。予約時刻。旧孤児の採用時はR2のアップロード時刻 |
| deleted_at | nullable。R2削除後に墓標へ移した時刻 |

id・object_key・workspace_id・article_idの変更をDBで拒否する。
deleting / deletedの行は物理削除できず、IDとキーの再利用を防ぐ墓標として保持する。

### 状態遷移

```text
予約 pending ── R2 put後に確定 ──▶ ready
      │                              │
      └──── 猶予経過・参照なし ────────┘
                     ↓ 原子的claim
                  deleting ── R2 delete成功 ──▶ deleted
```

deletingは期限付きleaseではなく不可逆。readyへの差し戻しや、遅れたfinalizeを許可しない。
R2削除失敗時はdeletingを残して再試行する。応答不明時にも状態を手で戻さない。

### 参照時刻

| 出来事 | 時刻・状態の扱い |
| --- | --- |
| 新規予約 | referenced=false、last_referenced_at=null |
| 本文／公開JSONへ参照を保存 | 同一transactionのtriggerがreferenced=trueと現在時刻を記録 |
| 参照を含む旧本文／公開JSONの更新・削除 | detachment triggerが旧参照の時刻を現在へ進め、外した直後の30日猶予を守る |
| 日次点検で参照あり | referenced=true、確認時刻へ更新 |
| 日次点検で参照なし | referenced=false、時刻は消さない |

保存時のdetachment記録と点検時の未参照処理を混同しない。猶予の詳細は[operations.md](./operations.md)。

## 3. 参照ビューと保存の排他

`article_image_reference_text`は同workspaceの`blog_article_block.body`と`published_articles.article_json`を対象とする。
生文字列に加え、妥当なJSONおよびExpressionBlock carrier内のJSON文字列値をjson_treeで復号して照合する。
画像IDの保守的な部分一致で保護するため、JSONエスケープで参照が見えなくなるのを防ぐ一方、不要な画像を長く保持する場合はある。
他記事へのコピー、下書き、削除済記事の復元用本文、取り下げ済み公開JSONも回収判定では保護する。匿名取得の公開判定とは別である。

`claimArticleImageDeletion`は猶予・現参照を同一UPDATEで確認し、呼出側の所有キー照合を経てdeletingへ進める。
DB triggerは参照がある画像のclaimと、非readyの既知画像を本文／公開JSONへ保存する操作を拒否する。
後者は`article_image_unavailable`を返し、保存境界で入力修正が必要なエラーに変換する。

## 4. 点検cursorと索引

`article_image_sweep_state`はid（article-images/）、nullableのcursor、整数versionを持つ。
R2の1ページを処理した後、読取版と一致するときだけcursorを進めるCASで、二重cronの古い結果による巻き戻りを防ぐ。

| 索引 | 用途 |
| --- | --- |
| article_image_workspace_article_idx | 所属記事ごとの取得 |
| article_image_sweep_idx | 作成時刻による候補抽出 |
| article_image_check_idx | last_checked_at・created_at・idによる公平な循環 |

履歴: 初期のreferencedを先頭にした回収索引は、参照が外れた画像を拾い直す設計に合わず0048で変更した。
0049で点検時刻を追加し、使用中の古い画像だけが繰り返し選ばれる問題を避けた。過去migrationは書き換えない。

## 5. マイグレーション

| ファイル | 内容 |
| --- | --- |
| 0047_article_image.sql | 画像台帳と初期索引 |
| 0048_article_image_sweep_index.sql | 回収索引の変更 |
| 0049_article_image_check_rotation.sql | 点検時刻と循環索引 |
| 0050_article_image_lifecycle.sql | lifecycle・削除時刻、cursor表、参照ビュー、状態／参照／detachment trigger、既存参照時刻の初期化 |

新コードは0050までを前提とする。隔離テストで適用を検証しているが、0047〜0050のremote適用とデプロイは未実施。
旧コードへの切替えでも台帳・cursor・墓標を保持する。具体的な制限は[release.md](./release.md)を参照。
