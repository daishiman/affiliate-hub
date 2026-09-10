-- 公開日を作成日とみなさない。旧行に日時を捏造しない。
ALTER TABLE published_articles ADD COLUMN created_at TEXT;
--> statement-breakpoint
ALTER TABLE published_articles ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE content_variants ADD COLUMN created_at INTEGER;
--> statement-breakpoint
ALTER TABLE seo_auto_apply_log ADD COLUMN after_revision INTEGER;
--> statement-breakpoint
ALTER TABLE seo_auto_apply_log ADD COLUMN after_article_json TEXT;
--> statement-breakpoint
ALTER TABLE seo_auto_apply_log ADD COLUMN source_snapshot_json TEXT;
--> statement-breakpoint
ALTER TABLE seo_auto_apply_log ADD COLUMN source_after_revision INTEGER;
--> statement-breakpoint
ALTER TABLE seo_auto_apply_log ADD COLUMN approved_by TEXT;
--> statement-breakpoint
ALTER TABLE seo_auto_apply_log ADD COLUMN reverted_by TEXT;
--> statement-breakpoint
-- 通常保存/SEO反映/取消/非公開のどの更新経路も同じ版を進める。
-- revisionだけの内部UPDATEでは再帰しない。
CREATE TRIGGER published_article_revision_update
AFTER UPDATE OF site_slug, slug, workspace_id, source_article_id, type, title, summary,
 category_slug, author_slug, author_name, published_at, updated_at, archived_at,
 article_json, search_text, created_at ON published_articles
BEGIN
  UPDATE published_articles SET revision = OLD.revision + 1
  WHERE site_slug = NEW.site_slug AND slug = NEW.slug AND workspace_id = NEW.workspace_id;
END;
--> statement-breakpoint
CREATE TRIGGER published_article_created_at_immutable
BEFORE UPDATE OF created_at ON published_articles
WHEN NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'published_article_created_at_immutable');
END;
