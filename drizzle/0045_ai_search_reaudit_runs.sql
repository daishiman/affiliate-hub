-- AI 検索の定期再点検の、workspace ごとの直近 1 回の最終状態。
--
-- 実行履歴を無限に持つ表ではなく、管理画面が「今の健全性」を読むための 1 行の投影。
-- だから主キーは workspace_id で、1 workspace に 1 行しか存在しない。
--
-- 3 つの CHECK が、名乗りと数の食い違いを DB の側で止める:
--   counts_check  数は非負で、走査数 = 記録数 + 失敗数（勘定が合わない行を作らせない）
--   time_check    完了時刻は開始時刻以降
--   state_check   status と failure_code と件数の組み合わせを固定する。
--                 とりわけ「記事 0 件の正常完了」と「対象取得に失敗した」を
--                 別の failure_code で区別し、後者を成功と名乗れないようにする。
CREATE TABLE `ai_search_reaudit_runs` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`scanned` integer NOT NULL,
	`recorded` integer NOT NULL,
	`failed` integer NOT NULL,
	`failure_code` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_search_reaudit_runs_counts_check" CHECK("ai_search_reaudit_runs"."scanned" >= 0 AND "ai_search_reaudit_runs"."recorded" >= 0 AND "ai_search_reaudit_runs"."failed" >= 0 AND "ai_search_reaudit_runs"."scanned" = "ai_search_reaudit_runs"."recorded" + "ai_search_reaudit_runs"."failed"),
	CONSTRAINT "ai_search_reaudit_runs_time_check" CHECK("ai_search_reaudit_runs"."completed_at" >= "ai_search_reaudit_runs"."started_at"),
	CONSTRAINT "ai_search_reaudit_runs_state_check" CHECK((
        ("ai_search_reaudit_runs"."status" = 'succeeded' AND "ai_search_reaudit_runs"."failure_code" IS NULL AND "ai_search_reaudit_runs"."failed" = 0)
        OR ("ai_search_reaudit_runs"."status" = 'partial' AND "ai_search_reaudit_runs"."failure_code" = 'article_audit_failed' AND "ai_search_reaudit_runs"."recorded" > 0 AND "ai_search_reaudit_runs"."failed" > 0)
        OR ("ai_search_reaudit_runs"."status" = 'failed' AND "ai_search_reaudit_runs"."failure_code" = 'article_audit_failed' AND "ai_search_reaudit_runs"."recorded" = 0 AND "ai_search_reaudit_runs"."failed" > 0)
        OR ("ai_search_reaudit_runs"."status" = 'failed' AND "ai_search_reaudit_runs"."failure_code" = 'target_list_unavailable' AND "ai_search_reaudit_runs"."scanned" = 0)
      ))
);
