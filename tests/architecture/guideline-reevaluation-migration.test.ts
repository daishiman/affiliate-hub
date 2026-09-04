/**
 * @tier 1
 * @req REQ-SEO05
 * @types db-migration, regression
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * さがす手がかりに**番号を使わない。**
 *
 * ここは 2026-08-29 まで `0037_flimsy_hobgoblin.sql` と番号ごと名指ししていた。
 * その日に dev を取り込んだら 0036 が両側で埋まっていて、こちらの 2 本を
 * 1 つずつ後ろへずらすことになり、この検査だけが ENOENT で落ちた。
 *
 * 番号は**取り込むたびに動きうる**（誰が先に環境へ流したかで決まる）。
 * 一方、drizzle-kit が付ける後ろの語は動かない。動かないほうで引く。
 *
 * 見つからなければ投げる。名前で引く形は、外すと「0 件を検査する」に
 * 化けて全部緑になるので、化けた瞬間に赤くしておく。
 */
const DRIZZLE = join(process.cwd(), "drizzle");
const FILE = readdirSync(DRIZZLE).find((name) => name.endsWith("_flimsy_hobgoblin.sql"));
if (FILE === undefined) {
  throw new Error("drizzle/ に *_flimsy_hobgoblin.sql が見つかりません（改名か削除がありました）。");
}

const SQL = readFileSync(join(DRIZZLE, FILE), "utf8").replaceAll(/\s+/g, " ");

describe("指針の再評価完了版を足すforward-only migration", () => {
  it("既存列を落とさず、再評価済みの指紋と時刻を追加する", () => {
    expect(SQL).toContain("ADD `re_evaluated_sha256` text");
    expect(SQL).toContain("ADD `re_evaluated_at` text");
    expect(SQL).not.toMatch(/\bDROP\b/i);
  });

  it("初回取得か同一再取得の既存行だけをbaseline化し、変更済みの行は未ackで残す", () => {
    expect(SQL).toContain("`re_evaluated_sha256` = `source_sha256`");
    expect(SQL).toContain("`previous_source_sha256` IS NULL");
    expect(SQL).toContain("`previous_source_sha256` = `source_sha256`");
    expect(SQL).not.toContain("`previous_source_sha256` != `source_sha256`");
  });
});
