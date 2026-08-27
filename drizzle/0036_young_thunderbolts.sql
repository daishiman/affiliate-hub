-- 0036以降は未適用のため、このmigrationを配信schemaの回復可能な基底にする。
-- SQLiteにはADD COLUMN IF NOT EXISTSがない。各表を永続sourceへ退避してから
-- DROP→RENAMEし、どのstatement直後で停止しても同じSQLの先頭から再開できる。

-- DROP→RENAME間で停止した場合にSELECT元を復元する空の最終形。
CREATE TABLE IF NOT EXISTS `publications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`variant_revision` integer,
	`kind` text NOT NULL,
	`connection_id` text,
	`state` text NOT NULL,
	`scheduled_at` integer,
	`retry_at` integer,
	`delivery_lease_until` integer,
	`idempotency_key` text NOT NULL,
	`provider_identity` text,
	`provider_delivery_key` text,
	`provider_record_created_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`external_id` text,
	`external_url` text,
	`last_error` text,
	`published_at` integer,
	`last_delivery_audit_id` text
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `_migration_0036_publications_source` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`variant_revision` integer,
	`kind` text NOT NULL,
	`connection_id` text,
	`state` text NOT NULL,
	`scheduled_at` integer,
	`retry_at` integer,
	`delivery_lease_until` integer,
	`idempotency_key` text NOT NULL,
	`provider_identity` text,
	`provider_delivery_key` text,
	`provider_record_created_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`external_id` text,
	`external_url` text,
	`last_error` text,
	`published_at` integer,
	`last_delivery_audit_id` text
);--> statement-breakpoint
-- NATURAL LEFT JOINは、旧表に無い列だけ右側のNULLで補い、既存列は左側を保持する。
INSERT INTO `_migration_0036_publications_source` (
	`id`, `workspace_id`, `variant_id`, `variant_revision`, `kind`, `connection_id`,
	`state`, `scheduled_at`, `retry_at`, `delivery_lease_until`, `idempotency_key`,
	`provider_identity`, `provider_delivery_key`, `provider_record_created_at`, `attempts`,
	`external_id`, `external_url`, `last_error`, `published_at`, `last_delivery_audit_id`
)
SELECT
	`publications`.`id`, `publications`.`workspace_id`, `publications`.`variant_id`,
	`variant_revision`, `publications`.`kind`, `publications`.`connection_id`,
	`publications`.`state`, `publications`.`scheduled_at`, `retry_at`,
	`delivery_lease_until`, `publications`.`idempotency_key`, `provider_identity`,
	`provider_delivery_key`, `provider_record_created_at`, `publications`.`attempts`,
	`publications`.`external_id`, `publications`.`external_url`, `publications`.`last_error`,
	`publications`.`published_at`, `last_delivery_audit_id`
FROM `publications`
NATURAL LEFT JOIN (
	SELECT NULL AS `variant_revision`, NULL AS `retry_at`, NULL AS `delivery_lease_until`,
		NULL AS `provider_identity`, NULL AS `provider_delivery_key`,
		NULL AS `provider_record_created_at`, NULL AS `last_delivery_audit_id`
)
WHERE 1
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id` = excluded.`workspace_id`,
	`variant_id` = excluded.`variant_id`,
	`variant_revision` = excluded.`variant_revision`,
	`kind` = excluded.`kind`,
	`connection_id` = excluded.`connection_id`,
	`state` = excluded.`state`,
	`scheduled_at` = excluded.`scheduled_at`,
	`retry_at` = excluded.`retry_at`,
	`delivery_lease_until` = excluded.`delivery_lease_until`,
	`idempotency_key` = excluded.`idempotency_key`,
	`provider_identity` = excluded.`provider_identity`,
	`provider_delivery_key` = excluded.`provider_delivery_key`,
	`provider_record_created_at` = excluded.`provider_record_created_at`,
	`attempts` = excluded.`attempts`,
	`external_id` = excluded.`external_id`,
	`external_url` = excluded.`external_url`,
	`last_error` = excluded.`last_error`,
	`published_at` = excluded.`published_at`,
	`last_delivery_audit_id` = excluded.`last_delivery_audit_id`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `_new_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`variant_revision` integer,
	`kind` text NOT NULL,
	`connection_id` text,
	`state` text NOT NULL,
	`scheduled_at` integer,
	`retry_at` integer,
	`delivery_lease_until` integer,
	`idempotency_key` text NOT NULL,
	`provider_identity` text,
	`provider_delivery_key` text,
	`provider_record_created_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`external_id` text,
	`external_url` text,
	`last_error` text,
	`published_at` integer,
	`last_delivery_audit_id` text
);--> statement-breakpoint
INSERT INTO `_new_publications` (
	`id`, `workspace_id`, `variant_id`, `variant_revision`, `kind`, `connection_id`,
	`state`, `scheduled_at`, `retry_at`, `delivery_lease_until`, `idempotency_key`,
	`provider_identity`, `provider_delivery_key`, `provider_record_created_at`, `attempts`,
	`external_id`, `external_url`, `last_error`, `published_at`, `last_delivery_audit_id`
)
SELECT
	`id`, `workspace_id`, `variant_id`, `variant_revision`, `kind`, `connection_id`,
	`state`, `scheduled_at`, `retry_at`, `delivery_lease_until`, `idempotency_key`,
	`provider_identity`, `provider_delivery_key`, `provider_record_created_at`, `attempts`,
	`external_id`, `external_url`, `last_error`, `published_at`, `last_delivery_audit_id`
