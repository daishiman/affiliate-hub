CREATE TABLE `asps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`site_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`external_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversions_program_id_idx` ON `conversions` (`program_id`);--> statement-breakpoint
CREATE INDEX `conversions_occurred_at_idx` ON `conversions` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`asp_id` text NOT NULL,
	`name` text NOT NULL,
	`advertiser` text,
	`category` text,
	`reward_amount` integer,
	`reward_rate` real,
	`status` text DEFAULT 'active' NOT NULL,
	`landing_url` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`asp_id`) REFERENCES `asps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `programs_asp_id_idx` ON `programs` (`asp_id`);--> statement-breakpoint
CREATE INDEX `programs_status_idx` ON `programs` (`status`);