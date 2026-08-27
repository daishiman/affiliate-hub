CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`verification_status` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer,
	`claim_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `claims_workspace_product_idx` ON `claims` (`workspace_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `claims_workspace_valid_until_idx` ON `claims` (`workspace_id`,`valid_until`);--> statement-breakpoint
CREATE TABLE `evidence_records` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`captured_at` integer NOT NULL,
	`evidence_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_records_workspace_captured_idx` ON `evidence_records` (`workspace_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `test_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`method_version` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`run_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `test_runs_workspace_product_idx` ON `test_runs` (`workspace_id`,`product_id`);