CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_user_id` text,
	`actor_is_ai` integer NOT NULL,
	`actor_model_id` text,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_workspace_target_idx` ON `audit_logs` (`workspace_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_workspace_occurred_idx` ON `audit_logs` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_workspace_action_occurred_idx` ON `audit_logs` (`workspace_id`,`action`,`occurred_at`);