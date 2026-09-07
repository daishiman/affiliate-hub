DROP INDEX `article_image_reclaim_idx`;--> statement-breakpoint
CREATE INDEX `article_image_sweep_idx` ON `article_image` (`created_at`);