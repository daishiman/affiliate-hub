ALTER TABLE `legal_page` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `legal_page` ADD `deleted_at` integer;--> statement-breakpoint
UPDATE `legal_page` SET `kind` = 'profile' WHERE `kind` = 'operator';--> statement-breakpoint
UPDATE `legal_page` SET `kind` = 'sitemap' WHERE `kind` = 'all_categories';--> statement-breakpoint
UPDATE `legal_page` SET `kind` = 'commercial_transaction' WHERE `kind` = 'tokushoho';
