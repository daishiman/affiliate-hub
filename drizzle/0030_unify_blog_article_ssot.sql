DROP INDEX `articles_slug_unique`;--> statement-breakpoint
ALTER TABLE `articles` ADD `workspace_id` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `site_slug` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `article_template` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `lead` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `author_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `deleted_at` integer;--> statement-breakpoint
INSERT INTO `articles` (
	`id`, `slug`, `workspace_id`, `site_slug`, `article_template`, `type`,
	`title`, `lead`, `status`, `author_name`, `published_at`, `deleted_at`,
	`created_at`, `updated_at`
)
SELECT
	`id`, `slug`, `workspace_id`, `site_slug`, `template`,
	CASE `template`
		WHEN 'T1' THEN 'ranking'
		WHEN 'T2' THEN 'review'
		WHEN 'T3' THEN 'guide'
		WHEN 'T4' THEN 'guide'
		ELSE 'guide'
	END,
	`title`, `lead`, `status`, `author_name`, `published_at`, `deleted_at`,
	`created_at`, `updated_at`
FROM `blog_article`;--> statement-breakpoint
DROP TABLE `blog_article`;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_site_slug_idx` ON `articles` (`workspace_id`,`site_slug`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `articles_legacy_slug_idx` ON `articles` (`slug`) WHERE "articles"."workspace_id" is null and "articles"."site_slug" is null;
