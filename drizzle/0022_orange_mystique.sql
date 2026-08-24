-- 既存の disclosures には workspace を復元できる列が無い。
-- 空文字や先頭の workspace を推測で付けると、別 tenant の表記として読まれる。
-- 旧行がある環境では何も書き換える前に止め、所有者 mapping を人が決めてから
-- forward migration を作る。新規/空テーブル環境だけがこの migration を通る。
CREATE TABLE `_migration_0022_disclosure_guard` (
	`legacy_count` integer NOT NULL CHECK (`legacy_count` = 0)
);
--> statement-breakpoint
INSERT INTO `_migration_0022_disclosure_guard` (`legacy_count`)
SELECT count(*) FROM `disclosures`;
--> statement-breakpoint
DROP TABLE `_migration_0022_disclosure_guard`;
--> statement-breakpoint
CREATE TABLE `policy_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`domain_scope` text NOT NULL,
	`channel_scope` text NOT NULL,
	`severity` text NOT NULL,
	`pattern` text NOT NULL,
	`ignore_case` integer DEFAULT true NOT NULL,
	`basis` text NOT NULL,
	`suggestion` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `policy_rules_workspace_enabled_idx` ON `policy_rules` (`workspace_id`,`enabled`);--> statement-breakpoint
ALTER TABLE `disclosures` ADD `workspace_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `disclosures` ADD `ai_assisted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `disclosures` ADD `updated_at` integer NOT NULL;--> statement-breakpoint
CREATE INDEX `disclosures_workspace_idx` ON `disclosures` (`workspace_id`);
