CREATE TABLE `blog_affiliate_placement` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text NOT NULL,
	`placement` text NOT NULL,
	`tracking_code` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blog_affiliate_placement_site_article_idx` ON `blog_affiliate_placement` (`site_slug`,`article_slug`);--> statement-breakpoint
CREATE TABLE `blog_template` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`template_id` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_template_site_idx` ON `blog_template` (`site_slug`);--> statement-breakpoint
CREATE TABLE `blog_theme` (
	`id` text PRIMARY KEY NOT NULL,
	`site_slug` text NOT NULL,
	`brand_theme` text NOT NULL,
	`color_mode` text DEFAULT 'auto' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_theme_site_idx` ON `blog_theme` (`site_slug`);--> statement-breakpoint
CREATE TABLE `guideline_references` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`publisher` text NOT NULL,
	`region` text NOT NULL,
	`checked_at` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `guideline_references_workspace_idx` ON `guideline_references` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `legal_page` (
	`id` text PRIMARY KEY NOT NULL,
	`site_slug` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_page_site_kind_idx` ON `legal_page` (`site_slug`,`kind`);--> statement-breakpoint
CREATE TABLE `page_theme_override` (
	`id` text PRIMARY KEY NOT NULL,
	`site_slug` text NOT NULL,
	`page_path` text NOT NULL,
	`brand_theme` text,
	`color_mode` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_theme_override_site_page_idx` ON `page_theme_override` (`site_slug`,`page_path`);