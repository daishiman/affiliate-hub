-- 旧実績行は Search Console 由来。AI だけの日は false とし読取時に検索値を null にする。
ALTER TABLE seo_page_metric ADD COLUMN search_console_observed INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE seo_page_observation (
  workspace_id TEXT NOT NULL,
  site_slug TEXT NOT NULL,
  article_slug TEXT,
  page_key TEXT NOT NULL,
  source TEXT NOT NULL,
  last_collected_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, page_key, source)
);
--> statement-breakpoint
CREATE INDEX seo_page_observation_rotation_idx ON seo_page_observation(workspace_id, site_slug, source, article_slug, last_collected_at);
