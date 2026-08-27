CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`display_name` text NOT NULL,
	`legal_name` text,
	`contact_email` text,
	`created_at` integer NOT NULL,
	`brand_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brands_workspace_idx` ON `brands` (`workspace_id`);