# 点検履歴のデータモデル

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P02`
- 状態: 確定 (P02 成果物)
- 姉妹文書: [architecture.md](./architecture.md) / [api-contract.md](./api-contract.md)
- 上流の決定: [retention-policy.md](./retention-policy.md) の R1〜R4

## テーブル 1 枚だけ

`ai_search_audit_history` を 1 枚足す。7 チェックの結果を別テーブルに
正規化しない（下記「なぜ 7 行に割らないか」）。

```ts
export const aiSearchAuditHistory = sqliteTable(
  "ai_search_audit_history",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    slug: text("slug").notNull(),
    /** "publish" | "scheduled"。R3 が「テーブルは分けない」と決めた区別。 */
    trigger: text("trigger", { enum: AUDIT_TRIGGERS }).notNull(),
    /** 7 チェックのうち ok だった数。一覧の並べ替えに使うので列に出す。 */
    passedCount: integer("passed_count").notNull(),
    /** 7 チェックの総数。checks の形が変わった行を後から見分けられる。 */
    totalCount: integer("total_count").notNull(),
    /** AiSearchCheck[] をそのまま入れた JSON。 */
    checksJson: text("checks_json").notNull(),
    /** 解析ロジックの版。dec-analysis-history-retention が明示的に要求。 */
    analyzerVersion: text("analyzer_version").notNull(),
    checkedAt: integer("checked_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("ai_search_audit_history_article_idx").on(t.siteSlug, t.slug, t.checkedAt),
    index("ai_search_audit_history_workspace_idx").on(t.workspaceId, t.checkedAt),
  ],
);
```

## 列ごとの理由

### `id` は text の主キー

`blogArticleRatings` / `blogDeliverySnapshots` と同じ形。
自動採番の整数にしない — D1 は複数リージョンへ複製されるため、
採番の順序に意味を持たせると、書き込み経路が増えた日に破れる。

### 記事の指し方は `(site_slug, slug)`

`published_articles` の主キーが `primaryKey({ columns: [t.siteSlug, t.slug] })` なので、
履歴もこの 2 列で指す。

**`source_article_id` を鍵にしない。** `published_articles.sourceArticleId` は
「`articles` を経由しない公開は null」とコメントされており、
AI 公開の記事に履歴が付かなくなる。読者に出ている記事はすべて点検の対象である。

外部キー制約 (`references`) は付けない。`published_articles` の行が
取り下げ (`archived_at`) ではなく削除された場合でも、
**その記事が過去に何点だったかの記録は残す**。R3 が
「消したものと最初から無かったものを同じ形にしない」という
このリポジトリの一貫した選び方を継いでいる。

### `workspace_id`

`blogArticleRatings` のコメントと同じ理由 — 運営者が自分の作業場所の
履歴だけを引くとき、この列が無いと必ず `published_articles` を join することになり、
join を 1 度忘れた日に他所の履歴が混ざる。

### `passed_count` / `total_count` を列に出す

`checks_json` を毎回パースして数え直せば同じ値が出るが、
一覧の「落ちている記事だけ」の絞り込みと並べ替えは SQL でやりたい。
JSON をパースしないと絞れない設計にすると、
**全行を読んでからアプリ側で捨てる**ことになる。

`total_count` も持つ理由: 将来チェックが 7 個から増えたとき、
`passed_count = 6` が「7 個中 6 個」なのか「8 個中 6 個」なのかを
行だけで判別できる。持たないと、過去の行の意味が
現在のコードの定数に依存してしまう。

### `checks_json`

`AiSearchCheck[]` (= `{check, ok, hint}[]`) をそのまま入れる。
A5 が「落ちた理由 (hint) が読める」ことを求めており、hint は
`ai-search-audit.ts` が持つ日本語の文字列である。

**hint を保存する理由**: hint の文言が将来変わったとき、
過去の行は当時の hint を保つ。保存せず表示時に再生成すると、
「その日この記事に何と出ていたか」が復元できなくなる。

### `analyzer_version`

`dec-analysis-history-retention` が明示的に要求している列。
`ai-search-audit.ts` に定数 `AI_SEARCH_ANALYZER_VERSION` を置き、
チェックの内容を変えたときに上げる。

**刈り取りはこの列を持つ行を対象にする**（決定の原文）。
本テーブルでは全行が必ずこの列を持つので、実質的に全行が刈り取りの対象。
将来この列を持たない行が混ざる経路ができたら、その行は刈られない。

### `checked_at` は timestamp

`blogDeliverySnapshots.checkedAt` と同じ `integer(..., {mode: "timestamp"})`。
`published_articles.updatedAt` は text だが、あちらは JSON-LD へ
そのまま出す表示用の文字列で、こちらは比較と並べ替えに使う。
用途が違うので形も違ってよい。

## 索引

| 索引 | 列 | 用途 |
|---|---|---|
| `..._article_idx` | `(site_slug, slug, checked_at)` | R4 の刈り取り（記事ごとに古い順）と、R2 の「最終点検はいつか」 |
| `..._workspace_idx` | `(workspace_id, checked_at)` | 管理画面一覧（作業場所ごとに新しい順） |

記事ごとの索引に `checked_at` を含める理由: 刈り取りは
「この記事の行を古い順に並べて 30 件目より後を消す」であり、
記事で絞った後に時刻で並べる。索引に時刻が入っていないと
毎回並べ替えが走る。

## なぜ 7 行に割らないか

「1 点検 = 7 行（チェックごとに 1 行）」という正規化もあり得るが、採らない。

**1. 保持窓が数えられなくなる。** R1 は「1 記事あたり最新 30 件」と決めている。
7 行に割ると 30 件は 210 行になり、「30 件」を数えるのに
`DISTINCT checked_at` が要る。刈り取りの不変条件（R4 の「常に 30 以下」）が
行数から直接読めなくなる。

**2. 1 回の点検が原子的でなくなる。** 7 行のうち 3 行だけ書けた状態が
生まれ得る。「この記事のこの時刻の点検結果」が部分的に存在するという
中途半端な状態を、読む側が毎回考慮しなければならない。

**3. チェックの一覧で絞り込まない。** 一覧は「落ちている記事」を出すのであって
「『要点がある』が落ちている記事」を出すわけではない。
チェック単位の絞り込みが要求に無いのに、そのための正規化はしない。

## 保持窓の落とし方 (R4 の実装)

追記のトランザクション内で、次の 2 文を続けて実行する。

```sql
INSERT INTO ai_search_audit_history (...) VALUES (...);

