-- AI被引用チェックの1回上限（page/run）とは別に、実際のweb検索回数を
-- workspaceの全ブログで分け合う月次上限を持つ。既存workspaceは未設定で停止する。
ALTER TABLE seo_measurement_setting ADD COLUMN citation_monthly_search_limit integer;--> statement-breakpoint

-- 予約はsite行へ置くが、条件付きUPDATE内で同じworkspace・UTC月のSUMも検査する。
-- これにより別siteの並行cronも月次総枠を二重に予約できない。
CREATE TABLE seo_ai_citation_monthly_usage (
  workspace_id text NOT NULL,
  month_key text NOT NULL,
  site_slug text NOT NULL,
  used_searches integer DEFAULT 0 NOT NULL,
  unconfirmed_searches integer DEFAULT 0 NOT NULL,
  reserved_searches integer DEFAULT 0 NOT NULL,
  lease_id text,
  lease_at integer,
  revision integer DEFAULT 1 NOT NULL,
  updated_at integer NOT NULL,
  PRIMARY KEY (workspace_id, month_key, site_slug),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX seo_ai_citation_monthly_total_idx ON seo_ai_citation_monthly_usage (workspace_id,month_key);--> statement-breakpoint

-- 成功観測とは別の試行履歴。外部失敗が続く記事も巡回順の末尾へ送り、
-- 同じ失敗群が毎週の上限を占有し続けない。
CREATE TABLE seo_ai_citation_attempt (
  workspace_id text NOT NULL,
  site_slug text NOT NULL,
  article_slug text NOT NULL,
  page_key text NOT NULL,
  last_attempted_at integer NOT NULL,
  PRIMARY KEY (workspace_id, site_slug, article_slug),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX seo_ai_citation_attempt_order_idx ON seo_ai_citation_attempt (workspace_id,site_slug,last_attempted_at);
