CREATE TABLE `loop_observations` (
	`workspace_id` text NOT NULL,
	`run_id` text NOT NULL,
	`baseline_value` real NOT NULL,
	`baseline_samples` integer NOT NULL,
	`candidate_value` real NOT NULL,
	`candidate_samples` integer NOT NULL,
	`observed_at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `run_id`)
);
--> statement-breakpoint
CREATE TABLE `loop_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`loop_kind_key` text NOT NULL,
	`site_slug` text NOT NULL,
	`baseline_spec_id` text NOT NULL,
	`candidate_spec_id` text NOT NULL,
	`changed_dimensions` text NOT NULL,
	`primary_metric` text NOT NULL,
	`minimum_samples` integer NOT NULL,
	`status` text NOT NULL,
	`started_at` integer,
	`concluded_at` integer,
	`verdict` text,
	`stopped_reason` text
);
--> statement-breakpoint
CREATE INDEX `loop_runs_workspace_site_idx` ON `loop_runs` (`workspace_id`,`site_slug`);--> statement-breakpoint
CREATE INDEX `loop_runs_workspace_status_idx` ON `loop_runs` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `variant_specs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`label` text NOT NULL,
	`settings` text NOT NULL,
	`provenance_json` text NOT NULL,
	`approved_by` text,
	`approved_at` integer
);
--> statement-breakpoint
CREATE INDEX `variant_specs_workspace_site_idx` ON `variant_specs` (`workspace_id`,`site_slug`);