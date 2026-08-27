-- 0036の回復可能な表再構築がrevision列まで収束させる。
-- 0037は履歴上の意味を保ちながら、再実行可能なschema確認だけを行う。
CREATE TABLE IF NOT EXISTS `content_variants` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL,
	`content_package_id` text NOT NULL, `channel` text NOT NULL, `format` text NOT NULL,
	`author_persona_id` text NOT NULL, `audience_persona_id` text NOT NULL,
	`angle` text NOT NULL, `title` text, `body` text NOT NULL, `summary` text NOT NULL,
	`cta` text NOT NULL, `disclosure` text NOT NULL, `affiliate_link_ids` text NOT NULL,
	`claim_ids` text NOT NULL, `evidence_ids` text NOT NULL, `assumptions` text NOT NULL,
	`platform_warnings` text NOT NULL, `factuality_score` real NOT NULL,
	`persona_fit_score` real NOT NULL, `channel_fit_score` real NOT NULL,
	`compliance_status` text NOT NULL, `generation_prompt_version` text NOT NULL,
	`model_id` text NOT NULL, `status` text NOT NULL, `state` text NOT NULL,
	`review_due_at` integer, `revision` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_variants_workspace_state_idx`
	ON `content_variants` (`workspace_id`,`state`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_variants_workspace_package_idx`
	ON `content_variants` (`workspace_id`,`content_package_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_variants_review_due_idx`
	ON `content_variants` (`state`,`review_due_at`);
