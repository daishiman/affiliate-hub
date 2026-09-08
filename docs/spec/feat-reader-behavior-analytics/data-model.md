# データの形 — 読者行動の観測 (feat-reader-behavior-analytics)

P02 の成果物。表と列。正本は `drizzle/0044_funny_groot.sql` と
`src/db/schema.ts`。

## `reader_interaction_event`

```sql
CREATE TABLE `reader_interaction_event` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text,
	`kind` text NOT NULL,
	`segment` text NOT NULL,
	`viewport_band` text NOT NULL,
	`position_ratio` real DEFAULT 0 NOT NULL,
	`dwell_seconds` integer DEFAULT 0 NOT NULL,
	`element_key` text,
	`session_key` text NOT NULL,
	`rollup_day` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL
);
```

表名は単数形。仕様の `reader_interaction_events` と違うが、
この repo の既存の表がすべて単数なので合わせた。

## 列ごとの意図

| 列 | 型 | なぜこの形か |
|---|---|---|
| `id` | text PK | 生成した側が決める。重複した束を二度受けても行が増えない鍵になる |
| `workspace_id` | NOT NULL | 作業場所を跨いだ混線を構造で止める。全クエリの先頭条件 |
| `site_slug` | NOT NULL | AD-5。数値 id を跨いで持たない |
| `article_slug` | **nullable** | 記事外の閲覧（トップ・一覧・タグ）がある。ここが null の行は記事側の集計に乗らない |
| `kind` | NOT NULL | 5 種の列挙。範囲外は受け口が落とす |
| `segment` | NOT NULL | 5 種。参照元を畳んだ値 |
| `viewport_band` | NOT NULL | 3 種。実寸ではない |
| `position_ratio` | real 0〜1 | 記事の上から何割か。**px を持たない** |
| `dwell_seconds` | integer | 0〜3600。上限で頭打ち |
| `element_key` | nullable | 印を振った部品だけ。押下でない件には付けない |
| `session_key` | **NOT NULL** | 下記 |
| `rollup_day` | NOT NULL | 受け取り側が `occurred_at` から決める。端末の時計を信用しない |
| `occurred_at` | integer | 削除の基準。`rollup_day` は基準にしない |

## `session_key` が NOT NULL である件（仕様との差）

条件 1 は「同意が無い読者の行から `reader_key` が常に null」を求めるが、
**実装ではこの列が NOT NULL である**。

矛盾していないのは、**同意が無いときは行そのものが作られない**ため。

```ts
if (suppressAll || !allowBehaviour) return;   // 送信側
```
```ts
if (!decision.allowBehaviour) return ok({ accepted: 0, rejected: 0 });  // 受け口
```

つまり「null の行が存在する」のではなく「行が存在しない」。
条件が守ろうとしているもの（同意なしの読者が個人へ戻せる形で残らない）は、
より強い形で満たされている。

ストレージが使えない端末では `session_key` が空文字で入る。
`distinct` で 1 つにまとまるので、訪問者数がその端末ぶん減る。
これは `measurement-inventory.md` に近似であることとして書いた。

## 主キーを合成鍵にしなかった

`(workspace_id, site_slug, session_key, kind, occurred_at)` のような
合成鍵にすれば重複が構造で止まる。**採らなかった。**

- 同じ読者が同じ秒に同じ種別を 2 回起こすことは実際にある
  （速いクリック）。合成鍵だと 2 件目が黙って消える
- 鍵に `session_key` が入ると、**鍵から個人を引く経路ができる**。
  索引が張られるので、引くのが速くなる

代わりに `id` を送信側が生成し、二重受信は `id` の衝突で止める。
`ingest-contract.md` を参照。

## 索引

| 索引 | 列 | 使う場面 |
|---|---|---|
| `..._rollup_idx` | `workspace_id`, `site_slug`, `rollup_day` | 日次集計の絞り込み |
| `..._article_idx` | `workspace_id`, `article_slug`, `rollup_day` | 記事ごとの集計 |
| `..._retention_idx` | `occurred_at` | 90 日削除 |

**`session_key` に索引を張っていない。** 張れば
「この鍵の行を全部」が速く引けるが、それは条件 4 が
禁じているクエリそのものである。索引が無ければ全表走査になり、
実装しようとした人が性能で気づく。

削除用の索引が `occurred_at` 単独なのは、削除が作業場所を跨いで
「古いものを全部」消すため。

## 集計側の表

`site_daily_metric` / `article_daily_metric` は
feat-blog-metrics-rollup の所有。ここでは触れない。

この feature が保証するのは**生イベントの側だけ**で、
90 日削除の後も集計が残ることは、両者が別の表であることから従う。
