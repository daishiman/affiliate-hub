ALTER TABLE `article_image` ADD `last_checked_at` integer;--> statement-breakpoint
CREATE INDEX `article_image_check_idx` ON `article_image` (`last_checked_at`,`created_at`,`id`);