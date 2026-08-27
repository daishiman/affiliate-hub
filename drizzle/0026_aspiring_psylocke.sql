CREATE TABLE `content_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`objective` text NOT NULL,
	`status` text NOT NULL,
	`domain_scope` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`package_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_packages_workspace_status_idx` ON `content_packages` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_packages_workspace_updated_idx` ON `content_packages` (`workspace_id`,`updated_at`);