FROM `_migration_0036_publications_source`
WHERE 1
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id` = excluded.`workspace_id`,
	`variant_id` = excluded.`variant_id`,
	`variant_revision` = excluded.`variant_revision`,
	`kind` = excluded.`kind`,
	`connection_id` = excluded.`connection_id`,
	`state` = excluded.`state`,
	`scheduled_at` = excluded.`scheduled_at`,
	`retry_at` = excluded.`retry_at`,
	`delivery_lease_until` = excluded.`delivery_lease_until`,
	`idempotency_key` = excluded.`idempotency_key`,
	`provider_identity` = excluded.`provider_identity`,
	`provider_delivery_key` = excluded.`provider_delivery_key`,
	`provider_record_created_at` = excluded.`provider_record_created_at`,
	`attempts` = excluded.`attempts`,
	`external_id` = excluded.`external_id`,
	`external_url` = excluded.`external_url`,
	`last_error` = excluded.`last_error`,
	`published_at` = excluded.`published_at`,
	`last_delivery_audit_id` = excluded.`last_delivery_audit_id`;--> statement-breakpoint
DROP TABLE `publications`;--> statement-breakpoint
ALTER TABLE `_new_publications` RENAME TO `publications`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publications_workspace_variant_idx`
	ON `publications` (`workspace_id`,`variant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `publications_workspace_idempotency_idx`
	ON `publications` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `publications_provider_delivery_key_idx`
	ON `publications` (`kind`,`provider_identity`,`provider_delivery_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publications_state_scheduled_idx`
	ON `publications` (`state`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publications_state_retry_idx`
	ON `publications` (`state`,`retry_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publications_state_lease_idx`
	ON `publications` (`state`,`delivery_lease_until`);--> statement-breakpoint
-- 旧RETRY_SCHEDULEDはscheduled_atを優先し、日時も無ければ移行時から再試行可能にする。
UPDATE `publications`
SET `retry_at` = coalesce(`scheduled_at`, unixepoch())
WHERE `state` = 'RETRY_SCHEDULED' AND `retry_at` IS NULL;--> statement-breakpoint
-- 旧SENDINGはlease/keyを推測して外部再送せず、人が確認可能な失敗へ戻す。
UPDATE `publications`
SET `state` = 'FAILED_SEND',
	`delivery_lease_until` = NULL,
	`last_error` = coalesce(
		`last_error`,
		'送信中の旧データを安全に引き継げませんでした。配信先を確認して再試行してください。'
	)
WHERE `state` = 'SENDING'
	AND (`delivery_lease_until` IS NULL OR `provider_delivery_key` IS NULL);--> statement-breakpoint
DROP TABLE IF EXISTS `_migration_0036_publications_source`;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `content_variants` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL,
	`content_package_id` text NOT NULL, `channel` text NOT NULL, `format` text NOT NULL,
	`author_persona_id` text NOT NULL, `audience_persona_id` text NOT NULL,
	`angle` text NOT NULL, `title` text, `body` text NOT NULL, `summary` text NOT NULL,
	`cta` text NOT NULL, `disclosure` text NOT NULL, `affiliate_link_ids` text NOT NULL,
	`claim_ids` text NOT NULL, `evidence_ids` text NOT NULL, `assumptions` text NOT NULL,
	`platform_warnings` text NOT NULL, `factuality_score` real NOT NULL,
	`persona_fit_score` real NOT NULL, `channel_fit_score` real NOT NULL,
	`compliance_status` text NOT NULL, `generation_prompt_version` text NOT NULL,
	`model_id` text NOT NULL, `status` text NOT NULL, `state` text NOT NULL,
	`review_due_at` integer, `revision` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `_migration_0036_content_variants_source` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL,
	`content_package_id` text NOT NULL, `channel` text NOT NULL, `format` text NOT NULL,
	`author_persona_id` text NOT NULL, `audience_persona_id` text NOT NULL,
	`angle` text NOT NULL, `title` text, `body` text NOT NULL, `summary` text NOT NULL,
	`cta` text NOT NULL, `disclosure` text NOT NULL, `affiliate_link_ids` text NOT NULL,
	`claim_ids` text NOT NULL, `evidence_ids` text NOT NULL, `assumptions` text NOT NULL,
	`platform_warnings` text NOT NULL, `factuality_score` real NOT NULL,
	`persona_fit_score` real NOT NULL, `channel_fit_score` real NOT NULL,
	`compliance_status` text NOT NULL, `generation_prompt_version` text NOT NULL,
	`model_id` text NOT NULL, `status` text NOT NULL, `state` text NOT NULL,
	`review_due_at` integer, `revision` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `_migration_0036_content_variants_source`
SELECT
	`content_variants`.`id`, `content_variants`.`workspace_id`,
	`content_variants`.`content_package_id`, `content_variants`.`channel`,
	`content_variants`.`format`, `content_variants`.`author_persona_id`,
	`content_variants`.`audience_persona_id`, `content_variants`.`angle`,
	`content_variants`.`title`, `content_variants`.`body`, `content_variants`.`summary`,
	`content_variants`.`cta`, `content_variants`.`disclosure`,
	`content_variants`.`affiliate_link_ids`, `content_variants`.`claim_ids`,
	`content_variants`.`evidence_ids`, `content_variants`.`assumptions`,
	`content_variants`.`platform_warnings`, `content_variants`.`factuality_score`,
	`content_variants`.`persona_fit_score`, `content_variants`.`channel_fit_score`,
	`content_variants`.`compliance_status`, `content_variants`.`generation_prompt_version`,
	`content_variants`.`model_id`, `content_variants`.`status`, `content_variants`.`state`,
	`content_variants`.`review_due_at`, `revision`
FROM `content_variants`
NATURAL LEFT JOIN (SELECT 1 AS `revision`)
WHERE 1
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id`=excluded.`workspace_id`, `content_package_id`=excluded.`content_package_id`,
	`channel`=excluded.`channel`, `format`=excluded.`format`,
	`author_persona_id`=excluded.`author_persona_id`, `audience_persona_id`=excluded.`audience_persona_id`,
	`angle`=excluded.`angle`, `title`=excluded.`title`, `body`=excluded.`body`,
	`summary`=excluded.`summary`, `cta`=excluded.`cta`, `disclosure`=excluded.`disclosure`,
	`affiliate_link_ids`=excluded.`affiliate_link_ids`, `claim_ids`=excluded.`claim_ids`,
	`evidence_ids`=excluded.`evidence_ids`, `assumptions`=excluded.`assumptions`,
	`platform_warnings`=excluded.`platform_warnings`, `factuality_score`=excluded.`factuality_score`,
	`persona_fit_score`=excluded.`persona_fit_score`, `channel_fit_score`=excluded.`channel_fit_score`,
	`compliance_status`=excluded.`compliance_status`,
	`generation_prompt_version`=excluded.`generation_prompt_version`, `model_id`=excluded.`model_id`,
	`status`=excluded.`status`, `state`=excluded.`state`, `review_due_at`=excluded.`review_due_at`,
	`revision`=excluded.`revision`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `_new_content_variants` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL,
	`content_package_id` text NOT NULL, `channel` text NOT NULL, `format` text NOT NULL,
	`author_persona_id` text NOT NULL, `audience_persona_id` text NOT NULL,
	`angle` text NOT NULL, `title` text, `body` text NOT NULL, `summary` text NOT NULL,
	`cta` text NOT NULL, `disclosure` text NOT NULL, `affiliate_link_ids` text NOT NULL,
	`claim_ids` text NOT NULL, `evidence_ids` text NOT NULL, `assumptions` text NOT NULL,
	`platform_warnings` text NOT NULL, `factuality_score` real NOT NULL,
	`persona_fit_score` real NOT NULL, `channel_fit_score` real NOT NULL,
	`compliance_status` text NOT NULL, `generation_prompt_version` text NOT NULL,
	`model_id` text NOT NULL, `status` text NOT NULL, `state` text NOT NULL,
	`review_due_at` integer, `revision` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
INSERT INTO `_new_content_variants`
SELECT * FROM `_migration_0036_content_variants_source`
WHERE 1
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id`=excluded.`workspace_id`, `content_package_id`=excluded.`content_package_id`,
	`channel`=excluded.`channel`, `format`=excluded.`format`,
	`author_persona_id`=excluded.`author_persona_id`, `audience_persona_id`=excluded.`audience_persona_id`,
	`angle`=excluded.`angle`, `title`=excluded.`title`, `body`=excluded.`body`,
	`summary`=excluded.`summary`, `cta`=excluded.`cta`, `disclosure`=excluded.`disclosure`,
	`affiliate_link_ids`=excluded.`affiliate_link_ids`, `claim_ids`=excluded.`claim_ids`,
	`evidence_ids`=excluded.`evidence_ids`, `assumptions`=excluded.`assumptions`,
	`platform_warnings`=excluded.`platform_warnings`, `factuality_score`=excluded.`factuality_score`,
	`persona_fit_score`=excluded.`persona_fit_score`, `channel_fit_score`=excluded.`channel_fit_score`,
	`compliance_status`=excluded.`compliance_status`,
	`generation_prompt_version`=excluded.`generation_prompt_version`, `model_id`=excluded.`model_id`,
	`status`=excluded.`status`, `state`=excluded.`state`, `review_due_at`=excluded.`review_due_at`,
	`revision`=excluded.`revision`;--> statement-breakpoint
DROP TABLE `content_variants`;--> statement-breakpoint
ALTER TABLE `_new_content_variants` RENAME TO `content_variants`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_variants_workspace_state_idx`
	ON `content_variants` (`workspace_id`,`state`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_variants_workspace_package_idx`
	ON `content_variants` (`workspace_id`,`content_package_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_variants_review_due_idx`
	ON `content_variants` (`state`,`review_due_at`);--> statement-breakpoint
DROP TABLE IF EXISTS `_migration_0036_content_variants_source`;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `channel_connections` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL, `kind` text NOT NULL,
	`account_label` text NOT NULL, `connected_at` integer NOT NULL, `expires_at` integer,
	`revoked_at` integer, `provider_identity` text, `credential_ref` text NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `_migration_0036_channel_connections_source` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL, `kind` text NOT NULL,
	`account_label` text NOT NULL, `connected_at` integer NOT NULL, `expires_at` integer,
	`revoked_at` integer, `provider_identity` text, `credential_ref` text NOT NULL
);--> statement-breakpoint
INSERT INTO `_migration_0036_channel_connections_source`
SELECT
	`channel_connections`.`id`, `channel_connections`.`workspace_id`,
	`channel_connections`.`kind`, `channel_connections`.`account_label`,
	`channel_connections`.`connected_at`, `channel_connections`.`expires_at`,
	`channel_connections`.`revoked_at`, `provider_identity`,
	`channel_connections`.`credential_ref`
FROM `channel_connections`
NATURAL LEFT JOIN (SELECT NULL AS `provider_identity`)
WHERE 1
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id`=excluded.`workspace_id`, `kind`=excluded.`kind`,
	`account_label`=excluded.`account_label`, `connected_at`=excluded.`connected_at`,
	`expires_at`=excluded.`expires_at`, `revoked_at`=excluded.`revoked_at`,
	`provider_identity`=excluded.`provider_identity`, `credential_ref`=excluded.`credential_ref`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `_new_channel_connections` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL, `kind` text NOT NULL,
	`account_label` text NOT NULL, `connected_at` integer NOT NULL, `expires_at` integer,
	`revoked_at` integer, `provider_identity` text, `credential_ref` text NOT NULL
);--> statement-breakpoint
INSERT INTO `_new_channel_connections`
SELECT * FROM `_migration_0036_channel_connections_source`
WHERE 1
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id`=excluded.`workspace_id`, `kind`=excluded.`kind`,
	`account_label`=excluded.`account_label`, `connected_at`=excluded.`connected_at`,
	`expires_at`=excluded.`expires_at`, `revoked_at`=excluded.`revoked_at`,
	`provider_identity`=excluded.`provider_identity`, `credential_ref`=excluded.`credential_ref`;--> statement-breakpoint
DROP TABLE `channel_connections`;--> statement-breakpoint
ALTER TABLE `_new_channel_connections` RENAME TO `channel_connections`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `channel_connections_workspace_kind_idx`
	ON `channel_connections` (`workspace_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `channel_connections_workspace_provider_identity_idx`
	ON `channel_connections` (`workspace_id`,`kind`,`provider_identity`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `channel_connections_workspace_credential_ref_idx`
	ON `channel_connections` (`workspace_id`,`kind`,`credential_ref`);--> statement-breakpoint
DROP TABLE IF EXISTS `_migration_0036_channel_connections_source`;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `channel_provider_delivery_leases` (
	`kind` text NOT NULL, `provider_identity` text NOT NULL,
	`holder_publication_id` text NOT NULL, `lease_token` text NOT NULL,
	`acquired_at` integer NOT NULL, `expires_at` integer NOT NULL,
	PRIMARY KEY (`kind`, `provider_identity`)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `channel_provider_delivery_leases_expiry_idx`
	ON `channel_provider_delivery_leases` (`expires_at`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `publication_delivery_audit_outbox` (
	`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL, `action` text NOT NULL,
	`actor_user_id` text, `actor_is_ai` integer NOT NULL, `actor_identified` integer NOT NULL,
	`actor_model_id` text, `target_type` text NOT NULL, `target_id` text NOT NULL,
	`before_json` text, `after_json` text, `reason` text, `request_id` text,
	`occurred_at` integer NOT NULL, `committed_at` integer, `delivered_at` integer
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publication_delivery_audit_outbox_pending_idx`
	ON `publication_delivery_audit_outbox` (`delivered_at`,`committed_at`,`occurred_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publication_delivery_audit_outbox_workspace_pending_idx`
	ON `publication_delivery_audit_outbox` (`workspace_id`,`delivered_at`,`committed_at`,`occurred_at`);--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `publications_commit_delivery_audit_outbox`
AFTER UPDATE OF `last_delivery_audit_id` ON `publications`
WHEN NEW.`last_delivery_audit_id` IS NOT NULL
	AND (OLD.`last_delivery_audit_id` IS NULL OR OLD.`last_delivery_audit_id` <> NEW.`last_delivery_audit_id`)
BEGIN
	UPDATE `publication_delivery_audit_outbox`
	SET `committed_at` = `occurred_at`
	WHERE `id` = NEW.`last_delivery_audit_id`
		AND `workspace_id` = NEW.`workspace_id`
		AND `action` = 'publication.delivery_changed'
		AND `actor_user_id` = 'system:distribution-scheduler'
		AND `target_type` = 'publication'
		AND `target_id` = NEW.`id`
		AND `committed_at` IS NULL;
	SELECT RAISE(ABORT, 'publication delivery audit outbox mismatch')
	WHERE changes() <> 1;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `publication_delivery_audit_outbox_verify_delivery`
AFTER UPDATE OF `delivered_at` ON `publication_delivery_audit_outbox`
WHEN NEW.`delivered_at` IS NOT NULL AND OLD.`delivered_at` IS NULL
BEGIN
	SELECT RAISE(ABORT, 'publication delivery audit payload mismatch')
	WHERE NOT EXISTS (
		SELECT 1 FROM `audit_logs`
		WHERE `id` = NEW.`id` AND `workspace_id` = NEW.`workspace_id`
			AND `action` = NEW.`action` AND `actor_user_id` IS NEW.`actor_user_id`
			AND `actor_is_ai` = NEW.`actor_is_ai`
			AND `actor_identified` = NEW.`actor_identified`
			AND `actor_model_id` IS NEW.`actor_model_id`
			AND `target_type` = NEW.`target_type` AND `target_id` = NEW.`target_id`
			AND `before_json` IS NEW.`before_json` AND `after_json` IS NEW.`after_json`
			AND `reason` IS NEW.`reason` AND `request_id` IS NEW.`request_id`
			AND `occurred_at` = NEW.`occurred_at`
	);
END;
