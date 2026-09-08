-- 公開記事の全文検索。
--
-- ==========================================================================
-- 検索用テキストの列
-- ==========================================================================
--
-- `article_json` から導ける値をあえて列に出す。導出の規則が SQL では
-- 書けないためである（何が「読者に読まれる文」かは記事の形を知っている
-- 層にしか判断できない）。規則の正本は `searchableTextOf`。
--
-- 既定値を空文字にしているのは、まだ書かれていない行を索引から
-- 落とさないためである。NULL にすると trigger の INSERT が NULL を運び、
-- 「本文が無い記事」と「まだ書かれていない記事」が同じ形になる。
ALTER TABLE published_articles ADD COLUMN search_text text NOT NULL DEFAULT '';--> statement-breakpoint
--
-- ==========================================================================
-- なぜ trigram なのか
-- ==========================================================================
--
-- SQLite の既定のトークナイザ（unicode61）は空白と記号で語を切る。
-- 日本語は語の間に空白を置かないので、記事 1 本がまるごと 1 語になり、
-- 「炊飯器」で検索しても当たらない。**索引は張れるが機能しない。**
--
-- 形態素解析器（MeCab など）は D1 に載せられない。そこで trigram を使う。
-- trigram は 3 文字の並びで索引を張るので、語の区切りを知らなくても
-- 部分一致が効く。代償は 2 つある:
--
--   1. **2 文字以下の語には当たらない。** 「AI」「時計」は trigram では
--      引けない。呼び出し側が部分一致へ落とす（`TRIGRAM_MIN_LENGTH`）。
--   2. 索引が本文より大きくなる。1 文字ごとに 3 文字分の項目ができるため。
--      公開記事だけを載せることで対象を絞っている。
--
-- ==========================================================================
-- なぜ external content ではなく独立した表なのか
-- ==========================================================================
--
-- `content=published_articles` にすると索引は本体を指すだけになって軽いが、
-- 本体と索引の同期がずれたときに **FTS 側が黙って壊れた行を返す**
-- （消えた rowid を指したまま）。復旧には rebuild が要る。
--
-- 独立した表なら、trigger が消し忘れても「古い行が残る」という
-- 目に見える壊れ方になり、`site_slug`/`slug` で本体と突き合わせて検出できる。
-- 索引の大きさより、壊れ方が見えることを取る。
CREATE VIRTUAL TABLE published_article_search USING fts5(
  site_slug UNINDEXED,
  slug UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'trigram'
);--> statement-breakpoint

-- ==========================================================================
-- 既存記事の本文の埋め戻し
-- ==========================================================================
--
-- 本来 `search_text` は `searchableTextOf` が決めるが、既に公開されている
-- 記事は次に公開し直すまで書き換わらない。それまで本文が検索できないのは、
-- 読者からは「書いてあるのに出ない」に見える。
--
-- そこで節の本文（`$.sections[*].paragraphs[*]`）だけを JSON から拾う。
-- 拾う範囲を鍵の形で絞っているのは、`json_tree` が文字列の葉を
-- 区別しないためである。絞らないと slug も URL も索引に入る。
--
-- 要点・FAQ・会話・商品名は拾わない。ここで拾える範囲を広げるほど
-- SQL 側に「何が検索対象か」の規則が二重に書かれ、
-- `searchableTextOf` と食い違ったときにどちらが正かが決められなくなる。
-- 次の公開で正しい範囲へ揃う。
UPDATE published_articles
SET search_text = coalesce(
  (
    SELECT group_concat(t.value, ' ')
    FROM json_tree(published_articles.article_json) AS t
    WHERE t.type = 'text'
      AND t.fullkey LIKE '$.sections[%].paragraphs[%'
  ),
  ''
);--> statement-breakpoint

INSERT INTO published_article_search (site_slug, slug, title, summary, body)
SELECT site_slug, slug, title, summary, search_text
FROM published_articles
WHERE archived_at IS NULL;--> statement-breakpoint

-- ==========================================================================
-- 索引の追従
-- ==========================================================================
--
-- 索引の更新をアプリ側に書かず trigger にしているのは、公開の経路が
-- 1 本ではないからである（編集からの公開、AI 公開、取り下げ、戻し）。
-- どれか 1 本で書き忘れると、その経路で出した記事だけが検索に出ない。
-- 出ないことは画面が壊れないので、誰も気づかない。
--
-- 取り下げた記事（`archived_at` が入っている）は索引から外す。
-- 読者に出ない記事が検索結果に出ると、押した先が 404 になる。
CREATE TRIGGER published_articles_search_ai AFTER INSERT ON published_articles BEGIN
  INSERT INTO published_article_search (site_slug, slug, title, summary, body)
  SELECT new.site_slug, new.slug, new.title, new.summary, new.search_text
  WHERE new.archived_at IS NULL;
END;--> statement-breakpoint

CREATE TRIGGER published_articles_search_ad AFTER DELETE ON published_articles BEGIN
  DELETE FROM published_article_search
  WHERE site_slug = old.site_slug AND slug = old.slug;
END;--> statement-breakpoint

-- 更新は「消してから入れ直す」。fts5 は UPDATE で列だけを差し替える形を
-- 持たないうえ、`archived_at` が付いた記事はそもそも索引から消す必要がある。
-- 消してから条件付きで入れ直せば、両方が同じ 1 つの規則で片付く。
CREATE TRIGGER published_articles_search_au AFTER UPDATE ON published_articles BEGIN
  DELETE FROM published_article_search
  WHERE site_slug = old.site_slug AND slug = old.slug;
  INSERT INTO published_article_search (site_slug, slug, title, summary, body)
  SELECT new.site_slug, new.slug, new.title, new.summary, new.search_text
  WHERE new.archived_at IS NULL;
END;
