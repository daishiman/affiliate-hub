ALTER TABLE `blog_article_block` ADD `workspace_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `blog_article_block_workspace_idx` ON `blog_article_block` (`workspace_id`,`article_id`,`position`);--> statement-breakpoint
ALTER TABLE `blog_article_rating` ADD `workspace_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `blog_article_rating_workspace_idx` ON `blog_article_rating` (`workspace_id`,`article_id`);--> statement-breakpoint
ALTER TABLE `blog_article_tag` ADD `workspace_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `blog_article_tag_workspace_idx` ON `blog_article_tag` (`workspace_id`,`article_id`);--> statement-breakpoint
ALTER TABLE `legal_page` ADD `workspace_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `legal_page_workspace_idx` ON `legal_page` (`workspace_id`,`site_slug`,`kind`);--> statement-breakpoint
-- 既にある行の作業場所を、親から写す。
--
-- 列だけ足して既定値 '' のままにすると、**どの作業場所にも属さない行**が残る。
-- 検査は列の有無しか見ないので、そのままでも緑になる。緑のまま、
-- 一覧に出てこない行が積み上がる形になるので、ここで埋めきる。
UPDATE `blog_article_block`
SET `workspace_id` = coalesce(
  (select a.`workspace_id` from `articles` a where a.`id` = `blog_article_block`.`article_id`),
  ''
)
WHERE `workspace_id` = '';--> statement-breakpoint
UPDATE `blog_article_tag`
SET `workspace_id` = coalesce(
  (select a.`workspace_id` from `articles` a where a.`id` = `blog_article_tag`.`article_id`),
  ''
)
WHERE `workspace_id` = '';--> statement-breakpoint
UPDATE `blog_article_rating`
SET `workspace_id` = coalesce(
  (select a.`workspace_id` from `articles` a where a.`id` = `blog_article_rating`.`article_id`),
  ''
)
WHERE `workspace_id` = '';--> statement-breakpoint
-- 固定ページは記事を持たないので、サイトの正本 (`site_blueprints`) から引く。
UPDATE `legal_page`
SET `workspace_id` = coalesce(
  (select b.`workspace_id` from `site_blueprints` b where b.`slug` = `legal_page`.`site_slug`),
  ''
)
WHERE `workspace_id` = '';
