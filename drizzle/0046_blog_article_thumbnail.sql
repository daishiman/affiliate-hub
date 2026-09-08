-- 記事に添えるサムネイルのうち、運営者が自分で上げた 1 枚（feat-thumbnail-visual-system）。
--
-- ==========================================================================
-- なぜ記事の表に列を足さず、別の表にしたのか
-- ==========================================================================
--
-- サムネイルを上げている記事は、当面のあいだ全体の一部である。
-- 記事の表に 5 列足すと、上げていない記事の行にも空の 5 列が並び、
-- 記事を 1 件読むたびにその分を運ぶ。
--
-- それより効くのは**寿命の違い**である。この行は R2 に置いた実体を指しており、
-- 行だけ消えて実体が残ると、誰も参照しない絵が置き場に積み上がる。
-- 別表にしておくと「行があるのに実体が無い」「実体があるのに行が無い」を
-- 突き合わせる 1 本が書ける。記事の列に混ぜると、その突き合わせは書けない。
CREATE TABLE blog_article_thumbnail (
  -- 記事 1 件に 1 行。差し替えは行の書き換えで、履歴は持たない
  -- （古い絵は参照が外れた時点で消すため、残す意味が無い）。
  article_id text PRIMARY KEY NOT NULL REFERENCES articles(id) ON DELETE cascade,
  workspace_id text DEFAULT '' NOT NULL,
  -- R2 の原本の鍵。置いたときの形をそのまま持つ。
  -- 記事の URL 名から組み直さないのは、名前を変えた日に消しに行って
  -- 空振りするため（domain/blogops/thumbnail-asset.ts）。
  object_key text NOT NULL,
  mime_type text NOT NULL,
  byte_length integer DEFAULT 0 NOT NULL,
  -- 実際に置けた派生の幅の JSON 配列。派生を作るのは投稿する側のブラウザなので
  -- 全部が揃うとは限らず、揃っていない幅を srcset に並べると 404 になる。
  derived_widths text DEFAULT '[]' NOT NULL,
  alt_text text DEFAULT '' NOT NULL,
  uploaded_at integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint

-- 作業場所で切って読む 1 本のため。記事 id は主キーなので、
-- ここで欲しいのは「この作業場所のサムネイル全部」を引く道である
-- （置き場の使用量を数える／実体との突き合わせ）。
CREATE INDEX blog_article_thumbnail_workspace_idx ON blog_article_thumbnail (workspace_id, article_id);
