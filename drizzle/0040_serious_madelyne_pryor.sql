-- workspace を親 site_blueprints から一意に決められない既存行は、空文字で
-- 所有者不明のまま隠さず、schema変更より前に移行を止める。guard表は失敗後の
-- 再実行でも作成でき、列追加済みの半端な状態を作らない。
CREATE TABLE IF NOT EXISTS `_0040_workspace_backfill_guard` (
  `workspace_backfill` integer NOT NULL CHECK (`workspace_backfill` = 0)
);--> statement-breakpoint
DELETE FROM `_0040_workspace_backfill_guard`;--> statement-breakpoint
INSERT INTO `_0040_workspace_backfill_guard` (`workspace_backfill`)
SELECT count(*)
FROM `blog_theme` t
LEFT JOIN `site_blueprints` b ON b.`slug` = t.`site_slug`
WHERE b.`workspace_id` IS NULL
HAVING count(*) > 0;--> statement-breakpoint
INSERT INTO `_0040_workspace_backfill_guard` (`workspace_backfill`)
SELECT count(*)
FROM `page_theme_override` o
LEFT JOIN `site_blueprints` b ON b.`slug` = o.`site_slug`
WHERE b.`workspace_id` IS NULL
HAVING count(*) > 0;--> statement-breakpoint
-- 固定文書の正本は SITE_DOCUMENT_KEYS。移行先が無い旧 contact/sitemap は
-- 推測して別ページへ入れず、運営者が解決できるよう明示停止する。
INSERT INTO `_0040_workspace_backfill_guard` (`workspace_backfill`)
SELECT count(*)
FROM `legal_page`
WHERE `kind` NOT IN (
  'methodology', 'editorial-policy', 'advertising-policy', 'ai-policy',
  'privacy', 'terms', 'operator', 'tokushoho',
  'profile', 'company', 'site_policy', 'privacy_policy',
  'commercial_transaction', 'review_guidelines'
)
HAVING count(*) > 0;--> statement-breakpoint
-- profile/company はどちらも operator へ移る。同じsiteに両方あれば、どちらを
-- 残すか決める根拠が無いので、後勝ちで本文を捨てずに止める。
INSERT INTO `_0040_workspace_backfill_guard` (`workspace_backfill`)
SELECT count(*)
FROM (
  SELECT `site_slug`,
    CASE `kind`
      WHEN 'profile' THEN 'operator'
      WHEN 'company' THEN 'operator'
      WHEN 'site_policy' THEN 'terms'
      WHEN 'privacy_policy' THEN 'privacy'
      WHEN 'commercial_transaction' THEN 'tokushoho'
      WHEN 'review_guidelines' THEN 'methodology'
      ELSE `kind`
    END AS canonical_kind,
    count(*) AS n
  FROM `legal_page`
  GROUP BY `site_slug`, canonical_kind
  HAVING n > 1
);--> statement-breakpoint
DROP TABLE `_0040_workspace_backfill_guard`;--> statement-breakpoint

UPDATE `legal_page`
SET `kind` = CASE `kind`
  WHEN 'profile' THEN 'operator'
  WHEN 'company' THEN 'operator'
  WHEN 'site_policy' THEN 'terms'
  WHEN 'privacy_policy' THEN 'privacy'
  WHEN 'commercial_transaction' THEN 'tokushoho'
  WHEN 'review_guidelines' THEN 'methodology'
  ELSE `kind`
END;--> statement-breakpoint

ALTER TABLE `blog_theme` ADD `workspace_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `blog_theme`
SET `workspace_id` = (
  SELECT b.`workspace_id` FROM `site_blueprints` b WHERE b.`slug` = `blog_theme`.`site_slug`
)
WHERE `workspace_id` = '';--> statement-breakpoint
CREATE INDEX `blog_theme_workspace_idx` ON `blog_theme` (`workspace_id`,`site_slug`);--> statement-breakpoint

ALTER TABLE `page_theme_override` ADD `workspace_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `page_theme_override`
SET `workspace_id` = (
  SELECT b.`workspace_id` FROM `site_blueprints` b
  WHERE b.`slug` = `page_theme_override`.`site_slug`
)
WHERE `workspace_id` = '';--> statement-breakpoint
CREATE INDEX `page_theme_override_workspace_idx` ON `page_theme_override` (`workspace_id`,`site_slug`);--> statement-breakpoint

-- 0040 より前はrepositoryのDELETE→INSERTだけが重複を避けていたため、並行書込みで
-- 同じ自然identityが複数残り得た。最後に書かれたrowidを決定的に残してから、
-- NULLを同値として扱う2本の部分一意索引をDB境界に置く。
DELETE FROM `blog_affiliate_placement`
WHERE `tracking_code` IS NULL
  AND rowid NOT IN (
    SELECT max(rowid) FROM `blog_affiliate_placement`
    WHERE `tracking_code` IS NULL
    GROUP BY `workspace_id`, `site_slug`, `article_slug`, `placement`
  );--> statement-breakpoint
DELETE FROM `blog_affiliate_placement`
WHERE `tracking_code` IS NOT NULL
  AND rowid NOT IN (
    SELECT max(rowid) FROM `blog_affiliate_placement`
    WHERE `tracking_code` IS NOT NULL
    GROUP BY `workspace_id`, `site_slug`, `article_slug`, `placement`, `tracking_code`
  );--> statement-breakpoint
CREATE INDEX `blog_affiliate_placement_workspace_idx` ON `blog_affiliate_placement` (`workspace_id`,`site_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `blog_affiliate_placement_identity_without_code_idx`
ON `blog_affiliate_placement` (`workspace_id`,`site_slug`,`article_slug`,`placement`)
WHERE `tracking_code` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `blog_affiliate_placement_identity_with_code_idx`
ON `blog_affiliate_placement` (`workspace_id`,`site_slug`,`article_slug`,`placement`,`tracking_code`)
WHERE `tracking_code` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `blog_template_workspace_idx` ON `blog_template` (`workspace_id`,`site_slug`);
