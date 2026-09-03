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

`published_articles` は公開 snapshot として残す。ブログ adapter は migration 後
`articles` を編集 aggregate として read/write し、公開状態へ移る操作だけが同じ
Unit of Work で canonical public projection を更新する。公開 reader は
`published_articles` だけを読み、`articles` との union や fallback を行わない。

## 0042: 公開記事 projection の一本化 (実装中)

次の migration は add-only で `articles.public_category_slug` と
`published_articles.source_article_id` を追加する。
既存の本文・評価・監査・墓標は物理削除しない。

1. 所有 workspace / site / slug の対応が一意かを事前検査する。cross-tenant の一致や
   複数候補は推測で選ばず、migration 全体を fail-fast で止める。
2. 同一 workspace / site / slug の projection が既にあれば公開 snapshot を保持し、
   対応する既存 `articles.id` だけを `source_article_id` へ結ぶ。
3. `articles` にだけある公開中・未削除の記事は、ブロックから deterministic に
   `PublishedArticle` を作り、projection が無い場合だけ補完する。旧データの
   カテゴリー欠落は任意値へ推測せず `uncategorized`（未分類）へ、
   空の書き手は「著者未設定」へ正規化し、従来公開されていた記事を落とさない。
4. tombstone、論理削除、archive、非公開状態は可視 projection より優先し、
   勝手に再公開しない。
5. 再実行しても既存 projection を上書きせず、同じ行数・identity に収束させる。

runtime の新規公開は blueprint に実在するカテゴリーの明示選択と
空でない書き手名を要求する。ブログ運用の
publish/update/unpublish/delete/restore と projection 更新を 1 回の
D1 batch に含める。AI 公開 writer も同じ statement builder を使い、直接 SQL の複製を
持たない。旧 `/blog/:slug` はデータ移行で別 URL を保存せず、実行時に
`articleHref` の canonical URL へ 308 redirect する。
また `source_article_id` のある行は BlogOps 管理だけが更新し、AI 公開記事用の
published admin からは一覧・訂正・非表示化しない。

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

0042 は SQL fixture で only-articles / only-projection / 同一 identity / tombstone /
削除済み / owner 不一致 / 再実行を先に検証する。remote 適用はこの作業の範囲外で、
ローカル GREEN だけを remote 適用済みの証拠として扱わない。

## ロールバック

corrective migration は `articles` の表再構築と `blog_article` の DROP を伴うため、新設表を落とすだけでは戻せない。
ロールバックは逆 migration で `blog_article` を再作成し、ブログ属性が non-null の `articles` 行だけを ID 維持で戻した後、
`articles` を旧 schema へ再構築する。本番適用前にバックアップと行数・ID・子参照整合の照合を必須にする。
