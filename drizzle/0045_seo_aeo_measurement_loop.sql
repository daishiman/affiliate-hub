-- SEO / AEO の計測ループ（feat-seo-aeo-measurement-loop）。
--
-- 3 系統（サイト内静的解析 / Search Console / AI 検索での被引用）から
-- 所見を集め、突き合わせ、条件を満たすものだけを自動で反映し、
-- 反映を 1 操作で戻せるようにするための保存先。
--
-- ==========================================================================
-- 所見は「いまの姿」、反映ログは「起きたこと」
-- ==========================================================================
--
-- 表を 2 つに分けているのは、寿命が違うためである。
-- 所見は直れば消える。反映ログは取り消しても残る。
-- 1 つの表に畳むと、取り消した記録が「直った所見」と一緒に消え、
-- 「勝手に変わった」と言われたときに確かめる先が無くなる。
CREATE TABLE seo_finding (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL,
  site_slug text NOT NULL,
  page_key text NOT NULL,
  article_slug text,
  source text NOT NULL,
  code text NOT NULL,
  detail text DEFAULT '' NOT NULL,
  observed_at integer DEFAULT (unixepoch()) NOT NULL,
  applied_at integer
);--> statement-breakpoint

-- (ページ, 規則) で一意。同じ違反を積まずに上書きする。
-- 積むと、直していない 1 件が 30 行になり、件数が「いま直すべき数」ではなく
-- 「どれだけ放置したか」を表すようになる。
CREATE UNIQUE INDEX seo_finding_page_code_idx ON seo_finding (workspace_id, page_key, code);--> statement-breakpoint
CREATE INDEX seo_finding_site_idx ON seo_finding (workspace_id, site_slug, source);--> statement-breakpoint
-- 未反映の所見が増え続けていること（NFR6）を数えるための索引。
CREATE INDEX seo_finding_unapplied_idx ON seo_finding (workspace_id, applied_at, observed_at);--> statement-breakpoint

-- 自動反映 1 回分。**snapshot_json が NOT NULL であることが可逆性の担保**（NFR1）。
-- 変更前を持たない行を作れないので、「先に記録する」が呼び出し側の心がけではなくなる。
CREATE TABLE seo_auto_apply_log (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL,
  site_slug text NOT NULL,
  page_key text NOT NULL,
  article_slug text NOT NULL,
  justified_by_json text DEFAULT '[]' NOT NULL,
  snapshot_json text NOT NULL,
  diff_summary text DEFAULT '' NOT NULL,
  applied_at integer DEFAULT (unixepoch()) NOT NULL,
  reverted_at integer,
  notified_at integer
);--> statement-breakpoint

CREATE INDEX seo_auto_apply_log_page_idx ON seo_auto_apply_log (page_key, applied_at);--> statement-breakpoint
CREATE INDEX seo_auto_apply_log_site_idx ON seo_auto_apply_log (workspace_id, site_slug, applied_at);--> statement-breakpoint

-- 系統ごとの最後の収集時刻（NFR6）。
-- 成否ではなく「最後に成功した時刻」を持つ。呼び出し自体が起きなくなる
-- 壊れ方でも、この列だけは同じように動かなくなる。
CREATE TABLE seo_source_collection (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL,
  source text NOT NULL,
  last_collected_at integer,
  last_failure_reason text DEFAULT '' NOT NULL,
  last_failed_at integer
);--> statement-breakpoint

CREATE UNIQUE INDEX seo_source_collection_idx ON seo_source_collection (workspace_id, source);--> statement-breakpoint

-- 計測ループの設定。作業場所ごとに 1 行。
--
-- `introduced_at` は自動反映の対象範囲を決める境界（NFR2）で、
-- 行を作るときに 1 度だけ入る。後ろへ動かせるようにしない ——
-- 動かせば導入前の記事まで対象になり、「触っていない記事が勝手に変わった」が起きる。
CREATE TABLE seo_measurement_setting (
  workspace_id text PRIMARY KEY NOT NULL,
  introduced_at integer DEFAULT (unixepoch()) NOT NULL,
  auto_apply_paused integer DEFAULT 0 NOT NULL,
  paused_at integer,
  resumed_at integer,
  citation_check_limit integer DEFAULT 50 NOT NULL
);--> statement-breakpoint

-- ページごとの実績（系統②③）。**積む。**
-- 所見と違って上書きしないのは、順位や押された率は「いまの値」より
-- 「動いたかどうか」に意味があるためである。
CREATE TABLE seo_page_metric (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL,
  page_key text NOT NULL,
  metric_date text NOT NULL,
  impressions integer DEFAULT 0 NOT NULL,
  clicks integer DEFAULT 0 NOT NULL,
  position real DEFAULT 0 NOT NULL,
  ai_citations integer
);--> statement-breakpoint

CREATE UNIQUE INDEX seo_page_metric_idx ON seo_page_metric (workspace_id, page_key, metric_date);
