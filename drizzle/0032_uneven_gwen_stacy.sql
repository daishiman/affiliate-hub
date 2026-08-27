CREATE TABLE `reader_tools` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`inputs` text NOT NULL,
	`how_to_read` text NOT NULL,
	`formula` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`site_slug`, `slug`)
);
--> statement-breakpoint
CREATE INDEX `reader_tools_site_idx` ON `reader_tools` (`site_slug`);