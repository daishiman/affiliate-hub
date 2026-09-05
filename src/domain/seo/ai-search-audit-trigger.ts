/**
 * AI 検索適合の点検が走った契機。
 *
 * --- なぜ domain に置くか ---
 * この語彙は保存先（`src/db/schema.ts` の列の enum）とポート宣言の
 * **両方**が使う。片方に置いてもう片方が import すると、
 * application → db か db → application のどちらかに逆向きの辺ができる。
 * どちらも既存の依存の向きに無い。両方が既に依存している domain へ置けば
 * 辺は増えず、値が 2 か所に書き写されることも無い。
 *
 * `publish` = 記事を公開した直後 / `scheduled` = 定期再点検（cron）。
 * 表は分けず、この列で区別する（retention-policy.md の R3）。
 */
export const AUDIT_TRIGGERS = ["publish", "scheduled"] as const;

export type AuditTrigger = (typeof AUDIT_TRIGGERS)[number];
