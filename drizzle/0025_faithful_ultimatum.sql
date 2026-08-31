CREATE TABLE `blog_article_block` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`kind` text NOT NULL,
	`heading` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blog_article_block_article_idx` ON `blog_article_block` (`article_id`,`position`);--> statement-breakpoint
CREATE TABLE `blog_article_rating` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`reader_key` text NOT NULL,
	`score` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_article_rating_reader_idx` ON `blog_article_rating` (`article_id`,`reader_key`);--> statement-breakpoint
CREATE TABLE `blog_article_tag` (
	`article_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`article_id`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `blog_article` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`slug` text NOT NULL,
	`template` text NOT NULL,
	`title` text NOT NULL,
	`lead` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_article_site_slug_idx` ON `blog_article` (`workspace_id`,`site_slug`,`slug`);--> statement-breakpoint
CREATE INDEX `blog_article_status_idx` ON `blog_article` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `blog_delivery_part` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`part` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_delivery_part_unique_idx` ON `blog_delivery_part` (`workspace_id`,`site_slug`,`part`);--> statement-breakpoint
CREATE TABLE `blog_layout_band` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`band` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`item_limit` integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_layout_band_unique_idx` ON `blog_layout_band` (`workspace_id`,`site_slug`,`band`);--> statement-breakpoint
CREATE TABLE `blog_layout_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`region` text NOT NULL,
	`slot_key` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_layout_slot_unique_idx` ON `blog_layout_slot` (`workspace_id`,`site_slug`,`region`,`slot_key`);--> statement-breakpoint
CREATE TABLE `blog_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_tag_site_slug_idx` ON `blog_tag` (`workspace_id`,`site_slug`,`slug`);--> statement-breakpoint
CREATE TABLE `site_network_node` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`role` text NOT NULL,
	`parent_slug` text,
	`name` text NOT NULL,
	`one_line` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_network_node_ws_slug_idx` ON `site_network_node` (`workspace_id`,`site_slug`);--> statement-breakpoint
CREATE INDEX `site_network_node_parent_idx` ON `site_network_node` (`workspace_id`,`parent_slug`);