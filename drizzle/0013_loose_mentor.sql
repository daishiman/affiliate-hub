CREATE TABLE `llm_credentials` (
	`workspace_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`sealed_key` text NOT NULL,
	`last4` text NOT NULL,
	`status` text NOT NULL,
	`registered_by` text,
	`registered_at` integer NOT NULL,
	`last_verified_at` integer,
	`last_verification` text,
	PRIMARY KEY(`workspace_id`, `provider_id`)
);
--> statement-breakpoint
CREATE TABLE `llm_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`purpose` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`estimated_cost_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`succeeded` integer NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `llm_usages_workspace_occurred_idx` ON `llm_usages` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `llm_usages_workspace_provider_idx` ON `llm_usages` (`workspace_id`,`provider_id`,`occurred_at`);