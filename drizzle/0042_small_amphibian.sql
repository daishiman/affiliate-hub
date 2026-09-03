ALTER TABLE `site_drafts` ADD `revision` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `site_blueprints` ADD `source_draft_id` text;--> statement-breakpoint
ALTER TABLE `site_blueprints` ADD `source_draft_revision` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `site_blueprints_source_draft_idx` ON `site_blueprints` (`source_draft_id`);--> statement-breakpoint
/*
 * ユースケースの事前 read は、同時に始まった 2 request に stale な null を返しうる。
 * UPDATE の WHERE だけでは 0 行更新が batch の失敗にならないため、作成の先頭 INSERT で
 * 下書きの所有者と未使用を DB 自身に確認させる。ここで RAISE すれば D1 batch 全体が巻き戻る。
 */
CREATE TRIGGER `site_blueprints_source_draft_guard`
BEFORE INSERT ON `site_blueprints`
WHEN NEW.`source_draft_id` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'site source draft is missing, owned by another workspace, or already used')
  WHERE NEW.`source_draft_revision` IS NULL
     OR NOT EXISTS (
    SELECT 1 FROM `site_drafts` d
    WHERE d.`id` = NEW.`source_draft_id`
      AND d.`workspace_id` = NEW.`workspace_id`
      AND d.`slug` = NEW.`slug`
      AND d.`created_site_slug` IS NULL
      AND d.`revision` = NEW.`source_draft_revision`
  );
END;--> statement-breakpoint
/*
 * 設計図だけあってサイト網の節点が無いブログを補填する。
 *
 * この状態が、13 問に答えて「作成済み」と出たのに `/s/<URL名>` が 404 になる
 * 現象そのものである。`resolvePublicSiteIdentity` は節点がちょうど 1 行
 * (active・未削除・会社一致) でなければ読者へ配らない。作成側が節点を
 * 作っていなかったため、設計図だけが残り、読者からは存在しないままだった。
 *
 * ホスト名は保存しない。基底ドメインは環境ごとの構成値で、
 * slug + SITE_BASE_DOMAIN から実行時に導出する。この migration は hostname 移行は担わず、
 * 下書きの revision 付き create-only claim とネットワーク節点の補填を担う。
 */
INSERT INTO `site_network_node`
  (`id`, `workspace_id`, `site_slug`, `role`, `parent_slug`, `name`, `one_line`, `position`, `status`, `deleted_at`)
SELECT
  'snn_backfill_' || b.`id`,
  b.`workspace_id`,
  b.`slug`,
  'hub',
  NULL,
  b.`name`,
  '',
  0,
  'active',
  NULL
FROM `site_blueprints` b
WHERE NOT EXISTS (
  SELECT 1 FROM `site_network_node` n WHERE n.`site_slug` = b.`slug`
);
