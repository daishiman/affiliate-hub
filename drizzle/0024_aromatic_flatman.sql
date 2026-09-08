ALTER TABLE `audit_logs` ADD `request_id` text;--> statement-breakpoint
CREATE INDEX `audit_logs_workspace_request_idx` ON `audit_logs` (`workspace_id`,`request_id`);