CREATE TABLE `redirect_resolutions` (
	`code` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`affiliate_link_id` text NOT NULL,
	`destination_url` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_path` text NOT NULL,
	`placement` text NOT NULL,
	`product_id` text,
	`state` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `redirect_resolutions_workspace_idx` ON `redirect_resolutions` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `redirect_resolutions_site_idx` ON `redirect_resolutions` (`site_slug`);