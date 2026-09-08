import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 2026-09-06 に実在を照合した出典の床。件数ではなく同一性を保持する。
 * 22 件目の cloudflare-r2-overview は R2 一次資料の別ページであり、
 * cloudflare-r2 と同じものとして畳まない。追加対象は targets[] から全件測る。
 */
export const SOURCE_TARGET_FLOOR = {
  auth: ["better-auth"],
  backend: ["drizzle-orm", "anthropic-claude", "openai-platform", "google-gemini"],
  database: ["cloudflare-d1"],
  frontend: ["nextjs", "mdn-light-dark", "google-search-central", "schema-org", "web-dev-core-web-vitals"],
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
