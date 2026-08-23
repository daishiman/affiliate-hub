CREATE TABLE `catalog_products` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text,
	`category_id` text,
	`identity_keys` text NOT NULL,
	`description` text,
	`specifications` text NOT NULL,
	`image_asset_ids` text NOT NULL,
	`release_date` integer,
	`discontinued_at` integer,
	`official_url` text,
	`official_source_ids` text NOT NULL,
	`provenance_source_type` text NOT NULL,
	`provenance_source_name` text NOT NULL,
	`provenance_source_url` text,
	`provenance_retrieved_at` integer NOT NULL,
	`provenance_valid_until` integer,
	`provenance_confidence` real NOT NULL,
	`provenance_permitted_usage` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_products_workspace_idx` ON `catalog_products` (`workspace_id`,`name`);--> statement-breakpoint
CREATE INDEX `catalog_products_workspace_category_idx` ON `catalog_products` (`workspace_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `catalog_products_stale_idx` ON `catalog_products` (`workspace_id`,`provenance_retrieved_at`);