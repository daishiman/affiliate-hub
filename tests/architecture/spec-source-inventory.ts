import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 2026-09-06 に実在を照合した出典の床。件数ではなく同一性を保持する。
 * cloudflare-r2-overview は R2 一次資料の別ページであり、
 * cloudflare-r2 と同じものとして畳まない。追加対象は targets[] から全件測る。
 *
 * ── 2026-09-08、dev との合流で 22 → 29 ────────────────────────
 *
 * 共通の 15 件に、**どちらの枝も 7 件ずつ、重なりなく**足していた。
 *
 *   dev の 7 … cloudflare-for-saas / cloudflare-r2 / cloudflare-r2-overview /
 *              google-search-central / schema-org / w3c-wai-aria /
 *              web-dev-core-web-vitals
 *   この枝の 7 … google-search-console-api / anthropic-web-search-tool /
 *              gemini-google-search-grounding / cloudflare-d1-use-indexes /
 *              sqlite-fts5 / llms-txt / webmcp
 *
 * この枝の 7 件は、検索と AI からの見え方を運営者が自作で測ると決めた際に
 * 裏取りとして取った一次資料である（実績取り込み・AI 検索の引用確認・
 * D1 の索引と全文検索・機械可読な案内）。**どちらかを落として数を合わせない。**
 * 落とせば「食い違い 0 件」「版が取得日の行 0 件」が、見る対象を失った
 * だけで緑になる。件数ではなく名前で床を置いているのはそのためである。
 */
export const SOURCE_TARGET_FLOOR = {
  auth: ["better-auth"],
  backend: [
    "drizzle-orm",
    "anthropic-claude",
    "openai-platform",
    "google-gemini",
    "google-search-console-api",
    "anthropic-web-search-tool",
    "gemini-google-search-grounding",
  ],
  database: ["cloudflare-d1", "cloudflare-d1-use-indexes", "sqlite-fts5"],
  frontend: [
    "nextjs",
    "mdn-light-dark",
    "google-search-central",
    "schema-org",
    "web-dev-core-web-vitals",
    "llms-txt",
    "webmcp",
  ],
  infrastructure: ["cloudflare-workers", "cloudflare-for-saas", "cloudflare-r2", "cloudflare-r2-overview"],
  "maintenance-ops": ["google-sre", "vitest", "github-actions", "stryker-mutator"],
  security: ["owasp-asvs"],
  "ui-ux": ["apple-hig", "w3c-wai-aria"],
} as const;

export type SourceTarget = { target_id: string; category: string };

/** 章の読取結果を期待値に流用せず、独立した取得対象宣言を使う。 */
export function declaredSourceTargets(root: string): SourceTarget[] {
  const state = JSON.parse(readFileSync(join(root, "system-spec/spec-state.json"), "utf8")) as {
    targets: SourceTarget[];
  };
  return state.targets;
}

/** Set の件数比較だけでは見えない、同数での置換・重複・欠落を名指しする。 */
export function inventoryDelta(actual: readonly string[], expected: readonly string[]) {
  const counts = new Map<string, number>();
  for (const id of actual) counts.set(id, (counts.get(id) ?? 0) + 1);
  const wanted = new Set(expected);
  return {
    missing: [...wanted].filter((id) => !counts.has(id)).sort(),
    unexpected: [...counts.keys()].filter((id) => !wanted.has(id)).sort(),
    duplicate: [...counts].filter(([, count]) => count > 1).map(([id]) => id).sort(),
  };
}

export const EMPTY_INVENTORY_DELTA = { missing: [], unexpected: [], duplicate: [] };
