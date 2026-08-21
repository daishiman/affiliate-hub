CREATE TABLE `feedback_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`brand_id` text,
	`site_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`wish` text,
	`route` text NOT NULL,
	`origin_json` text NOT NULL,
	`technical_json` text NOT NULL,
	`capture_id` text,
	`submitted_by` text NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`status` text NOT NULL,
	`disposition_kind` text,
	`disposition_json` text,
	`handoff_count` integer DEFAULT 0 NOT NULL,
	`handoff_json` text NOT NULL,
	`beads_issue_id` text,
	`history_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_reports_workspace_status_idx` ON `feedback_reports` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `feedback_reports_workspace_route_idx` ON `feedback_reports` (`workspace_id`,`route`);--> statement-breakpoint
CREATE INDEX `feedback_reports_workspace_submitted_idx` ON `feedback_reports` (`workspace_id`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `integration_key_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key_id` text NOT NULL,
	`used_at` integer NOT NULL,
	`key_label` text NOT NULL,
	`fetched_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integration_key_usages_key_used_idx` ON `integration_key_usages` (`key_id`,`used_at`);--> statement-breakpoint
CREATE TABLE `integration_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`label` text NOT NULL,
	`hashed_value` text NOT NULL,
	`scopes_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`rate_limit_per_minute` integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_keys_hashed_value_idx` ON `integration_keys` (`hashed_value`);--> statement-breakpoint
CREATE INDEX `integration_keys_workspace_idx` ON `integration_keys` (`workspace_id`);