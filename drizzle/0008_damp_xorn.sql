CREATE TABLE `channel_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`account_label` text NOT NULL,
	`connected_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`credential_ref` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `channel_connections_workspace_kind_idx` ON `channel_connections` (`workspace_id`,`kind`);--> statement-breakpoint
CREATE TABLE `publications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`kind` text NOT NULL,
	`connection_id` text,
	`state` text NOT NULL,
	`scheduled_at` integer,
	`idempotency_key` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`external_id` text,
	`external_url` text,
	`last_error` text,
	`published_at` integer
);
--> statement-breakpoint
CREATE INDEX `publications_workspace_variant_idx` ON `publications` (`workspace_id`,`variant_id`);--> statement-breakpoint
CREATE INDEX `publications_workspace_idempotency_idx` ON `publications` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `publications_state_scheduled_idx` ON `publications` (`state`,`scheduled_at`);