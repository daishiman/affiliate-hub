CREATE TABLE `affiliate_conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`program_id` text NOT NULL,
	`link_id` text,
	`asp` text NOT NULL,
	`external_conversion_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`confirmed_at` integer,
	`ingested_amount_minor` integer,
	`ingested_currency` text,
	`adjusted_amount_minor` integer,
	`adjusted_currency` text,
	`adjustment_reason` text,
	`period` text NOT NULL,
	`period_closed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `affiliate_conversions_workspace_period_idx` ON `affiliate_conversions` (`workspace_id`,`period`);--> statement-breakpoint
CREATE INDEX `affiliate_conversions_workspace_external_idx` ON `affiliate_conversions` (`workspace_id`,`asp`,`external_conversion_id`);