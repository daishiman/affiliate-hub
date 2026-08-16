CREATE TABLE `article_people` (
	`article_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`article_id`, `person_id`, `role`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `article_people_person_id_idx` ON `article_people` (`person_id`);--> statement-breakpoint
CREATE TABLE `article_products` (
	`article_id` text NOT NULL,
	`product_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`article_id`, `product_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `article_products_product_id_idx` ON `article_products` (`product_id`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`category_id` text,
	`disclosure_id` text,
	`owner_id` text,
	`published_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`tested_at` integer,
	`next_review_at` integer,
	`target_audience` text,
	`suitable_for` text,
	`not_suitable_for` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`disclosure_id`) REFERENCES `disclosures`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_status_idx` ON `articles` (`status`);--> statement-breakpoint
CREATE INDEX `articles_category_id_idx` ON `articles` (`category_id`);--> statement-breakpoint
CREATE INDEX `articles_next_review_at_idx` ON `articles` (`next_review_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `conversation_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`speaker` text NOT NULL,
	`body` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_blocks_article_id_idx` ON `conversation_blocks` (`article_id`);--> statement-breakpoint
CREATE TABLE `disclosures` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_type` text NOT NULL,
	`advertiser_or_supplier` text,
	`editorial_influence` text DEFAULT 'none' NOT NULL,
	`visible_message` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `faqs_article_id_idx` ON `faqs` (`article_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`credentials` text,
	`avatar_asset_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_slug_unique` ON `people` (`slug`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`model_number` text,
	`category_id` text NOT NULL,
	`release_date` integer,
	`discontinued_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE TABLE `update_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`changed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`changed_by_id` text,
	`change_type` text NOT NULL,
	`summary` text NOT NULL,
	`reviewer_id` text,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewer_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `update_logs_article_id_idx` ON `update_logs` (`article_id`);--> statement-breakpoint
CREATE INDEX `update_logs_changed_at_idx` ON `update_logs` (`changed_at`);