-- ブログトップのおすすめは記事の複製ではなく、運営者が選んだ URL と順序。
-- 一時的な非公開で選定intentを失わず、同じ URL の再公開で復帰させるため、
-- published_articles への物理 FK は持たない。
CREATE TABLE `blog_home_featured_article` (
  `workspace_id` text NOT NULL,
  `site_slug` text NOT NULL,
  `article_slug` text NOT NULL,
  `position` integer NOT NULL,
  PRIMARY KEY (`workspace_id`, `site_slug`, `article_slug`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `blog_home_featured_article_position_idx`
  ON `blog_home_featured_article` (`workspace_id`, `site_slug`, `position`);--> statement-breakpoint

-- 新しく選ぶときは、同じ tenant/site で現在公開中の canonical projection が必要。
-- source_article_id は要件にしない。AI 公開など projection 単独の記事も正規の公開記事だからである。
CREATE TRIGGER `blog_home_featured_article_public_guard_insert`
BEFORE INSERT ON `blog_home_featured_article`
WHEN NOT EXISTS (
  SELECT 1 FROM `published_articles` p
  WHERE p.`workspace_id` = NEW.`workspace_id`
    AND p.`site_slug` = NEW.`site_slug`
    AND p.`slug` = NEW.`article_slug`
    AND p.`archived_at` IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'blog_home_featured_article_target_not_public');
END;--> statement-breakpoint

-- 位置だけの更新では再検査しない。そうすれば、保存済みの一時非公開 slug も並べ直せる。
CREATE TRIGGER `blog_home_featured_article_public_guard_identity_update`
BEFORE UPDATE OF `workspace_id`, `site_slug`, `article_slug`
ON `blog_home_featured_article`
WHEN NOT EXISTS (
  SELECT 1 FROM `published_articles` p
  WHERE p.`workspace_id` = NEW.`workspace_id`
    AND p.`site_slug` = NEW.`site_slug`
    AND p.`slug` = NEW.`article_slug`
    AND p.`archived_at` IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'blog_home_featured_article_target_not_public');
END;
