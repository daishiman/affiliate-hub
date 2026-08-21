CREATE TABLE `published_articles` (
	`site_slug` text NOT NULL,
	`slug` text NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`category_slug` text NOT NULL,
	`author_slug` text NOT NULL,
	`author_name` text NOT NULL,
	`published_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`article_json` text NOT NULL,
	PRIMARY KEY(`site_slug`, `slug`)
);
--> statement-breakpoint
CREATE INDEX `published_articles_site_category_idx` ON `published_articles` (`site_slug`,`category_slug`);--> statement-breakpoint
CREATE INDEX `published_articles_site_updated_idx` ON `published_articles` (`site_slug`,`updated_at`);--> statement-breakpoint
CREATE INDEX `published_articles_site_author_idx` ON `published_articles` (`site_slug`,`author_slug`);--> statement-breakpoint
CREATE INDEX `published_articles_workspace_idx` ON `published_articles` (`workspace_id`);