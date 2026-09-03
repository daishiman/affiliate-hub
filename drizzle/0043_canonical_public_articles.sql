-- `articles` は編集 aggregate、`published_articles` は唯一の公開 projection。
-- 公開側の由来だけを保存し、両表を独立な公開正本として union しない。
--
-- 公開 URL は site_slug + slug でグローバルに一意なため、所有者の違う
-- site/article/projection/tombstone は黙って除外せず、列追加前に migration を止める。
-- guard 表は中断後の再試行でも使えるが、ledger が成功を記録した後はこの DDL を再実行しない。
CREATE TABLE IF NOT EXISTS _0042_public_article_guard (
  ok integer NOT NULL CHECK (ok = 1)
);--> statement-breakpoint
DELETE FROM _0042_public_article_guard;--> statement-breakpoint
INSERT INTO _0042_public_article_guard (ok)
SELECT CASE WHEN EXISTS (
  SELECT 1
  FROM articles a
  WHERE a.workspace_id IS NOT NULL
    AND a.site_slug IS NOT NULL
    AND a.status = 'published'
    AND (
      NOT EXISTS (
        SELECT 1 FROM site_blueprints b
        WHERE b.workspace_id = a.workspace_id AND b.slug = a.site_slug
      )
      OR EXISTS (
        SELECT 1 FROM published_articles p
        WHERE p.site_slug = a.site_slug
          AND p.slug = a.slug
          AND p.workspace_id <> a.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM published_article_tombstones t
        WHERE t.site_slug = a.site_slug
          AND t.slug = a.slug
          AND t.workspace_id <> a.workspace_id
      )
      OR (
        a.deleted_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM published_articles p
          WHERE p.site_slug = a.site_slug AND p.slug = a.slug
        )
      )
      OR (a.deleted_at IS NOT NULL AND a.published_at IS NULL)
      OR (
        NOT EXISTS (
          SELECT 1 FROM published_articles p
          WHERE p.site_slug = a.site_slug
            AND p.slug = a.slug
            AND p.workspace_id = a.workspace_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM published_article_tombstones t
          WHERE t.site_slug = a.site_slug
            AND t.slug = a.slug
            AND t.workspace_id = a.workspace_id
        )
        AND a.published_at IS NULL
      )
    )
) OR EXISTS (
  SELECT 1
  FROM articles a
  WHERE a.workspace_id IS NOT NULL
    AND a.site_slug IS NOT NULL
    AND a.status = 'published'
  GROUP BY a.site_slug, a.slug
  HAVING count(*) > 1
) OR EXISTS (
  SELECT 1
  FROM published_articles p
  INNER JOIN published_article_tombstones t
    ON t.site_slug = p.site_slug AND t.slug = p.slug
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE _0042_public_article_guard;--> statement-breakpoint
ALTER TABLE `articles` ADD `public_category_slug` text;--> statement-breakpoint
-- 既存projectionの分類があればsnapshot側を優先し、次に既存のcategory参照を使う。
-- どちらも無い旧公開行は、架空の分類を推測せずcanonical sentinel「未分類」へ移す。
-- 空の署名も同様に「著者未設定」として移し、旧公開記事を黙って404にしない。
UPDATE `articles`
SET `public_category_slug` = coalesce(
  (
    SELECT p.`category_slug`
    FROM `published_articles` p
    WHERE p.`workspace_id` = `articles`.`workspace_id`
      AND p.`site_slug` = `articles`.`site_slug`
      AND p.`slug` = `articles`.`slug`
  ),
  (SELECT c.`slug` FROM `categories` c WHERE c.`id` = `articles`.`category_id`),
  'uncategorized'
)
WHERE `workspace_id` IS NOT NULL
  AND `site_slug` IS NOT NULL
  AND `status` = 'published';--> statement-breakpoint
-- canonical projection導入前に論理削除された公開記事は、同じURLを予約する墓標へ移す。
-- 既存公開行との競合は上のguardで停止し、物理削除や推測上書きはしない。
INSERT INTO `published_article_tombstones` (
  `site_slug`, `slug`, `workspace_id`, `unpublished_at`
)
SELECT a.`site_slug`, a.`slug`, a.`workspace_id`, a.`deleted_at`
FROM `articles` a
WHERE a.`workspace_id` IS NOT NULL
  AND a.`site_slug` IS NOT NULL
  AND a.`status` = 'published'
  AND a.`deleted_at` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `published_articles` p
    WHERE p.`site_slug` = a.`site_slug` AND p.`slug` = a.`slug`
  )
  AND NOT EXISTS (
    SELECT 1 FROM `published_article_tombstones` t
    WHERE t.`site_slug` = a.`site_slug` AND t.`slug` = a.`slug`
  );--> statement-breakpoint
ALTER TABLE `published_articles` ADD `source_article_id` text
  REFERENCES `articles`(`id`) ON DELETE RESTRICT;--> statement-breakpoint
CREATE UNIQUE INDEX `published_articles_source_article_idx`
  ON `published_articles` (`source_article_id`)
  WHERE `source_article_id` IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER `published_articles_source_guard_insert`
BEFORE INSERT ON `published_articles`
WHEN NEW.`source_article_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `articles` a
  WHERE a.`id` = NEW.`source_article_id`
    AND a.`workspace_id` = NEW.`workspace_id`
    AND a.`site_slug` = NEW.`site_slug`
    AND a.`slug` = NEW.`slug`
    AND a.`status` = 'published'
    AND a.`deleted_at` IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published_article_source_conflict');
END;--> statement-breakpoint
CREATE TRIGGER `published_articles_source_guard_update`
BEFORE UPDATE ON `published_articles`
WHEN (OLD.`source_article_id` IS NOT NULL
    AND OLD.`source_article_id` IS NOT NEW.`source_article_id`)
  OR (NEW.`source_article_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `articles` a
    WHERE a.`id` = NEW.`source_article_id`
      AND a.`workspace_id` = NEW.`workspace_id`
      AND a.`site_slug` = NEW.`site_slug`
      AND a.`slug` = NEW.`slug`
      AND a.`status` = 'published'
      AND a.`deleted_at` IS NULL
  ))
