# 統合整理とマイグレーションの前方互換

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P08`
- 状態: 確定 (P08 成果物)
- 読んだもの: [architecture.md](./architecture.md) / [data-model.md](./data-model.md) / [retention-policy.md](./retention-policy.md) / [acceptance.md](./acceptance.md)
- 確認日: 2026-09-04

## 0. この文書が答える 2 つの問い

1. **JSON-LD の組み立てを整理したが、出力は変わっていないか。**
2. **0044 を当てた既存環境は、履歴が 1 行も無い状態から正しく立ち上がるか。**

どちらも「たぶん大丈夫」では足りない。1 は何が変わらないと言えるかの根拠を、
2 は空の履歴が具体的にどの分岐へ落ちるかを、実物の SQL で示す。

## 1. JSON-LD 組み立ての整理

### 1.1 何が重複していたか

`src/application/seo/structured-data.ts` は 9 個の JSON-LD builder を持ち、
そのうち同じ形が複数箇所へ手書きされていた。

| 重複していた形 | 整理前 | 整理後 |
|---|---|---|
| `"@context": "https://schema.org"` | **8 箇所** | `SCHEMA_ORG_CONTEXT` 定数 1 箇所 |
| `mainEntityOfPage: { "@type": "WebPage", "@id": url }` | 3 箇所 | `webPageRef(url)` |
| `publisher: { "@type": "Organization", name }` | 2 箇所 | `organizationRef(name)` |
| FAQPage の `mainEntity` 組み立て | 2 箇所 | `faqMainEntity(items)` |
| 公開記事の絶対 URL | 2 箇所 | `articleUrl(article, site)` |

### 1.2 なぜ整理したか（好みの問題ではない）

**`@context` の無い JSON-LD は、検索エンジンに丸ごと無視される。**
語彙が決まらないので、`"@type": "HowTo"` が何の HowTo なのか機械には決まらない。
このとき出るのはエラーでも警告でもなく、**沈黙**である。ページは 200 で返り、
JSON も妥当で、ただ構造化データとして読まれない。

種類が増えるたびに 1 行の手書きが増える形は、次に足す人が 1 回書き忘れれば
そうなる。8 箇所あったものを 9 箇所にしないために寄せた。

### 1.3 出力が変わっていないと言える根拠

- **キー順が保たれる。** `jsonLdDocument(type, body)` は
  `{ "@context": ..., "@type": type, ...body }` を返すので、
  整理前と同じく `@context` → `@type` → 本体の順になる。
  `serializeJsonLd` は `JSON.stringify` で文字列にするため出力はキー順に依存する。
  順序を保つのは見た目のためではなく、**整理の前後で出力文字列が同一だと言うため**。
- **値を作る場所を動かしていない。** 各 builder の「何を出して何を省くか」の判断
  （空の資格・存在しない著者ページ・下書きの公開日・0 件の FAQ）は
  builder に残した。省略の理由は builder ごとに違い、寄せると理由がコメントごと失われる。
- **テスト。** `tests/application/seo/structured-data.test.ts` は
  `mainEntityOfPage` / `itemListElement` / `faq.mainEntity` / `author` を
  `toEqual`（**完全一致**）で見ている。余分なキーが 1 つ増えても、
  キーが 1 つ消えても落ちる。整理後も 31 件すべて緑。

### 1.4 寄せなかったもの（意図的）

- **運用側の記事 URL (`/blog/<slug>`) は `articleUrl` に寄せていない。**
  公開記事の URL は `articleHref` が記事型ごとの接頭辞（`/guides`, `/reviews`, …）を
  決めるのに対し、運用側は `/blog/` 固定である。**別の規則が偶然似ているだけ**で、
  1 つにまとめると片方の規則が変わった日にもう片方が黙って巻き込まれる。
- **`buildBlogPosting` と `buildBlogOpsPosting` の統合はしない。**
  前者は編集済みの読み取りモデル、後者は運用側の記事集約を取る。
  1 関数にすると引数の半分が常に `undefined` になり、
  「無い」と「渡し忘れた」が区別できなくなる（既存のコメントの判断を維持）。

## 2. マイグレーション 0044 の前方互換

### 2.1 0044 が何をするか

`drizzle/0044_ai_search_audit_history.sql` は次の 3 文だけを持つ。

1. `CREATE TABLE ai_search_audit_history`
2. `CREATE INDEX ai_search_audit_history_article_idx (site_slug, slug, checked_at)`
3. `CREATE INDEX ai_search_audit_history_workspace_idx (workspace_id, checked_at)`

**既存の表を一切変更しない。** `ALTER TABLE` も `UPDATE` も `DROP` も無い。
`published_articles` を含め、既存データに触れる文が 0 である。

journal は `0043_canonical_public_articles` (idx 43) の後ろへ
idx 44 を追記しただけで、既存 entry の `when` も `tag` も動かしていない。
既に 0043 まで当たっている環境は、0044 の 3 文を追加で流すだけで最新になる。

### 2.2 なぜ外部キーを張らないか

`(site_slug, slug)` は `published_articles` の複合主キーと同じ対だが、
**外部キー制約を張っていない**。記事が取り下げられたときに履歴が連鎖削除されると、
「なぜ取り下げたか」を後から辿れなくなるためである。
監査の記録は、監査対象が消えた後にこそ要る。

代償として、記事の無い履歴行（孤児）が残りうる。これは
[retention-policy.md](./retention-policy.md) の保持窓 30 件が記事単位で効くので、
孤児行は増え続けず、最大でも記事 1 本あたり 30 行で頭打ちになる。

### 2.3 履歴が 1 行も無い状態からの立ち上がり

**0044 を当てた直後、既存の公開記事はすべて履歴 0 件である。**
点検は公開時にしか追記されないので、過去に公開した記事は何も持っていない。
ここが前方互換の本題で、読み取り側 3 経路それぞれの振る舞いを確認した。

| 経路 | 履歴 0 件のときの振る舞い | 根拠 |
|---|---|---|
| 定期再点検 (`listStale`) | **最優先で拾われる** | `LEFT JOIN` + `h.last_checked IS NULL OR h.last_checked <= ?` |
| 管理画面の一覧 (`listLatestFailing`) | 0 件（表に出ない） | 最新の点検行が無いので「落ちている」と判定されない |
| 公開時の追記 | 通常どおり 1 行目が入る | 追記は既存行の有無を見ない |

`listStale` の並びは `ORDER BY h.last_checked IS NOT NULL, h.last_checked ASC, p.slug ASC`
で、第 1 キーが「点検済みかどうか」である。**一度も点検していない記事が先に来る。**

SQLite は `ORDER BY` で NULL を最小として扱うので `h.last_checked ASC` だけでも
同じ順になるが、それに頼ると方言が変わった日に順序が黙って入れ替わる。
明示して書いてある（実装のコメントと同じ判断）。

### 2.4 立ち上がりに何日かかるか

1 起動あたり `REAUDIT_BATCH_LIMIT = 50` 件、cron は `"0 17 * * *"` の 1 日 1 回。

- 公開記事 50 本以下: **翌日 1 回で全件が履歴を持つ**
- 公開記事 500 本: 10 日で全件（未点検が先に来るので、
  点検済みの記事の 7 日再点検に順番を奪われない）

**この期間中、管理画面の一覧は「落ちている記事」を過少に表示する。**
履歴の無い記事は落ちているとも通っているとも判定できないためで、
これは仕様どおりだが、運用開始直後に「0 件だから全部問題ない」と読むと誤る。
運用手順（P12）へ、初回投入から数日は一覧が埋まっていく途中であることを引き継ぐ。

### 2.5 0045 で定期再点検の最新状態を追加する

`drizzle/0045_ai_search_reaudit_runs.sql` は、管理画面が cron の成否を
読むための `ai_search_reaudit_runs` 表を 1 つ追加する。
過去の実行を無限に追記する履歴表ではなく、**1 workspace = 直近の最終状態 1 行**
とし、次の完了時に同じ行を上書きする。

- 時刻は D1 の integer timestamp（UTC epoch 秒）で、`started_at` と `completed_at` を持つ。
- 件数はこの回に選ばれた `scanned = recorded + failed` で整合させる。
- `status` と `failure_code` の組合せは CHECK 制約で固定し、対象 0 件の成功と対象取得失敗を混ぜない。
- 所有者は `workspace_id` が指す workspace。管理画面の読み口は actor の workspace しか受け取らない。

過去の実行を推定して backfill しない。0045 適用直後は「未実行」で、
最初の cron 完了後に初めて「成功」または「失敗」と時刻が入る。
これにより、履歴 0 件から立ち上がる 0044 の意図的な初期状態も作り変えない。

### 2.6 巻き戻し

0045 を巻き戻すときは、先に `DROP TABLE ai_search_reaudit_runs` を行う。
0044 は表の追加だけなので、その後の巻き戻しは `DROP TABLE ai_search_audit_history` で足りる。
既存表に副作用が無いので、巻き戻した後の状態は 0043 時点と同一になる。
落ちるのは再点検の最新状態と点検履歴だけで、記事そのものは何も失わない。

## 3. この確認が見ていないもの

- **実環境（dev / production の D1）へ 0044 / 0045 を当てていない。**
  確認したのは SQL の内容と、テストが使う D1 実機（`tests/integration/d1-*.test.ts` が
  同じマイグレーションを流す）まで。実データ量での実行時間は測っていない。
- **2.4 の日数は公開記事数の見積もりで、実測ではない。**
  cron が 1 回転で 50 件を処理しきることは検査しているが、
  500 本の環境を作って 10 日回したわけではない。
- **孤児行の実際の発生**は観測していない。記事を取り下げてから履歴を読む経路は
  現時点で管理画面に無い（一覧は `published_articles` と突き合わせる）。
