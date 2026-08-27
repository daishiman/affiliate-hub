DROP TABLE IF EXISTS `_migration_0035_publication_idempotency_guard`;--> statement-breakpoint
CREATE TABLE `_migration_0035_publication_idempotency_guard` (
	`duplicate_groups` integer NOT NULL CHECK (`duplicate_groups` = 0)
);--> statement-breakpoint
INSERT INTO `_migration_0035_publication_idempotency_guard` (`duplicate_groups`)
SELECT COUNT(*) FROM (
	SELECT 1 FROM `publications`
	GROUP BY `workspace_id`, `idempotency_key`
	HAVING COUNT(*) > 1
);--> statement-breakpoint
DROP TABLE `_migration_0035_publication_idempotency_guard`;--> statement-breakpoint
DROP INDEX `publications_workspace_idempotency_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `publications_workspace_idempotency_idx` ON `publications` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
ALTER TABLE `llm_usages` ADD `capacity_consumed` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `llm_usages_workspace_capacity_idx` ON `llm_usages` (`workspace_id`,`purpose`,`capacity_consumed`,`occurred_at`);
