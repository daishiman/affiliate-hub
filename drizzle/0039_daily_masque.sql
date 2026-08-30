ALTER TABLE `articles` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `save_token` text;