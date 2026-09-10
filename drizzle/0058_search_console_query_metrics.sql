ALTER TABLE `seo_page_metric` ADD `search_console_collected_at` integer;
--> statement-breakpoint
CREATE TABLE `seo_finding_site_snapshot` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`source` text NOT NULL,
	`last_collected_at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `site_slug`, `source`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seo_search_query_metric` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`page_key` text NOT NULL,
	`metric_date` text NOT NULL,
	`query` text NOT NULL,
	`impressions` integer NOT NULL,
	`clicks` integer NOT NULL,
	`position` real NOT NULL,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seo_search_query_metric_identity_idx` ON `seo_search_query_metric` (`run_id`,`workspace_id`,`site_slug`,`page_key`,`metric_date`,`query`);
--> statement-breakpoint
CREATE INDEX `seo_search_query_metric_read_idx` ON `seo_search_query_metric` (`workspace_id`,`site_slug`,`page_key`,`metric_date`);
--> statement-breakpoint
CREATE INDEX `seo_search_query_metric_cleanup_idx` ON `seo_search_query_metric` (`workspace_id`,`collected_at`);
--> statement-breakpoint
CREATE TABLE `seo_search_query_sync` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`metric_date` text NOT NULL,
	`active_run_id` text,
	`run_id` text NOT NULL,
	`status` text NOT NULL,
	`next_start_row` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`may_be_limited` integer DEFAULT false NOT NULL,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `site_slug`, `metric_date`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seo_search_query_sync_next_idx` ON `seo_search_query_sync` (`workspace_id`,`site_slug`,`status`,`updated_at`);
