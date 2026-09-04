CREATE TABLE `site_seo_assessment_progress` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`period` text NOT NULL,
	`last_attempted_at` integer NOT NULL,
	`completed_at` integer,
	PRIMARY KEY(`workspace_id`, `site_slug`, `period`)
);
--> statement-breakpoint
CREATE INDEX `site_seo_assessment_progress_period_idx` ON `site_seo_assessment_progress` (`period`,`completed_at`,`last_attempted_at`,`workspace_id`,`site_slug`);