-- workspace を親 site_blueprints から一意に決められない既存行は、空文字で
-- 所有者不明のまま隠さず、schema変更より前に移行を止める。guard表は失敗後の
-- 再実行でも作成でき、列追加済みの半端な状態を作らない。
CREATE TABLE IF NOT EXISTS `_0041_workspace_backfill_guard` (
  `workspace_backfill` integer NOT NULL CHECK (`workspace_backfill` = 0)
);--> statement-breakpoint
DELETE FROM `_0041_workspace_backfill_guard`;--> statement-breakpoint
INSERT INTO `_0041_workspace_backfill_guard` (`workspace_backfill`)
SELECT count(*)
FROM `blog_theme` t
LEFT JOIN `site_blueprints` b ON b.`slug` = t.`site_slug`
WHERE b.`workspace_id` IS NULL
HAVING count(*) > 0;--> statement-breakpoint
INSERT INTO `_0041_workspace_backfill_guard` (`workspace_backfill`)
SELECT count(*)
FROM `page_theme_override` o
LEFT JOIN `site_blueprints` b ON b.`slug` = o.`site_slug`
WHERE b.`workspace_id` IS NULL
HAVING count(*) > 0;--> statement-breakpoint
DROP TABLE `_0041_workspace_backfill_guard`;--> statement-breakpoint

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

CREATE INDEX `blog_template_workspace_idx` ON `blog_template` (`workspace_id`,`site_slug`);--> statement-breakpoint

-- 掲載の自然identity。`blog-affiliate-placement-repository.ts` の `save` は
-- ON CONFLICT でこの組を指すので、索引が無いと SQLite が
-- 「一致する UNIQUE 制約が無い」として INSERT ごと拒む（＝保存が全部失敗する）。
-- 速さのためではなく、**repository の外から書いても重複が作れない**ようにするため。
-- 追跡コードは NULL を取るので、NULL 同士が衝突しない SQL の性質に合わせて
-- 2 本に分ける（1 本にすると「コード無しの掲載」が何件でも作れてしまう）。
-- 索引を置く前に既存の重複を決定的に 1 件へ寄せる。0041 より前は repository の
-- DELETE→INSERT だけが重複を避けていたので、並行書込みで同じ自然identityが
-- 複数残り得た。**残すのは最後に書かれた rowid** で、どれが残るかを実行のたび
-- 変えない。ここを飛ばすと索引作成そのものが既存行で落ちる。
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
CREATE UNIQUE INDEX `blog_affiliate_placement_identity_idx`
ON `blog_affiliate_placement` (`workspace_id`,`site_slug`,`article_slug`,`placement`)
WHERE `tracking_code` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `blog_affiliate_placement_identity_code_idx`
ON `blog_affiliate_placement` (`workspace_id`,`site_slug`,`article_slug`,`placement`,`tracking_code`)
WHERE `tracking_code` IS NOT NULL;