BEGIN
  SELECT RAISE(ABORT, 'published_article_source_conflict');
END;--> statement-breakpoint

-- 同じ所有者・site・slug の projection は snapshot を一文字も上書きせず、
-- 編集 aggregate の由来だけを結び付ける。この UPDATE は再実行しても同じ状態に収束する。
UPDATE published_articles
SET source_article_id = (
  SELECT a.id
  FROM articles a
  WHERE a.workspace_id = published_articles.workspace_id
    AND a.site_slug = published_articles.site_slug
    AND a.slug = published_articles.slug
    AND a.status = 'published'
    AND a.deleted_at IS NULL
)
WHERE source_article_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM articles a
    WHERE a.workspace_id = published_articles.workspace_id
      AND a.site_slug = published_articles.site_slug
      AND a.slug = published_articles.slug
      AND a.status = 'published'
      AND a.deleted_at IS NULL
  );--> statement-breakpoint

-- 編集側にだけ存在した公開印は、本文を失わない最小の rich projection へ補填する。
-- 取り下げ墓標・archived・論理削除は必ず優先し、再公開しない。
INSERT INTO `published_articles` (
  `site_slug`, `slug`, `workspace_id`, `source_article_id`, `type`, `title`, `summary`,
  `category_slug`, `author_slug`, `author_name`, `published_at`, `updated_at`,
  `archived_at`, `article_json`
)
SELECT
  a.`site_slug`,
  a.`slug`,
  a.`workspace_id`,
  a.`id`,
  a.`type`,
  a.`title`,
  coalesce(nullif(a.`summary`, ''), nullif(a.`lead`, ''), a.`title`),
  a.`public_category_slug`,
  CASE WHEN nullif(trim(a.`author_name`), '') IS NULL
    THEN 'unknown-author' ELSE 'source-' || a.`id` END,
  coalesce(nullif(trim(a.`author_name`), ''), '著者未設定'),
  strftime('%Y-%m-%dT%H:%M:%SZ', coalesce(a.`published_at`, a.`updated_at`, a.`created_at`), 'unixepoch'),
  strftime('%Y-%m-%dT%H:%M:%SZ', a.`updated_at`, 'unixepoch'),
  NULL,
  json_object(
    'slug', a.`slug`,
    'siteSlug', a.`site_slug`,
    'type', a.`type`,
    'title', a.`title`,
    'summary', coalesce(nullif(a.`summary`, ''), nullif(a.`lead`, ''), a.`title`),
    'categorySlug', a.`public_category_slug`,
    'publishedAt', strftime('%Y-%m-%dT%H:%M:%SZ', coalesce(a.`published_at`, a.`updated_at`, a.`created_at`), 'unixepoch'),
    'updatedAt', strftime('%Y-%m-%dT%H:%M:%SZ', a.`updated_at`, 'unixepoch'),
    'author', json_object(
      'slug', CASE WHEN nullif(trim(a.`author_name`), '') IS NULL
        THEN 'unknown-author' ELSE 'source-' || a.`id` END,
      'name', coalesce(nullif(trim(a.`author_name`), ''), '著者未設定'),
      'bio', '',
      'credentials', json_array()
    ),
    'disclosureRequired', CASE WHEN EXISTS (
      SELECT 1 FROM `blog_article_block` disclosure
      WHERE disclosure.`article_id` = a.`id`
        AND disclosure.`workspace_id` = a.`workspace_id`
        AND disclosure.`kind` = 'disclosure-notice'
    ) THEN json('true') ELSE json('false') END,
    'sections', CASE WHEN EXISTS (
      SELECT 1 FROM `blog_article_block` present
      WHERE present.`article_id` = a.`id`
        AND present.`workspace_id` = a.`workspace_id`
    ) THEN (
      SELECT json_group_array(json(section.`value`))
      FROM (
        SELECT json_object(
          'id', b.`id`,
          'heading', coalesce(nullif(b.`heading`, ''), '本文'),
          'paragraphs', json_array(b.`body`)
        ) AS `value`
        FROM `blog_article_block` b
        WHERE b.`article_id` = a.`id` AND b.`workspace_id` = a.`workspace_id`
        ORDER BY b.`position`, b.`id`
      ) section
    ) ELSE json_array(json_object(
      'id', 'source-' || a.`id` || '-body',
      'heading', '本文',
      'paragraphs', json_array(coalesce(nullif(a.`lead`, ''), a.`title`))
    )) END
  )
FROM `articles` a
WHERE a.`workspace_id` IS NOT NULL
  AND a.`site_slug` IS NOT NULL
  AND a.`status` = 'published'
  AND a.`deleted_at` IS NULL
  AND a.`published_at` IS NOT NULL
  AND a.`public_category_slug` IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM `site_blueprints` b
    WHERE b.`workspace_id` = a.`workspace_id` AND b.`slug` = a.`site_slug`
  )
  AND NOT EXISTS (
    SELECT 1 FROM `published_articles` p
    WHERE p.`site_slug` = a.`site_slug` AND p.`slug` = a.`slug`
  )
  AND NOT EXISTS (
    SELECT 1 FROM `published_article_tombstones` t
    WHERE t.`site_slug` = a.`site_slug` AND t.`slug` = a.`slug`
  );
