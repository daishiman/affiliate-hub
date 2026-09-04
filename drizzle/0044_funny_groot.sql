CREATE TABLE `article_answer_unit` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text NOT NULL,
	`kind` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`position_ratio` real DEFAULT 0 NOT NULL,
	`source_ref` text,
	`gaps` text DEFAULT '[]' NOT NULL,
	`extracted_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_answer_unit_question_idx` ON `article_answer_unit` (`workspace_id`,`site_slug`,`article_slug`,`question`);--> statement-breakpoint
CREATE INDEX `article_answer_unit_site_idx` ON `article_answer_unit` (`workspace_id`,`site_slug`,`kind`);--> statement-breakpoint
CREATE TABLE `article_daily_metric` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`unique_sessions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`conversions` integer DEFAULT 0 NOT NULL,
	`revenue_minor` integer DEFAULT 0 NOT NULL,
	`average_dwell_seconds` real DEFAULT 0 NOT NULL,
	`average_scroll_ratio` real DEFAULT 0 NOT NULL,
	`clicks_by_element` text DEFAULT '{}' NOT NULL,
	`computed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `site_slug`, `article_slug`, `day`)
);
--> statement-breakpoint
CREATE INDEX `article_daily_metric_revenue_idx` ON `article_daily_metric` (`workspace_id`,`site_slug`,`day`,`revenue_minor`);--> statement-breakpoint
CREATE TABLE `article_seo_assessment` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text NOT NULL,
	`check_kind` text NOT NULL,
	`severity` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`detail` text NOT NULL,
	`evidence` text NOT NULL,
	`suggestion` text,
	`draft_revision_id` text,
	`dismissed_reason` text,
	`assessed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_seo_assessment_unique_idx` ON `article_seo_assessment` (`workspace_id`,`site_slug`,`article_slug`,`check_kind`);--> statement-breakpoint
CREATE INDEX `article_seo_assessment_open_idx` ON `article_seo_assessment` (`workspace_id`,`site_slug`,`state`,`severity`);--> statement-breakpoint
CREATE TABLE `reader_interaction_event` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text,
	`kind` text NOT NULL,
	`segment` text NOT NULL,
	`viewport_band` text NOT NULL,
	`position_ratio` real DEFAULT 0 NOT NULL,
	`dwell_seconds` integer DEFAULT 0 NOT NULL,
	`element_key` text,
	`session_key` text NOT NULL,
	`rollup_day` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reader_interaction_event_rollup_idx` ON `reader_interaction_event` (`workspace_id`,`site_slug`,`rollup_day`);--> statement-breakpoint
CREATE INDEX `reader_interaction_event_article_idx` ON `reader_interaction_event` (`workspace_id`,`article_slug`,`rollup_day`);--> statement-breakpoint
CREATE INDEX `reader_interaction_event_retention_idx` ON `reader_interaction_event` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `site_aeo_profile` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`topic_scope` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`publisher_name` text DEFAULT '' NOT NULL,
	`structured_data_enabled` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `site_slug`)
);
--> statement-breakpoint
CREATE TABLE `site_custom_domain` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`hostname` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`certificate_status` text DEFAULT 'none' NOT NULL,
	`canonical` integer DEFAULT false NOT NULL,
	`external_hostname_id` text,
	`verification_token` text,
	`synced_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_custom_domain_hostname_idx` ON `site_custom_domain` (`hostname`) WHERE status <> 'revoked' and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX `site_custom_domain_canonical_idx` ON `site_custom_domain` (`workspace_id`,`site_slug`) WHERE canonical = 1 and status = 'active' and deleted_at is null;--> statement-breakpoint
CREATE INDEX `site_custom_domain_site_idx` ON `site_custom_domain` (`workspace_id`,`site_slug`,`status`);--> statement-breakpoint
CREATE TABLE `site_daily_metric` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`unique_sessions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`conversions` integer DEFAULT 0 NOT NULL,
	`revenue_minor` integer DEFAULT 0 NOT NULL,
	`average_dwell_seconds` real DEFAULT 0 NOT NULL,
	`average_scroll_ratio` real DEFAULT 0 NOT NULL,
	`computed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `site_slug`, `day`)
);
--> statement-breakpoint
CREATE INDEX `site_daily_metric_day_idx` ON `site_daily_metric` (`workspace_id`,`day`);