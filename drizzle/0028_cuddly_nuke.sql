CREATE TABLE `blog_delivery_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`part` text NOT NULL,
	`ok` integer NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`checked_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blog_delivery_snapshot_site_idx` ON `blog_delivery_snapshot` (`workspace_id`,`site_slug`,`part`);