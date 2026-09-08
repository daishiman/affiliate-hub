-- 公開rowのDELETE後にも版を保持し、同URL再公開によるCASのABAを防ぐ。
CREATE TABLE published_article_revision_counter (
  workspace_id TEXT NOT NULL,
  site_slug TEXT NOT NULL,
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, site_slug, slug)
);
--> statement-breakpoint
-- 移行時点の版を引き継ぐ。記事の本文・日時は変更しない。
INSERT INTO published_article_revision_counter (workspace_id, site_slug, slug, revision)
SELECT workspace_id, site_slug, slug, revision FROM published_articles;
--> statement-breakpoint
DROP TRIGGER published_article_revision_update;
--> statement-breakpoint
CREATE TRIGGER published_article_revision_insert
AFTER INSERT ON published_articles
BEGIN
  INSERT INTO published_article_revision_counter (workspace_id, site_slug, slug, revision)
  VALUES (NEW.workspace_id, NEW.site_slug, NEW.slug, NEW.revision)
  ON CONFLICT (workspace_id, site_slug, slug)
  DO UPDATE SET revision = published_article_revision_counter.revision + 1;
  UPDATE published_articles SET revision = (
    SELECT revision FROM published_article_revision_counter
    WHERE workspace_id = NEW.workspace_id AND site_slug = NEW.site_slug AND slug = NEW.slug
  ) WHERE workspace_id = NEW.workspace_id AND site_slug = NEW.site_slug AND slug = NEW.slug;
END;
--> statement-breakpoint
CREATE TRIGGER published_article_revision_update
AFTER UPDATE OF site_slug, slug, workspace_id, source_article_id, type, title, summary,
 category_slug, author_slug, author_name, published_at, updated_at, archived_at,
 article_json, search_text, created_at ON published_articles
BEGIN
  INSERT INTO published_article_revision_counter (workspace_id, site_slug, slug, revision)
  VALUES (NEW.workspace_id, NEW.site_slug, NEW.slug, OLD.revision + 1)
  ON CONFLICT (workspace_id, site_slug, slug)
  DO UPDATE SET revision = max(published_article_revision_counter.revision, OLD.revision) + 1;
  UPDATE published_articles SET revision = (
    SELECT revision FROM published_article_revision_counter
    WHERE workspace_id = NEW.workspace_id AND site_slug = NEW.site_slug AND slug = NEW.slug
  ) WHERE workspace_id = NEW.workspace_id AND site_slug = NEW.site_slug AND slug = NEW.slug;
END;
--> statement-breakpoint
-- 版counterの内部UPDATEは索引の値を変えない。INSERT時の二重索引登録も防ぐ。
-- FTSが読む列を変更したときだけ、既存と同じ置換規則を実行する。
DROP TRIGGER published_articles_search_au;
--> statement-breakpoint
CREATE TRIGGER published_articles_search_au
AFTER UPDATE OF site_slug, slug, title, summary, search_text, archived_at ON published_articles
BEGIN
  DELETE FROM published_article_search
  WHERE site_slug = old.site_slug AND slug = old.slug;
  INSERT INTO published_article_search (site_slug, slug, title, summary, body)
  SELECT new.site_slug, new.slug, new.title, new.summary, new.search_text
  WHERE new.archived_at IS NULL;
END;
