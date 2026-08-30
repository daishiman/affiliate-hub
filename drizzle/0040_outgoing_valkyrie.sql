DROP INDEX `blog_affiliate_placement_site_article_idx`;--> statement-breakpoint
ALTER TABLE `blog_affiliate_placement` ADD `affiliate_link_id` text;--> statement-breakpoint
ALTER TABLE `blog_affiliate_placement` ADD `block_id` text;--> statement-breakpoint
ALTER TABLE `blog_affiliate_placement` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_affiliate_placement` ADD `last_rendered_at` integer;--> statement-breakpoint
ALTER TABLE `blog_affiliate_placement` ADD `updated_at` integer DEFAULT (unixepoch()) NOT NULL;--> statement-breakpoint
CREATE INDEX `blog_affiliate_placement_workspace_link_idx` ON `blog_affiliate_placement` (`workspace_id`,`affiliate_link_id`,`status`);--> statement-breakpoint
CREATE INDEX `blog_affiliate_placement_workspace_location_idx` ON `blog_affiliate_placement` (`workspace_id`,`site_slug`,`article_slug`,`block_id`,`position`);--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `canonical_url` text;--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `merchant_name` text;--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `price_minor` integer;--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `currency` text;--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `retrieved_at` integer;--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `source_method` text;--> statement-breakpoint
ALTER TABLE `affiliate_links` ADD `last_checked_at` integer;