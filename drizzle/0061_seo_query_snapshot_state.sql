ALTER TABLE `seo_search_query_sync` ADD `active_may_be_limited` integer;--> statement-breakpoint
ALTER TABLE `seo_search_query_sync` ADD `active_completed_at` integer;
--> statement-breakpoint
-- Only the current completed run still has reliable completion metadata.
-- An older active run kept during collection has unknown metadata; keep NULL.
UPDATE `seo_search_query_sync`
SET `active_may_be_limited` = `may_be_limited`,
    `active_completed_at` = `updated_at`
WHERE `status` = 'complete' AND `active_run_id` = `run_id`;
