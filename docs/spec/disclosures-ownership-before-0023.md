# 旧 `disclosures` 行の所有者を確定する（ah-6lf.7）

実測日: 2026-08-30
対象: dev (`affiliate-hub-db-dev` / `d1d5f90a…`) と 本番 (`affiliate-hub-db` / `eb93e950…`) の
Cloudflare D1（いずれも `--remote`。読み取り (`SELECT`) しか流していない）

## 0. 起票時の番号がずれている

issue の題は「**0022** 適用前に既存 disclosures の所有者を確定する」だが、
`disclosures` に `workspace_id` を足すのは **`drizzle/0023_orange_mystique.sql`** である。
`0022_neat_virginia_dare.sql` は `disclosures` に 1 度も触れていない（`grep` で 0 件）。

番号がずれた理由は記録に残っている。2026-08-27 に dev を取り込んだとき、
**番号の重なった 15 本を schema から作り直した**
（`tests/integration/d1-migration-0035.test.ts` の冒頭注記）。
以下では実体である **0023** で書く。

## 1. 0023 が何をするか

冒頭 4 行が、この移行の設計そのものである。

> 既存の disclosures には workspace を復元できる列が無い。
> 空文字や先頭の workspace を推測で付けると、別 tenant の表記として読まれる。
> 旧行がある環境では何も書き換える前に止め、所有者 mapping を人が決めてから
> forward migration を作る。新規/空テーブル環境だけがこの migration を通る。

止め方は `CHECK` 制約である。**行数を数えて、0 でなければそこで落ちる。**

```sql
CREATE TABLE `_migration_0023_disclosure_guard` (
	`legacy_count` integer NOT NULL CHECK (`legacy_count` = 0)
);
INSERT INTO `_migration_0023_disclosure_guard` (`legacy_count`)
SELECT count(*) FROM `disclosures`;
DROP TABLE `_migration_0023_disclosure_guard`;
```

**一時表を作って捨てるだけで、どの表も書き換えない。**
`ALTER TABLE disclosures ADD workspace_id text NOT NULL` はこの 3 文の**後**に並んでいるので、
旧行があれば `INSERT` の時点で落ち、列は 1 つも足されない。

## 2. 実測

| 環境 | `disclosures` の行数 | `workspace_id` 列 | 適用済み migration の最後 |
|---|---|---|---|
| dev | **0 件** | **在る**（`ai_assisted` / `updated_at` も） | `0039_gentle_archive.sql` |
| 本番 | **0 件** | **無い** | `0018_lean_valkyrie.sql` |

本番の `disclosures` の列は 6 つで、0023 が足す 3 列がいずれも無い:

```
id, relationship_type, advertiser_or_supplier, editorial_influence, visible_message, created_at
```

## 3. 判定

**forward migration は要らない。両環境とも旧行が 0 件である。**

- dev は 0023 を**既に通過している**。通過できたということは、通過した時点でも 0 件だった
  （1 件でもあれば `CHECK` で落ちていた）。現在も 0 件。
- 本番は 0023 が**まだ来ていない**が、`disclosures` は 0 件なので、
  適用する日が来ても guard は通る。

受入条件「0 件ならその証跡が残る」に該当する。**所有者対応表を作る必要は無い**
——対応させる行が 1 行も無いためである。tenant 越境も起こりようがない。

## 4. 併せて分かったこと（この issue の範囲外・別に扱うこと）

**本番 D1 は `0018` までしか適用されていない。**ローカルには `0040` まで在るので、
**0019〜0040 の 22 本が未適用**である。dev は `0039` まで来ていて、
未コミットの `0040_serious_madelyne_pryor.sql` だけが残っている。

これは既報の「本番 D1 に `workspace_id` 列が無く、配色の読み書きが実行時に落ちる」の
**実測での裏付け**になる。落ちる原因は 0040 の欠落だけではなく、
**22 本ぶんの開きである。**

本 issue では**触っていない**。移行の適用は公開の手順（`deploy:dev` / 本番デプロイ）に
属していて、コミット・プッシュを伴う。この回はそれらが明示的に止められている。

## 5. 再現手順

```bash
for DB in affiliate-hub-db-dev affiliate-hub-db; do
  npx wrangler d1 execute $DB --remote --json \
    --command "SELECT count(*) AS n FROM disclosures"
  npx wrangler d1 execute $DB --remote --json \
    --command "SELECT name FROM pragma_table_info('disclosures')"
  npx wrangler d1 execute $DB --remote --json \
    --command "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 5"
done
```

**書き込みは 1 文も流していない。**`rows_written` は全応答で 0 である。