DELETE FROM ai_search_audit_history
WHERE site_slug = ? AND slug = ?
  AND id NOT IN (
    SELECT id FROM ai_search_audit_history
    WHERE site_slug = ? AND slug = ?
    ORDER BY checked_at DESC, id DESC
    LIMIT 30
  );
```

**`ORDER BY` に `id DESC` を足す理由**: 同じ秒に 2 件入ると
`checked_at` だけでは順序が決まらず、どちらが残るかが実行ごとに変わる。
`id` を第 2 キーにすると決定的になる。

**`LIMIT 30` を保つ側で書く理由**: 「31 件目以降を消す」ではなく
「上位 30 件以外を消す」と書くと、何らかの理由で 40 件溜まっていた場合にも
1 回の追記で 30 件へ戻る。差分で書くと、溜まった分が溜まったまま残る。

保持窓の値 `30` は `src/application/usecases/seo/record-ai-search-audit.ts` の
定数 `AUDIT_HISTORY_WINDOW` として置く。SQL に直書きしない —
R1 の根拠（施策 1 サイクル × 2 回ぶん）を読める場所に置きたい。

## マイグレーション

`drizzle/0044_ai_search_audit_history.sql` として追加する
（現行の最新は `0043_canonical_public_articles.sql`）。

**追加のみ**。既存テーブルの列を変えない・消さない。
P08 が前方互換（既存マイグレーション適用済みの環境で
新テーブルが追加のみであること）を検証する。

## この文書が扱わないこと

- usecase の関数シグネチャ（P05 が実装時に確定する）
- 一覧の返却形（[api-contract.md](./api-contract.md) が所有する）
- 実際のマイグレーション SQL の生成（P05 が `drizzle-kit` で生成する）
