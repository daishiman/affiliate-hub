CREATE TABLE `ranking_models` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`category_id` text NOT NULL,
	`version` text NOT NULL,
	`audience` text NOT NULL,
	`effective_from` integer NOT NULL,
	`model_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ranking_models_workspace_effective_idx` ON `ranking_models` (`workspace_id`,`effective_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `ranking_models_workspace_category_audience_version_unique_idx` ON `ranking_models` (`workspace_id`,`category_id`,`audience`,`version`);--> statement-breakpoint
CREATE TABLE `score_cards` (
	`workspace_id` text NOT NULL,
	`model_id` text NOT NULL,
	`product_id` text NOT NULL,
	`tested_at` integer,
	`card_json` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `model_id`, `product_id`)
);
--> statement-breakpoint
CREATE INDEX `score_cards_workspace_model_idx` ON `score_cards` (`workspace_id`,`model_id`);