CREATE TABLE `affiliate_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asp` text NOT NULL,
	`label` text NOT NULL,
	`public_tracking_id` text,
	`credential_ref` text,
	`connected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE INDEX `affiliate_accounts_workspace_idx` ON `affiliate_accounts` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `affiliate_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`asp` text NOT NULL,
	`advertiser_name` text NOT NULL,
	`reward_kind` text NOT NULL,
	`reward_percent` integer,
	`reward_amount_minor` integer,
	`reward_currency` text,
	`reward_note` text,
	`approval_rate` real,
	`confirmation_days` integer,
	`cookie_duration_days` integer,
	`restrictions` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `affiliate_programs_workspace_idx` ON `affiliate_programs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `affiliate_programs_account_idx` ON `affiliate_programs` (`workspace_id`,`account_id`);