DROP INDEX `link_ingestions_workspace_normalized_url_idx`;--> statement-breakpoint
CREATE INDEX `link_ingestions_workspace_normalized_url_idx` ON `link_ingestions` (`workspace_id`,`normalized_url`);