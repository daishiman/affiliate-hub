-- 0035: 生成器が書けないものを置く。トリガー・旧行の引き継ぎ・索引の取りこぼし。
--
-- **なぜ 0034 と分けるか。** 0034 は schema.ts から機械が起こしたもので、
-- 表と列と索引しか書けない。トリガーも、既にある行の引き継ぎも、
-- schema.ts に書く場所が無い。次に誰かが `drizzle-kit generate` を走らせた日に、
-- 機械は「これは schema に無い」とは言わない——**黙って無視する**。
-- 混ぜて置くと、生成し直した瞬間にここだけが消えたことに誰も気づけない。
--
-- 2026-08-27 に dev を取り込んだとき、実際にこれが起きた。番号が重なった
-- migration を schema から作り直したところ、表は全部揃ったのに
-- **境界の検査 8 件が緑のまま素通りするようになった**（`tests/integration/
-- d1-published-article.test.ts` と `d1-distribution.test.ts` が捕まえた）。
--
-- 何度でも先頭から流せる。すべて IF NOT EXISTS で、状態を持たない。

-- ---------------------------------------------------------------------------
-- 1. 公開記事と墓標は、同じ URL に同時に居られない
-- ---------------------------------------------------------------------------
-- 「取り下げた URL」を別の作業場所が拾って公開できると、読者から見て
-- 同じ住所の中身が別の会社のものへ入れ替わる。アプリ側だけで守ると、
-- 2 つの要求が同時に来た日に両方とも「まだ空いている」を見る。

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

-- ---------------------------------------------------------------------------
-- 2. 配信の状態と、その操作の記録は、同時にしか確定しない
-- ---------------------------------------------------------------------------
-- 配信済みの印だけが立って記録が残らないと、「誰がいつ何を外へ出したか」を
-- 後から言えなくなる。逆に記録だけが残ると、出していないものを出したことにする。
-- 出す側（publications）が印を立てた一手で、記録の側の受け渡しを閉じる。

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

-- 配ったことにする前に、記録の中身が 1 文字も違っていないことを確かめる。
-- 「配った」と「配ったつもりの別物」を、後から見分ける手立てが他に無い。
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

--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. 配信の作業場所別の絞り込み
-- ---------------------------------------------------------------------------
-- 接続の一覧は必ず「作業場所 × 種類」で引く。schema.ts に載っていないので
-- 生成器は作らないが、無いと作業場所をまたぐ全走査になる。
CREATE INDEX IF NOT EXISTS `channel_connections_workspace_kind_idx`
	ON `channel_connections` (`workspace_id`, `kind`);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. 配信worker を入れる前からある行の引き継ぎ
-- ---------------------------------------------------------------------------
-- 0034 が足した列は、既にある行では NULL のまま。列を足しただけで放置すると、
-- 再試行待ちの行が**二度と拾われない**（`retry_at IS NULL` は候補に入らない）。

-- 旧 RETRY_SCHEDULED は予定時刻を優先し、それも無ければ今から拾えるようにする。
UPDATE `publications`
SET `retry_at` = coalesce(`scheduled_at`, unixepoch())
WHERE `state` = 'RETRY_SCHEDULED' AND `retry_at` IS NULL;--> statement-breakpoint

-- 旧 SENDING は lease も provider 側の鍵も持っていない。推測して再送すると、
-- 相手側に**同じ投稿が 2 つ**できる。人が確認できる失敗へ戻して止める。
UPDATE `publications`
SET `state` = 'FAILED_SEND',
	`delivery_lease_until` = NULL,
	`last_error` = coalesce(
		`last_error`,
		'送信中の旧データを安全に引き継げませんでした。配信先を確認して再試行してください。'
	)
WHERE `state` = 'SENDING'
	AND (`delivery_lease_until` IS NULL OR `provider_delivery_key` IS NULL);
