CREATE TABLE `site_blueprints` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`pattern` text NOT NULL,
	`published_at` integer DEFAULT (unixepoch()) NOT NULL,
	`blueprint_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_blueprints_slug_idx` ON `site_blueprints` (`slug`);--> statement-breakpoint
CREATE INDEX `site_blueprints_workspace_idx` ON `site_blueprints` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `site_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`slug` text DEFAULT '' NOT NULL,
	`created_site_slug` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`draft_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_drafts_workspace_updated_idx` ON `site_drafts` (`workspace_id`,`updated_at`);