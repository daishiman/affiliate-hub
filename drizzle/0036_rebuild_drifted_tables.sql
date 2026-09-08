-- 0036: 履歴を書き換えた跡で残った「形のずれ」を、前方修復で正本へ寄せる。
--
-- **なぜ要るか。** 2026-08-27 に番号が重なった migration を作り直したとき、
-- 列の集合は揃ったが**形は揃わなかった**。`scripts/check-schema-drift.mjs` を
-- dev の実物へ当てて 4 件見つかった（run #22 の後始末）。
--
--   capacity_leases      実体にだけ CHECK 制約がある
--   legal_page           workspace_id の位置と既定値が違う
--   channel_connections  provider_identity の列順が違う
--   publications         列順が違う
--
-- 実体側は `schema.ts` の宣言順どおりに作り直されていて、追いついていないのは
-- **migration ファイルの側**。0033/0034 が `ALTER TABLE ADD` で末尾に足したため、
-- 先頭から流し直した結果だけが付け足しの形のまま残っている。
--
-- **なぜ ALTER TABLE で直せないか。** SQLite の `ALTER TABLE` は列を末尾へ足すことしか
-- できない。列順も CHECK も変えられないので、**表の作り直し**（新しい表を作る →
-- 行を移す → 古い表を落とす → 名前を付け替える → 索引とトリガーを張り直す）が要る。
-- 対象 4 表はいずれも 0 行なので、移す行は無い。それでも INSERT ... SELECT を書くのは、
-- 本番が 0034 に追いつく前にこの migration へ到達した場合に備えるため。
--
-- **なぜ適用済みファイルを書き換えないか。** `d1_migrations` はファイル名しか見ない。
-- 0033/0034 を直しても、既に適用済みの環境では二度と流れず、実体は変わらない。
-- 変わるのは「これから作る環境」だけで、既存環境とのずれがむしろ広がる。
-- 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §4-1-2
--
-- **作り直した後の形は `schema.ts` の宣言と一致させる。** これが唯一の規則。
-- ここで独自の形にすると、次に `drizzle-kit generate` を走らせた人が
-- 「なぜか差分が出る」ところから始めることになる。
--
-- 表を落とすと、その表に付いていた索引とトリガーも一緒に消える。
-- 張り直しを 1 本でも落とすと、境界の検査が緑のまま素通りする（0035 の教訓）。

-- ---------------------------------------------------------------------------
-- 1. capacity_leases — 実体にだけ残っていた CHECK を落とし、0034 の形へそろえる
-- ---------------------------------------------------------------------------
-- **CHECK を正本へ昇格させなかった理由。** この制約はどの migration にも、
-- git のどの版にも無い。唯一同じ文字列があるのは
-- `tests/integration/d1-capacity-atomicity.test.ts` が自前で作る同名の表で、
-- そこでも索引名が本物と違う（`capacity_leases_active_idx`）。つまり本物から
-- 導かれた fixture ではなく手書きの近似で、**無効な `kind` が弾かれることを
-- 確かめている検査は 1 件も無い**。裏付けの無い制約を正本にすると、
-- なぜそこにあるのか誰も説明できない例外が残る。
--
-- `schema.ts` の `enum:` は型の上だけの宣言で、`drizzle-kit` は CHECK を吐かない。
-- 他の enum 列（channel_connections.kind / publications.state /
-- legal_page.kind・status）も同じく CHECK を持たない。ここだけ足すと、
-- 「どの enum が DB でも守られるのか」が表ごとにバラバラになる。
-- `kind` の妥当性は domain 側の 1 か所で守る。

CREATE TABLE `capacity_leases__rebuilt` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`acquired_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);--> statement-breakpoint

INSERT INTO `capacity_leases__rebuilt`
	(`id`, `workspace_id`, `kind`, `acquired_at`, `expires_at`)
SELECT `id`, `workspace_id`, `kind`, `acquired_at`, `expires_at`
FROM `capacity_leases`;--> statement-breakpoint

DROP TABLE `capacity_leases`;--> statement-breakpoint
ALTER TABLE `capacity_leases__rebuilt` RENAME TO `capacity_leases`;--> statement-breakpoint

CREATE INDEX `capacity_leases_workspace_kind_expiry_idx` ON `capacity_leases` (`workspace_id`,`kind`,`expires_at`);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. legal_page — workspace_id を宣言どおり 2 番目へ、updated_at を末尾へ
-- ---------------------------------------------------------------------------
-- `DEFAULT ''` は落とさない。`schema.ts` が `.default("")` と書いている以上、
-- ここで外すと表の実体と宣言が静かにずれる（別種の drift を作ることになる）。

CREATE TABLE `legal_page__rebuilt` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text DEFAULT '' NOT NULL,
	`site_slug` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`deleted_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint

