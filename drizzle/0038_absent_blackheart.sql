-- 0036がprovider identity境界を含む最終形へ収束済み。
-- 独立表と索引はIF NOT EXISTSで何度でも安全に確認できる。
CREATE TABLE IF NOT EXISTS `channel_provider_delivery_leases` (
	`kind` text NOT NULL, `provider_identity` text NOT NULL,
	`holder_publication_id` text NOT NULL, `lease_token` text NOT NULL,
	`acquired_at` integer NOT NULL, `expires_at` integer NOT NULL,
	PRIMARY KEY (`kind`, `provider_identity`)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `channel_provider_delivery_leases_expiry_idx`
	ON `channel_provider_delivery_leases` (`expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `channel_connections_workspace_kind_idx`
	ON `channel_connections` (`workspace_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `channel_connections_workspace_provider_identity_idx`
	ON `channel_connections` (`workspace_id`,`kind`,`provider_identity`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `channel_connections_workspace_credential_ref_idx`
	ON `channel_connections` (`workspace_id`,`kind`,`credential_ref`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `publications_provider_delivery_key_idx`
	ON `publications` (`kind`,`provider_identity`,`provider_delivery_key`);
