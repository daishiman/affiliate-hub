CREATE TABLE `audience_personas` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`persona_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audience_personas_workspace_name_idx` ON `audience_personas` (`workspace_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `audience_personas_workspace_name_unique_idx` ON `audience_personas` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `author_personas` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`display_name` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`persona_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `author_personas_workspace_name_idx` ON `author_personas` (`workspace_id`,`display_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `author_personas_workspace_display_name_idx` ON `author_personas` (`workspace_id`,`display_name`);