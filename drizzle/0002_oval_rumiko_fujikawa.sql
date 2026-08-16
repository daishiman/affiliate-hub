CREATE TABLE `link_ingestions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`submitted_url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`source` text NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`state` text NOT NULL,
	`program_id` text,
	`product_id` text,
	`duplicate_of` text,
	`note` text,
	`rejected_reason` text
);
--> statement-breakpoint
CREATE INDEX `link_ingestions_workspace_state_idx` ON `link_ingestions` (`workspace_id`,`state`);--> statement-breakpoint
CREATE UNIQUE INDEX `link_ingestions_workspace_normalized_url_idx` ON `link_ingestions` (`workspace_id`,`normalized_url`);