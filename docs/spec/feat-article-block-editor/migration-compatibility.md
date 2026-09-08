# 既存記事の互換確認とマイグレーション (P08)

- feature: `feat-article-block-editor`
- phase: P08
- 確認日: 2026-09-06

## 1. 記事本文へのマイグレーションは 0 本

保存形式の決定 (`opt-extended-markdown-string`) により、記事本文は
これまで通り 1 本の文字列である。19 種への拡張で

- 列は増えない
- 型は変わらない
- 既存の値は 1 バイトも書き換わらない

したがって**既存記事に触れるマイグレーションは存在しない**。
これが A7 のいちばん強い根拠である。移行が成功したかどうかに依存しない。

## 2. 追加したマイグレーション 2 本

`drizzle/meta/_journal.json` は 49 entries。末尾:

| idx | tag | 内容 |
| --- | --- | --- |
| 47 | `0047_article_image` | `article_image` の CREATE TABLE + 索引 3 本 |
| 48 | `0048_article_image_sweep_index` | 回収用索引の張り直し |

どちらも**新規テーブルに閉じている**。既存テーブルへの ALTER は無い。

### `0048` を別ファイルにした理由

`0047` の索引 `article_image_reclaim_idx` は (`referenced`, `created_at`) で、
外れた画像を拾い直せない設計だった ([data-model.md §索引](./data-model.md))。

これを `0047` の書き換えで直すこともできたが、そうしなかった。
**既に適用された環境がありうるマイグレーションは書き換えない。**
書き換えると、適用済みの環境と未適用の環境で、同じ tag が別の内容を指す。
どちらの状態にいるのかを後から言えなくなる。

前方向に足す:

```sql
DROP INDEX `article_image_reclaim_idx`;
CREATE INDEX `article_image_sweep_idx` ON `article_image` (`created_at`);
```

## 3. 前方互換の確認

| 確認 | 方法 | 結果 |
| --- | --- | --- |
| 既存 10 種の往復不変性 | `prose-format.test.ts` | PASS |
| 素の Markdown が段落として読める | `prose-body.test.tsx`「素の文章は、段落だけとして描かれる」 | PASS |
| 追加 9 種の記法が既存記事に現れない | 記法設計 (`:::` 囲み・フェンス・`- [ ]`) | 設計上成立 |
| 適用済み一覧との整合 | `tests/architecture/ci-config.test.ts` | PASS |

## 4. 後方互換 (切り戻し時の挙動)

新しい断片を含む記事を、旧版のコードで読むとどうなるか。

| 断片 | 旧版での見え方 |
| --- | --- |
| `code` | `` ``` `` フェンスの段落として素に見える |
| `checklist` | `- [ ] …` の箇条書きとして見える |
| `:::` 囲み 7 種 | `:::name …` の段落として素に見える |

**壊れて消えるのではなく、素の文字として残る。**
これは記法を「Markdown の上に載せた」ことの効き目である。
JSON 木で保存していたら、旧版は読めずに落ちる。

切り戻しの手順は [release.md](./release.md) (P13)。

## 5. 整理したもの

`prose-format.ts` の記法分岐を 1 か所へ寄せた
(`:::name attr=…` を切り出す処理を共通化し、`name` で分岐)。
種類ごとに固有のパーサを書かないので、20 種目を足すときに
触る場所が `case` 1 つで済む。
