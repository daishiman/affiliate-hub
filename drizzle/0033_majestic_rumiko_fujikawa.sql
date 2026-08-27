CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`body` text NOT NULL,
	`reply_to` text,
	`rate_limit_key` text NOT NULL,
	`received_at` text NOT NULL,
	`handled_at` text
);
--> statement-breakpoint
CREATE INDEX `contact_messages_workspace_site_idx` ON `contact_messages` (`workspace_id`,`site_slug`,`received_at`);--> statement-breakpoint
CREATE INDEX `reader_tools_workspace_idx` ON `reader_tools` (`workspace_id`,`site_slug`);
