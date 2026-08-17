CREATE TABLE `telemetry_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`site_slug` text,
	`reader_key` text,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `telemetry_events_workspace_occurred_idx` ON `telemetry_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `telemetry_events_workspace_key_occurred_idx` ON `telemetry_events` (`workspace_id`,`key`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `telemetry_events_reader_idx` ON `telemetry_events` (`workspace_id`,`reader_key`);