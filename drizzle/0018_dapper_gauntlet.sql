CREATE TABLE `affiliate_links` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`program_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`brand` text,
	`one_line` text,
	`original_url` text NOT NULL,
	`alteration_prohibited` integer DEFAULT true NOT NULL,
	`tracking_ref` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE INDEX `affiliate_links_workspace_idx` ON `affiliate_links` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `affiliate_links_workspace_product_idx` ON `affiliate_links` (`workspace_id`,`product_id`);