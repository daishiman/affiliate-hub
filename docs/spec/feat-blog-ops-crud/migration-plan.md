# マイグレーション計画

## 番号

次の空き番号は **0023**。既存は 0016–0022 まで埋まっている。
feat-blog-ui-builder が同じ 0023 を取りに来る可能性があるため、
衝突したときは番号ではなく**内容**で突き合わせる (P08 が所有)。

**実ファイル名は `drizzle/0025_faithful_ultimatum.sql`。**
計画時は `0023_blog_ops_crud.sql` と書いていたが、生成は `drizzle-kit generate`
が行い、名前は drizzle 側が採番と一緒に付ける (人が付ける余地がない)。
計画側の名前を残すと、実在しないファイル名を探す人が出るのでここで実名に直した
(2026-08-26)。突き合わせる先は名前ではなく**内容**である。

P08 corrective migration の実ファイルは `drizzle/0030_unify_blog_article_ssot.sql`。
0023 は当初表の履歴、0028 は記事正本を `articles` へ一本化する是正 migration であり、役割を混同しない。
現行の最新は `drizzle/0032_square_wolfpack.sql`。`blog_article_tag` の親 FK を
追加し、移行前 guard が既存不整合を見つけたら削除せず中断する。

## P08 corrective migration: 記事正本の一本化

既存 `articles` を編集正本にし、次の nullable 列を追加する:

- `workspace_id`, `site_slug`, `article_template`
- `lead`, `author_name`, `deleted_at`

legacy AI 行はブログ属性を推測せず NULL のまま保つ。`blog_article` 行は ID を維持して `articles` へ backfill し、
`article_template` から既存 `type` を domain mapping で導出する。子表の article ID は変更しない。backfill と子参照の整合を検査した後に `blog_article` を DROP する。

`published_articles` は公開 snapshot として残す。ブログ adapter は migration 後 `articles` のみを read/write し、dual-write は行わない。

## `legal_page.kind` の 6 種 → 8 種

SQLite に列挙型は無く、Drizzle の `enum` は TypeScript の制約にすぎない。
よって **DDL 変更は要らない**。`src/db/schema.ts` の enum 配列へ
`all_authors` / `disclaimer` を足すだけで、既存行は影響を受けない。
逆にロールバックしたい場合、新しい 2 種の行が残っていると
型が合わなくなるので、その 2 種の行を消してから戻す。

## 適用手順

```bash
pnpm db:generate           # schema.ts から SQL を出す
pnpm db:migrate:local      # ローカル D1 へ当てる
```

## ロールバック

corrective migration は `articles` の表再構築と `blog_article` の DROP を伴うため、新設表を落とすだけでは戻せない。
ロールバックは逆 migration で `blog_article` を再作成し、ブログ属性が non-null の `articles` 行だけを ID 維持で戻した後、
`articles` を旧 schema へ再構築する。本番適用前にバックアップと行数・ID・子参照整合の照合を必須にする。
