CREATE TABLE `affiliate_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asp` text NOT NULL,
	`label` text NOT NULL,
	`public_tracking_id` text,
	`credential_ref` text,
	`connected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE INDEX `affiliate_accounts_workspace_idx` ON `affiliate_accounts` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `affiliate_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`asp` text NOT NULL,
	`advertiser_name` text NOT NULL,
	`reward_kind` text NOT NULL,
	`reward_percent` integer,
	`reward_amount_minor` integer,
	`reward_currency` text,
	`reward_note` text,
	`approval_rate` real,
	`confirmation_days` integer,
	`cookie_duration_days` integer,
	`restrictions` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `affiliate_programs_workspace_idx` ON `affiliate_programs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `affiliate_programs_account_idx` ON `affiliate_programs` (`workspace_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `audience_personas` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`persona_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audience_personas_workspace_name_idx` ON `audience_personas` (`workspace_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `audience_personas_workspace_name_unique_idx` ON `audience_personas` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `author_personas` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`display_name` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`persona_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `author_personas_workspace_name_idx` ON `author_personas` (`workspace_id`,`display_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `author_personas_workspace_display_name_idx` ON `author_personas` (`workspace_id`,`display_name`);--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`display_name` text NOT NULL,
	`legal_name` text,
	`contact_email` text,
	`created_at` integer NOT NULL,
	`brand_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brands_workspace_idx` ON `brands` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `capacity_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`acquired_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `capacity_leases_workspace_kind_expiry_idx` ON `capacity_leases` (`workspace_id`,`kind`,`expires_at`);--> statement-breakpoint
CREATE TABLE `channel_provider_delivery_leases` (
	`kind` text NOT NULL,
	`provider_identity` text NOT NULL,
	`holder_publication_id` text NOT NULL,
	`lease_token` text NOT NULL,
	`acquired_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `provider_identity`)
);
--> statement-breakpoint
CREATE INDEX `channel_provider_delivery_leases_expiry_idx` ON `channel_provider_delivery_leases` (`expires_at`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`verification_status` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer,
	`claim_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `claims_workspace_product_idx` ON `claims` (`workspace_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `claims_workspace_valid_until_idx` ON `claims` (`workspace_id`,`valid_until`);--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`body` text NOT NULL,
	`reply_to` text,
	`rate_limit_key` text NOT NULL,
	`received_at` text NOT NULL,
	`handled_at` text
);
--> statement-breakpoint
CREATE INDEX `contact_messages_workspace_site_idx` ON `contact_messages` (`workspace_id`,`site_slug`,`received_at`);--> statement-breakpoint
CREATE TABLE `content_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`objective` text NOT NULL,
	`status` text NOT NULL,
	`domain_scope` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`package_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_packages_workspace_status_idx` ON `content_packages` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_packages_workspace_updated_idx` ON `content_packages` (`workspace_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `evidence_records` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`captured_at` integer NOT NULL,
	`evidence_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_records_workspace_captured_idx` ON `evidence_records` (`workspace_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `publication_delivery_audit_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_user_id` text,
	`actor_is_ai` integer NOT NULL,
	`actor_identified` integer NOT NULL,
	`actor_model_id` text,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`request_id` text,
	`occurred_at` integer NOT NULL,
	`committed_at` integer,
	`delivered_at` integer
);
--> statement-breakpoint
CREATE INDEX `publication_delivery_audit_outbox_pending_idx` ON `publication_delivery_audit_outbox` (`delivered_at`,`committed_at`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `publication_delivery_audit_outbox_workspace_pending_idx` ON `publication_delivery_audit_outbox` (`workspace_id`,`delivered_at`,`committed_at`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `published_article_tombstones` (
	`site_slug` text NOT NULL,
	`slug` text NOT NULL,
	`workspace_id` text NOT NULL,
	`unpublished_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`site_slug`, `slug`)
);
--> statement-breakpoint
CREATE INDEX `published_article_tombstones_workspace_idx` ON `published_article_tombstones` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `ranking_models` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`category_id` text NOT NULL,
	`version` text NOT NULL,
	`audience` text NOT NULL,
	`effective_from` integer NOT NULL,
	`model_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ranking_models_workspace_effective_idx` ON `ranking_models` (`workspace_id`,`effective_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `ranking_models_workspace_category_audience_version_unique_idx` ON `ranking_models` (`workspace_id`,`category_id`,`audience`,`version`);--> statement-breakpoint
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
CREATE INDEX `reader_shortlist_items_reader_idx` ON `reader_shortlist_items` (`site_slug`,`reader_key`);--> statement-breakpoint
CREATE TABLE `reader_tools` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`inputs` text NOT NULL,
	`how_to_read` text NOT NULL,
	`formula` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`site_slug`, `slug`)
);
--> statement-breakpoint
CREATE INDEX `reader_tools_site_idx` ON `reader_tools` (`site_slug`);--> statement-breakpoint
CREATE INDEX `reader_tools_workspace_idx` ON `reader_tools` (`workspace_id`,`site_slug`);--> statement-breakpoint
CREATE TABLE `score_cards` (
	`workspace_id` text NOT NULL,
	`model_id` text NOT NULL,
	`product_id` text NOT NULL,
	`tested_at` integer,
	`card_json` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `model_id`, `product_id`)
);
--> statement-breakpoint
CREATE INDEX `score_cards_workspace_model_idx` ON `score_cards` (`workspace_id`,`model_id`);--> statement-breakpoint
CREATE TABLE `site_retirements` (
	`slug` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`retired_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_retirements_workspace_idx` ON `site_retirements` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `test_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`method_version` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`run_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `test_runs_workspace_product_idx` ON `test_runs` (`workspace_id`,`product_id`);--> statement-breakpoint
DROP INDEX `publications_workspace_idempotency_idx`;--> statement-breakpoint
ALTER TABLE `publications` ADD `variant_revision` integer;--> statement-breakpoint
ALTER TABLE `publications` ADD `retry_at` integer;--> statement-breakpoint
ALTER TABLE `publications` ADD `delivery_lease_until` integer;--> statement-breakpoint
ALTER TABLE `publications` ADD `provider_identity` text;--> statement-breakpoint
ALTER TABLE `publications` ADD `provider_delivery_key` text;--> statement-breakpoint
ALTER TABLE `publications` ADD `provider_record_created_at` integer;--> statement-breakpoint
ALTER TABLE `publications` ADD `last_delivery_audit_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `publications_provider_delivery_key_idx` ON `publications` (`kind`,`provider_identity`,`provider_delivery_key`);--> statement-breakpoint
CREATE INDEX `publications_state_retry_idx` ON `publications` (`state`,`retry_at`);--> statement-breakpoint
CREATE INDEX `publications_state_lease_idx` ON `publications` (`state`,`delivery_lease_until`);--> statement-breakpoint
CREATE UNIQUE INDEX `publications_workspace_idempotency_idx` ON `publications` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
ALTER TABLE `channel_connections` ADD `provider_identity` text;--> statement-breakpoint
CREATE UNIQUE INDEX `channel_connections_workspace_provider_identity_idx` ON `channel_connections` (`workspace_id`,`kind`,`provider_identity`);--> statement-breakpoint
CREATE UNIQUE INDEX `channel_connections_workspace_credential_ref_idx` ON `channel_connections` (`workspace_id`,`kind`,`credential_ref`);--> statement-breakpoint
ALTER TABLE `content_variants` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `llm_usages` ADD `capacity_consumed` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `llm_usages_workspace_capacity_idx` ON `llm_usages` (`workspace_id`,`purpose`,`capacity_consumed`,`occurred_at`);