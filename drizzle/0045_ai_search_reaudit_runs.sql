CREATE TABLE `ai_search_reaudit_runs` (
	`workspace_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`scanned` integer NOT NULL,
	`recorded` integer NOT NULL,
	`failed` integer NOT NULL,
	`failure_code` text,
	PRIMARY KEY (`workspace_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `ai_search_reaudit_runs_counts_check` CHECK (`scanned` >= 0 AND `recorded` >= 0 AND `failed` >= 0 AND `scanned` = `recorded` + `failed`),
	CONSTRAINT `ai_search_reaudit_runs_time_check` CHECK (`completed_at` >= `started_at`),
	CONSTRAINT `ai_search_reaudit_runs_state_check` CHECK (
		(`status` = 'succeeded' AND `failure_code` IS NULL AND `failed` = 0)
		OR (`status` = 'partial' AND `failure_code` = 'article_audit_failed' AND `recorded` > 0 AND `failed` > 0)
		OR (`status` = 'failed' AND `failure_code` = 'article_audit_failed' AND `recorded` = 0 AND `failed` > 0)
		OR (`status` = 'failed' AND `failure_code` = 'target_list_unavailable' AND `scanned` = 0)
	)
);
