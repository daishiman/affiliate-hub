PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
DROP TABLE IF EXISTS `__blog_article_tag_integrity_guard`;--> statement-breakpoint
CREATE TABLE `__blog_article_tag_integrity_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__blog_article_tag_integrity_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `blog_article_tag` AS `link`
	LEFT JOIN `articles` AS `article` ON `article`.`id` = `link`.`article_id`
	LEFT JOIN `blog_tag` AS `tag` ON `tag`.`id` = `link`.`tag_id`
	WHERE `article`.`id` IS NULL
		OR `tag`.`id` IS NULL
		OR `article`.`workspace_id` IS NULL
		OR `article`.`site_slug` IS NULL
		OR `article`.`workspace_id` <> `tag`.`workspace_id`
		OR `article`.`site_slug` <> `tag`.`site_slug`
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__blog_article_tag_integrity_guard`;--> statement-breakpoint
CREATE TABLE `__new_blog_article_tag` (
	`article_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`article_id`, `tag_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `blog_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_blog_article_tag`("article_id", "tag_id") SELECT "article_id", "tag_id" FROM `blog_article_tag`;--> statement-breakpoint
DROP TABLE `blog_article_tag`;--> statement-breakpoint
ALTER TABLE `__new_blog_article_tag` RENAME TO `blog_article_tag`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
PRAGMA foreign_key_check;
