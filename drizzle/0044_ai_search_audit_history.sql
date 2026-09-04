-- AI 検索適合の点検履歴。公開時と定期再点検の両方がここへ 1 行ずつ追記する。
--
-- 記事の識別子は `published_articles` と同じ (site_slug, slug) の対。
-- **外部キーを張らない。** 記事が取り下げられても「そのとき何が落ちていたか」は
-- 監査の記録として残す必要があり、記事の消滅で履歴が連鎖削除されると、
-- 「なぜ取り下げたか」を後から辿れなくなる。
--
-- 保持は記事ごと直近 30 件。刈り取りは追記と同じトランザクションで行うので、
-- 夜間バッチは要らない（retention-policy.md の R4）。
CREATE TABLE `ai_search_audit_history` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `site_slug` text NOT NULL,
  `slug` text NOT NULL,
  -- 'publish' | 'scheduled'。表は分けず、どちらの経路で入った行かを列で区別する。
  `trigger` text NOT NULL,
  -- 7 チェックのうち ok だった数。一覧の並べ替えに使うので列に出す。
  `passed_count` integer NOT NULL,
  -- 7 チェックの総数。checks の形が変わった行を後から見分けられる。
  `total_count` integer NOT NULL,
  -- AiSearchCheck[] をそのまま入れた JSON。
  `checks_json` text NOT NULL,
  -- 解析ロジックの版。版が変わった前後の行を混ぜて比べないための印。
  `analyzer_version` text NOT NULL,
  `checked_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
-- 記事ごとの新しい順。刈り取りと一覧の両方がこの並びを引く。
CREATE INDEX `ai_search_audit_history_article_idx`
  ON `ai_search_audit_history` (`site_slug`, `slug`, `checked_at`);--> statement-breakpoint
-- 管理画面は workspace 単位で「落ちている記事」を新しい順に読む。
CREATE INDEX `ai_search_audit_history_workspace_idx`
  ON `ai_search_audit_history` (`workspace_id`, `checked_at`);
