-- 0034: legal_pageのtenant境界と、URL取り下げ墓標。
--
-- 同じSQLを途中から再実行できる。SQLiteに`ADD COLUMN IF NOT EXISTS`が無いため
-- site_blueprintsをALTERせず、墓標は独立表へ置く。legal_pageは一時sourceへ
-- 先に複写し、DROP→RENAME間で停止しても復元した後、完了時にsourceを破棄する。
CREATE TABLE IF NOT EXISTS `site_retirements` (
	`slug` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`retired_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `site_retirements_workspace_idx`
	ON `site_retirements` (`workspace_id`);--> statement-breakpoint

-- 旧版0034がsite_blueprintsへ直接追加したretired_atを独立墓標へ移す。
-- NATURAL LEFT JOINにより、旧列が無いDBではNULL列を補い、あるDBでは旧値を読む。
INSERT INTO `site_retirements` (`slug`, `workspace_id`, `retired_at`)
SELECT `site_blueprints`.`slug`, `site_blueprints`.`workspace_id`, `retired_at`
FROM `site_blueprints`
NATURAL LEFT JOIN (SELECT NULL AS `retired_at`)
WHERE `retired_at` IS NOT NULL
ON CONFLICT (`slug`) DO UPDATE SET
	`workspace_id` = excluded.`workspace_id`,
	`retired_at` = excluded.`retired_at`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `published_article_tombstones` (
	`site_slug` text NOT NULL,
	`slug` text NOT NULL,
	`workspace_id` text NOT NULL,
	`unpublished_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY (`site_slug`, `slug`)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `published_article_tombstones_workspace_idx`
	ON `published_article_tombstones` (`workspace_id`);--> statement-breakpoint

-- 公開行と墓標は同じ読者URLの排他的な2状態。アプリの事前SELECTだけでは、
-- Aの取り下げとBの公開が交差したときに異ownerの2行が共存できてしまう。
-- DB境界で全書込経路（直SQLを含む）を拒否し、D1 batch内の削除→挿入だけを許す。
-- trigger追加前からある行も見逃さず、所有site不明・owner不一致・2状態共存は
-- 既存データを推測修復せずmigrationを停止する。再実行時はguardを作り直せる。
DROP TABLE IF EXISTS `_migration_0034_published_article_guard`;--> statement-breakpoint
CREATE TABLE `_migration_0034_published_article_guard` (
	`invalid_owner_count` integer NOT NULL,
	`overlap_count` integer NOT NULL,
	CHECK (`invalid_owner_count` = 0 AND `overlap_count` = 0)
);--> statement-breakpoint
INSERT INTO `_migration_0034_published_article_guard`
	(`invalid_owner_count`, `overlap_count`)
SELECT
	(
		SELECT count(*) FROM (
			SELECT `site_slug`, `slug`, `workspace_id` FROM `published_articles`
			UNION ALL
			SELECT `site_slug`, `slug`, `workspace_id` FROM `published_article_tombstones`
		) AS `occupant`
		LEFT JOIN `site_blueprints`
			ON `site_blueprints`.`slug` = `occupant`.`site_slug`
			AND `site_blueprints`.`workspace_id` = `occupant`.`workspace_id`
		WHERE `site_blueprints`.`slug` IS NULL
	),
	(
		SELECT count(*)
		FROM `published_articles`
		INNER JOIN `published_article_tombstones`
			ON `published_article_tombstones`.`site_slug` = `published_articles`.`site_slug`
			AND `published_article_tombstones`.`slug` = `published_articles`.`slug`
	);--> statement-breakpoint
DROP TABLE `_migration_0034_published_article_guard`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `published_articles_reject_tombstone_on_insert`
BEFORE INSERT ON `published_articles`
WHEN NOT EXISTS (
	SELECT 1 FROM `site_blueprints`
	WHERE `slug` = NEW.`site_slug` AND `workspace_id` = NEW.`workspace_id`
) OR EXISTS (
	SELECT 1 FROM `published_article_tombstones`
	WHERE `site_slug` = NEW.`site_slug` AND `slug` = NEW.`slug`
)
BEGIN
	SELECT RAISE(ABORT, 'published_article_url_state_conflict');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `published_articles_reject_tombstone_on_update`
BEFORE UPDATE OF `site_slug`, `slug`, `workspace_id` ON `published_articles`
WHEN OLD.`workspace_id` <> NEW.`workspace_id` OR NOT EXISTS (
	SELECT 1 FROM `site_blueprints`
	WHERE `slug` = NEW.`site_slug` AND `workspace_id` = NEW.`workspace_id`
) OR EXISTS (
	SELECT 1 FROM `published_article_tombstones`
	WHERE `site_slug` = NEW.`site_slug` AND `slug` = NEW.`slug`
)
BEGIN
	SELECT RAISE(ABORT, 'published_article_url_state_conflict');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `published_articles_reject_corrupt_delete`
BEFORE DELETE ON `published_articles`
WHEN EXISTS (
	SELECT 1 FROM `published_article_tombstones`
	WHERE `site_slug` = OLD.`site_slug` AND `slug` = OLD.`slug`
)
BEGIN
	SELECT RAISE(ABORT, 'published_article_url_state_conflict');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `published_article_tombstones_reject_article_on_insert`
BEFORE INSERT ON `published_article_tombstones`
WHEN NOT EXISTS (
	SELECT 1 FROM `site_blueprints`
	WHERE `slug` = NEW.`site_slug` AND `workspace_id` = NEW.`workspace_id`
) OR EXISTS (
	SELECT 1 FROM `published_articles`
	WHERE `site_slug` = NEW.`site_slug` AND `slug` = NEW.`slug`
)
BEGIN
	SELECT RAISE(ABORT, 'published_article_url_state_conflict');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `published_article_tombstones_reject_article_on_update`
BEFORE UPDATE OF `site_slug`, `slug`, `workspace_id` ON `published_article_tombstones`
WHEN OLD.`workspace_id` <> NEW.`workspace_id` OR NOT EXISTS (
	SELECT 1 FROM `site_blueprints`
	WHERE `slug` = NEW.`site_slug` AND `workspace_id` = NEW.`workspace_id`
) OR EXISTS (
	SELECT 1 FROM `published_articles`
	WHERE `site_slug` = NEW.`site_slug` AND `slug` = NEW.`slug`
)
BEGIN
	SELECT RAISE(ABORT, 'published_article_url_state_conflict');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `published_article_tombstones_reject_corrupt_delete`
BEFORE DELETE ON `published_article_tombstones`
WHEN EXISTS (
	SELECT 1 FROM `published_articles`
	WHERE `site_slug` = OLD.`site_slug` AND `slug` = OLD.`slug`
)
BEGIN
	SELECT RAISE(ABORT, 'published_article_url_state_conflict');
END;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `capacity_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('brand','site','member','generation')),
	`acquired_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `capacity_leases_workspace_kind_expiry_idx`
	ON `capacity_leases` (`workspace_id`,`kind`,`expires_at`);--> statement-breakpoint

-- 旧版0034がlegal_pageをDROPした直後なら、空の旧形を戻してSELECTを成立させる。
-- v2 legal_pageが既にある場合はIF NOT EXISTSなので何も変えない。
CREATE TABLE IF NOT EXISTS `legal_page` (
	`id` text PRIMARY KEY NOT NULL,
	`site_slug` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint

-- DROP→RENAME間で停止した場合だけ正本となる一時source。末尾で必ず破棄する。
CREATE TABLE IF NOT EXISTS `_migration_0034_legal_page_source` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint

DROP TABLE IF EXISTS `_migration_0034_legal_page_guard`;--> statement-breakpoint
CREATE TABLE `_migration_0034_legal_page_guard` (
	`legacy_count` integer NOT NULL,
	`migrated_count` integer NOT NULL,
	`distinct_target_count` integer NOT NULL,
	CHECK (
		`legacy_count` = `migrated_count`
		AND `migrated_count` = `distinct_target_count`
	)
);--> statement-breakpoint

-- 所有site不明・曖昧な旧key・mapping衝突は、source/旧表を変更する前に停止する。
INSERT INTO `_migration_0034_legal_page_guard`
	(`legacy_count`, `migrated_count`, `distinct_target_count`)
SELECT
	(SELECT count(*) FROM `legal_page`),
	(SELECT count(*)
	 FROM `legal_page`
	 INNER JOIN `site_blueprints` ON `site_blueprints`.`slug` = `legal_page`.`site_slug`
	 WHERE `legal_page`.`kind` IN (
		'operator', 'privacy_policy', 'tokushoho', 'methodology',
		'editorial-policy', 'advertising-policy', 'ai-policy', 'privacy', 'terms'
	 )),
	(SELECT count(*) FROM (
		SELECT
			`legal_page`.`site_slug`,
			CASE `legal_page`.`kind`
				WHEN 'privacy_policy' THEN 'privacy'
				ELSE `legal_page`.`kind`
			END AS `target_kind`
		FROM `legal_page`
		INNER JOIN `site_blueprints` ON `site_blueprints`.`slug` = `legal_page`.`site_slug`
		WHERE `legal_page`.`kind` IN (
			'operator', 'privacy_policy', 'tokushoho', 'methodology',
			'editorial-policy', 'advertising-policy', 'ai-policy', 'privacy', 'terms'
		)
		GROUP BY `legal_page`.`site_slug`, `target_kind`
	));--> statement-breakpoint
DROP TABLE `_migration_0034_legal_page_guard`;--> statement-breakpoint

-- 旧表または既にv2になった表の共有列から、所有workspaceをsite境界で再解決する。
INSERT INTO `_migration_0034_legal_page_source`
	(`id`, `workspace_id`, `site_slug`, `kind`, `title`, `body`, `updated_at`)
SELECT
	`legal_page`.`id`,
	`site_blueprints`.`workspace_id`,
	`legal_page`.`site_slug`,
	CASE `legal_page`.`kind`
		WHEN 'privacy_policy' THEN 'privacy'
		ELSE `legal_page`.`kind`
	END,
	`legal_page`.`title`,
	`legal_page`.`body`,
	`legal_page`.`updated_at`
FROM `legal_page`
INNER JOIN `site_blueprints` ON `site_blueprints`.`slug` = `legal_page`.`site_slug`
WHERE `legal_page`.`kind` IN (
	'operator', 'privacy_policy', 'tokushoho', 'methodology',
	'editorial-policy', 'advertising-policy', 'ai-policy', 'privacy', 'terms'
)
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id` = excluded.`workspace_id`,
	`site_slug` = excluded.`site_slug`,
	`kind` = excluded.`kind`,
	`title` = excluded.`title`,
	`body` = excluded.`body`,
	`updated_at` = excluded.`updated_at`;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `_new_legal_page` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
INSERT INTO `_new_legal_page`
	(`id`, `workspace_id`, `site_slug`, `kind`, `title`, `body`, `updated_at`)
SELECT `id`, `workspace_id`, `site_slug`, `kind`, `title`, `body`, `updated_at`
FROM `_migration_0034_legal_page_source`
WHERE 1
ON CONFLICT (`id`) DO UPDATE SET
	`workspace_id` = excluded.`workspace_id`,
	`site_slug` = excluded.`site_slug`,
	`kind` = excluded.`kind`,
	`title` = excluded.`title`,
	`body` = excluded.`body`,
	`updated_at` = excluded.`updated_at`;--> statement-breakpoint

DROP TABLE `legal_page`;--> statement-breakpoint
ALTER TABLE `_new_legal_page` RENAME TO `legal_page`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `legal_page_workspace_site_idx`
	ON `legal_page` (`workspace_id`,`site_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `legal_page_site_kind_idx`
	ON `legal_page` (`site_slug`,`kind`);--> statement-breakpoint

-- legal_pageが正本へ戻った後は、第二正本を残さない。
DROP TABLE IF EXISTS `_migration_0034_legal_page_source`;
