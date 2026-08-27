CREATE TABLE `reader_shortlist_items` (
	`site_slug` text NOT NULL,
	`reader_key` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`saved_at` text NOT NULL,
	`from_article_href` text,
	`one_line` text,
	PRIMARY KEY(`site_slug`, `reader_key`, `product_id`)
);
--> statement-breakpoint
CREATE INDEX `reader_shortlist_items_reader_idx` ON `reader_shortlist_items` (`site_slug`,`reader_key`);