CREATE TABLE `seo_static_audit_scan` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`run_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`inventory_hash` text NOT NULL,
	`status` text NOT NULL,
	`inventory_complete` integer NOT NULL,
	`total` integer NOT NULL,
	`next_position` integer DEFAULT 0 NOT NULL,
	`lease_id` text,
	`lease_expires_at` integer,
	`lease_targets_json` text,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	`last_completed_at` integer,
	PRIMARY KEY(`workspace_id`, `site_slug`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `seo_static_audit_target` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`run_id` text NOT NULL,
	`page_key` text NOT NULL,
	`url` text NOT NULL,
	`article_slug` text,
	`position` integer NOT NULL,
	`target_updated_at` integer,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`last_failure_at` integer,
	`failure_code` text,
	`observation_json` text,
	PRIMARY KEY(`workspace_id`, `site_slug`, `run_id`, `page_key`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seo_static_audit_target_order_idx` ON `seo_static_audit_target` (`workspace_id`,`site_slug`,`run_id`,`position`);