INSERT INTO `legal_page__rebuilt`
	(`id`, `workspace_id`, `site_slug`, `kind`, `title`, `body`, `status`, `deleted_at`, `updated_at`)
SELECT `id`, `workspace_id`, `site_slug`, `kind`, `title`, `body`, `status`, `deleted_at`, `updated_at`
FROM `legal_page`;--> statement-breakpoint

DROP TABLE `legal_page`;--> statement-breakpoint
ALTER TABLE `legal_page__rebuilt` RENAME TO `legal_page`;--> statement-breakpoint

CREATE UNIQUE INDEX `legal_page_site_kind_idx` ON `legal_page` (`site_slug`,`kind`);--> statement-breakpoint
CREATE INDEX `legal_page_workspace_idx` ON `legal_page` (`workspace_id`,`site_slug`,`kind`);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. channel_connections — provider_identity を credential_ref の前へ
-- ---------------------------------------------------------------------------

CREATE TABLE `channel_connections__rebuilt` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`account_label` text NOT NULL,
	`connected_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`provider_identity` text,
	`credential_ref` text NOT NULL
);--> statement-breakpoint

INSERT INTO `channel_connections__rebuilt`
	(`id`, `workspace_id`, `kind`, `account_label`, `connected_at`, `expires_at`, `revoked_at`, `provider_identity`, `credential_ref`)
SELECT `id`, `workspace_id`, `kind`, `account_label`, `connected_at`, `expires_at`, `revoked_at`, `provider_identity`, `credential_ref`
FROM `channel_connections`;--> statement-breakpoint

DROP TABLE `channel_connections`;--> statement-breakpoint
ALTER TABLE `channel_connections__rebuilt` RENAME TO `channel_connections`;--> statement-breakpoint

CREATE INDEX `channel_connections_workspace_kind_idx` ON `channel_connections` (`workspace_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `channel_connections_workspace_provider_identity_idx` ON `channel_connections` (`workspace_id`,`kind`,`provider_identity`);--> statement-breakpoint
CREATE UNIQUE INDEX `channel_connections_workspace_credential_ref_idx` ON `channel_connections` (`workspace_id`,`kind`,`credential_ref`);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. publications — 0034 が末尾へ足した 7 列を宣言どおりの位置へ
-- ---------------------------------------------------------------------------
-- この表には 0035 が置いたトリガーが 1 本ある。表を落とすと消えるので、
-- 作り直しの最後に必ず張り直す。落とすと配信監査の outbox 確定が
-- 「何も起きないまま成功」に変わる。

CREATE TABLE `publications__rebuilt` (
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

INSERT INTO `publications__rebuilt`
	(`id`, `workspace_id`, `variant_id`, `variant_revision`, `kind`, `connection_id`, `state`, `scheduled_at`, `retry_at`, `delivery_lease_until`, `idempotency_key`, `provider_identity`, `provider_delivery_key`, `provider_record_created_at`, `attempts`, `external_id`, `external_url`, `last_error`, `published_at`, `last_delivery_audit_id`)
SELECT `id`, `workspace_id`, `variant_id`, `variant_revision`, `kind`, `connection_id`, `state`, `scheduled_at`, `retry_at`, `delivery_lease_until`, `idempotency_key`, `provider_identity`, `provider_delivery_key`, `provider_record_created_at`, `attempts`, `external_id`, `external_url`, `last_error`, `published_at`, `last_delivery_audit_id`
FROM `publications`;--> statement-breakpoint

DROP TABLE `publications`;--> statement-breakpoint
ALTER TABLE `publications__rebuilt` RENAME TO `publications`;--> statement-breakpoint

CREATE INDEX `publications_workspace_variant_idx` ON `publications` (`workspace_id`,`variant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `publications_workspace_idempotency_idx` ON `publications` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `publications_provider_delivery_key_idx` ON `publications` (`kind`,`provider_identity`,`provider_delivery_key`);--> statement-breakpoint
CREATE INDEX `publications_state_scheduled_idx` ON `publications` (`state`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `publications_state_retry_idx` ON `publications` (`state`,`retry_at`);--> statement-breakpoint
CREATE INDEX `publications_state_lease_idx` ON `publications` (`state`,`delivery_lease_until`);--> statement-breakpoint

CREATE TRIGGER `publications_commit_delivery_audit_outbox`
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
END;
