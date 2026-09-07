CREATE TABLE `article_image` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`article_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`referenced` integer DEFAULT false NOT NULL,
	`last_referenced_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "article_image_byte_size_check" CHECK("article_image"."byte_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_image_object_key_unique` ON `article_image` (`object_key`);--> statement-breakpoint
CREATE INDEX `article_image_workspace_article_idx` ON `article_image` (`workspace_id`,`article_id`);--> statement-breakpoint
CREATE INDEX `article_image_reclaim_idx` ON `article_image` (`referenced`,`created_at`);