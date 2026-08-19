/**
 * @tier 1
 * @req REQ-TS14
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 「最新ドキュメント出典」の欄が、欄の名前どおりの値を持っていない。
 *
 * **これは塞ぐ課題ではなく、塞げていないことを検査として固定する課題である。**
 * `ah-a4c`（取得済みドキュメントの version と last_updated が公式表明値になっていない）
 * の当てどころ。`ah-ejn` と同じ壁——**外部取得を行わないと決めた**——で止まっており、
 * 取りに行けない以上、値を正しくできない。
 *
 * いま何が起きているか (2026-08-19 実測):
 *
 *   1. **バージョン欄が取得日で埋まっている章が 4 つある。**
 *      `cloudflare-d1` / `cloudflare-workers` / `google-sre` / `apple-hig` は
 *      版番号を公表していないため、生成側が**取得日 `2026-08-16` を版として書いた**。
 *      日付は版ではない。欄は埋まっているが、埋めている値が意味しているものが違う。
 *      （`qa_log` の `source.sha256` が `answer` の指紋だった件と同じ族。`ah-84i`）
 *
 *   2. **「最新確認」が独立した再確認になっていない。**
 *      8 件とも「取得」との差が 1 分未満（17〜25 秒）で、
 *      同じ 1 回の取得の中で書かれている。「最新確認」という欄名は
 *      「あとで確かめ直した日」を約束するが、実際には取得と同じ瞬間である。
 *      **古くなっても、この欄は古く見えない。**
 *
 * なぜ塞げないか: 公式の表明値（版・更新日）を得るには外部取得が要る。
 * 利用者が外部取得を行わないと決めたため、取りに行かない。
 * **私が打たないだけでなく、他のセッションに取ってもらう形も取らない**
 * （境目は道具ではなく目的。残課題 78 ⑲）。
 * 確かめずに版番号を書けばこの検査は緑になるが、それは
 * **いま在る誤りを、より見えにくい誤りに置き換えるだけ**である。
 *
 * ── 解除条件 ────────────────────────────────────────────
 *
 * 何が手に入れば直せるか: **各出典の公式表明値（版または最終更新日）を、
 * 取得証跡つきで持つこと。**
 *
 * **この検査が赤くなった日が、解除してよい日である。**赤くなる道は 2 つある。
 *
 *   - 「版が日付である章は 4 つ」が赤 → **本物の版が入った**
 *   - 「最新確認は取得と同じ実行」が赤 → **独立した再確認が行われた**
 *
 * どちらでも、この検査ごと向きを反転させて残すこと
 * （「日付である章が 4 つ」→「全 8 章が版を持つ」、
 *   「差が 1 分未満」→「差が取得日より後」）。
 * **消してはならない。**消すと、正しくなった値が後で取得日へ戻っても誰も気づかない。
 * 穴を見張る検査は、穴が塞がった日に役目を終えるのではない。
 * 塞がったものが再び開く道は、塞がる前から在る。
 */

const ROOT = process.cwd();

/** 章 → その章が持つ唯一の出典対象。 */
const CHAPTER_TARGETS = {
  auth: "better-auth",
  backend: "drizzle-orm",
  database: "cloudflare-d1",
  frontend: "nextjs",
  infrastructure: "cloudflare-workers",
  "maintenance-ops": "google-sre",
  security: "owasp-asvs",
  "ui-ux": "apple-hig",
} as const;

/** 版番号ではなく日付が書かれている、という判定。`1.6.29` を日付と読まないこと。 */
function looksLikeDate(version: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(version.trim());
}

type Row = {
  chapter: string;
  target: string;
  version: string;
  retrievedAt: string;
  confirmedAt: string;
};

/** 「最新ドキュメント出典」表の本文行を 1 本だけ取り出す。 */
function sourceRow(chapter: string): Row {
  const text = readFileSync(join(ROOT, `system-spec/${chapter}.md`), "utf8");
  const section = text.split(/^## /m).find((s) => s.startsWith("最新ドキュメント出典"));
  if (section === undefined) throw new Error(`${chapter}.md に最新ドキュメント出典が無い`);
  const rows = section
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-+/.test(line) && !/^\|\s*対象\s*\|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  if (rows.length !== 1) throw new Error(`${chapter}.md の出典行が ${rows.length} 本`);
  const [target, version, , , retrievedAt, confirmedAt] = rows[0];
  return { chapter, target, version, retrievedAt, confirmedAt };
}

describe("最新ドキュメント出典の欄が欄名どおりの値を持っていない (塞げていないことの固定)", () => {
  const rows = Object.keys(CHAPTER_TARGETS).map(sourceRow);

  it("確定 8 章がそれぞれ出典を 1 本ずつ持っている（数える対象が消えていない）", () => {
    expect(rows.map((r) => [r.chapter, r.target])).toEqual(
      Object.entries(CHAPTER_TARGETS),
    );
  });

  it("版が取得日で埋まっている章は 4 つ——本物の版が入った日にこの検査が赤くなる", () => {
    const dated = rows.filter((r) => looksLikeDate(r.version));
    expect(dated.map((r) => `${r.target}=${r.version}`)).toEqual([
      "cloudflare-d1=2026-08-16",
      "cloudflare-workers=2026-08-16",
      "google-sre=2026-08-16",
      "apple-hig=2026-08-16",
    ]);
  });

  it("残る 4 章は本物の版を持っている（欄が全部壊れているわけではない）", () => {
    const versioned = rows.filter((r) => !looksLikeDate(r.version));
    expect(versioned.map((r) => `${r.target}=${r.version}`)).toEqual([
      "better-auth=1.6.29",
      "drizzle-orm=0.45.2",
      "nextjs=16.3.1",
      "owasp-asvs=5.0",
    ]);
  });

  it("「最新確認」は取得と同じ実行の中にある（差が 1 分未満）——独立に確かめ直した日に赤くなる", () => {
    for (const r of rows) {
      const delta =
        (Date.parse(r.confirmedAt) - Date.parse(r.retrievedAt)) / 1000;
      expect(delta, `${r.target} の 最新確認 − 取得 (秒)`).toBeGreaterThanOrEqual(0);
      expect(delta, `${r.target} の 最新確認 − 取得 (秒)`).toBeLessThan(60);
    }
  });

  /**
   * 見つける側が効くことを、同じ検査の中で示す。
   * これが無いと上の「4 つ」は、**日付だから 4 つなのか、
   * 判定が何も当たらずたまたま 4 つなのか**が区別できない。
   */
  describe("見つける側が効いていること", () => {
    it.each(["2026-08-16", "2020-01-01"])("%s は日付として数えられる", (v) => {
      expect(looksLikeDate(v)).toBe(true);
    });

    it.each(["1.6.29", "0.45.2", "16.3.1", "5.0", "v2026-08-16", "2026-08"])(
      "%s は日付として数えられない",
      (v) => {
        expect(looksLikeDate(v)).toBe(false);
      },
    );
  });
});
