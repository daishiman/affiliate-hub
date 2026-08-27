-- 0036がoutbox/Publication tokenを含む最終形へ収束済み。
-- table/index/triggerはすべてIF NOT EXISTSでprefix再実行を安全にする。
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
