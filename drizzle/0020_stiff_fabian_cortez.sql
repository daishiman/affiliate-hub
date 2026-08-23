CREATE TABLE `link_ingestion_url_claims` (
	`workspace_id` text NOT NULL,
	`normalized_url` text NOT NULL,
	`link_ingestion_id` text NOT NULL,
	`claimed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `normalized_url`)
);
