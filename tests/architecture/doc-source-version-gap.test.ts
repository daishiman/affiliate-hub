/**
 * @tier 1
 * @req REQ-TS14
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 「最新ドキュメント出典」の欄が、欄の名前どおりの値を持っているか。
 *
 * **2026-08-23、この検査は自分の解除条件どおりに赤くなった。**
 * 旧版は「塞げていないことの固定」で、解除条件をこう書いていた——
 * 「版が日付である章は 4 つ」が赤 → 本物の版が入った / 消さずに向きを反転させて残せ。
 * 外部取得が 8 件行われ（`system-spec/retrieval-evidence/`）、
 * `fetched-references.json` の 15 件全てが `freshness_source` を持つに至って、
 * 3 件が赤になった。以下はその指示に従って反転させたものである。
 *
 * ── 反転して分かったこと: 直ったのは片側だけである ──────────
 *
 * `fetched-references.json` は直った。**しかし章の md は追随していない。**
 * 同じ事実の写しが 2 箇所にあり、更新が片方で止まっている (2026-08-23 実測):
 *
 *   | 対象 | 章 md | fetched-references.json |
 *   | --- | --- | --- |
 *   | `better-auth` | `1.6.29` | `1.7.1` (publisher-registry) |
 *   | `owasp-asvs` | `5.0` | `5.0.0` (page-declared) |
 *   | `apple-hig` | `2026-08-16` ← **取得日のまま** | `2026-08-06` (http-last-modified) |
 *
 * 章側が正しくなった 4 件は `cloudflare-d1` `cloudflare-workers` `google-sre`
 * （取得日 → 公式表明の更新日）と `nextjs`（`16.3.1` → `16.3.2`）。
 * 版が取得日で埋まっている章は **4 つから 1 つ (`apple-hig`) へ減った**。
 * 全部直ったのではない。**部分的に直った状態を、部分的に直ったまま固定する。**
 *
 * 「最新確認」も同様に片側だけ動いた。8 章のうち独立に確かめ直されたのは
 * `nextjs` の 1 章だけで、残る 7 章は今も取得と同じ瞬間である。
 *
 * ── なぜ章 md を直さないか ──────────────────────────────
 *
 * `system-spec/` 配下は C01/C03 の単一 writer（根拠付き R4-reopen）経由でのみ
 * 変更してよい保護領域で、確定章ガードが直接の書き換えを遮断する。
 * **迂回して書かない。**検査側から乖離を見張るのが、この層で取れる正しい手である。
 *
 * ── 解除条件（次に赤くなる日） ──────────────────────────
 *
 *   - 「版が取得日である章は `apple-hig` だけ」が赤 → apple-hig に本物の版か更新日が入った
 *   - 「独立に確かめ直された章は `nextjs` だけ」が赤 → 他章も再確認された
 *   - 「章 md と fetched-references が食い違う 3 件」が赤 → 二重管理が解消した（か、増えた）
 *
 * どの赤でも**消さず、また向きを反転させて残すこと。**
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

/**
 * 版の欄が**取得した日そのもの**になっている、という判定。
 *
 * 旧版は `looksLikeDate` だけで誤りを数えていたが、それはもう使えない。
 * `cloudflare-d1=2026-04-30` のように、**版を公表しない対象が公式表明の更新日を
 * 版の欄に持つのは正しい状態**であり、日付であること自体は誤りではなくなった。
 * 誤りは「確かめた値が無いので取得日を書いた」ことだけである。
 */
function isRetrievalDate(row: Row): boolean {
  return looksLikeDate(row.version) && row.version.trim() === row.retrievedAt.slice(0, 10);
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

/** `fetched-references.json` 側の同じ対象の記録。章 md と突き合わせる相手。 */
type Reference = {
  target_id: string;
  version: string | null;
  last_updated: string | null;
  freshness_source: string | null;
};

function references(): Map<string, Reference> {
  const raw = readFileSync(join(ROOT, "system-spec/fetched-references.json"), "utf8");
  const parsed = JSON.parse(raw) as { references: Reference[] };
  return new Map(parsed.references.map((r) => [r.target_id, r]));
}

describe("最新ドキュメント出典の欄が欄名どおりの値を持っているか (部分的に直った状態の固定)", () => {
  const rows = Object.keys(CHAPTER_TARGETS).map(sourceRow);
  const refs = references();

  it("確定 8 章がそれぞれ出典を 1 本ずつ持っている（数える対象が消えていない）", () => {
    expect(rows.map((r) => [r.chapter, r.target])).toEqual(
      Object.entries(CHAPTER_TARGETS),
    );
  });

  it("版の欄が取得日そのものになっている章は apple-hig だけ——3 件は直った。戻れば赤くなる", () => {
    const selfDated = rows.filter(isRetrievalDate);
    expect(selfDated.map((r) => `${r.target}=${r.version}`)).toEqual([
      "apple-hig=2026-08-16",
    ]);
  });

  it("残る 7 章は版か、取得日ではない公式表明の更新日を持っている", () => {
    const sound = rows.filter((r) => !isRetrievalDate(r));
    expect(sound.map((r) => `${r.target}=${r.version}`)).toEqual([
      "better-auth=1.6.29",
      "drizzle-orm=0.45.2",
      "cloudflare-d1=2026-04-30",
      "nextjs=16.3.2",
      "cloudflare-workers=2026-04-23",
      "google-sre=2017",
      "owasp-asvs=5.0",
    ]);
  });

  it("独立に確かめ直された章は nextjs だけ——他章も再確認された日に赤くなる", () => {
    const independent = rows.filter(
      (r) => (Date.parse(r.confirmedAt) - Date.parse(r.retrievedAt)) / 1000 >= 60,
    );
    expect(independent.map((r) => r.target)).toEqual(["nextjs"]);
    for (const r of rows) {
      const delta = (Date.parse(r.confirmedAt) - Date.parse(r.retrievedAt)) / 1000;
      expect(delta, `${r.target} の 最新確認 − 取得 (秒)`).toBeGreaterThanOrEqual(0);
    }
  });

  it("全 15 出典が freshness_source を持つ（版・更新日の出所が空欄へ戻らない）", () => {
    const missing = [...refs.values()].filter((r) => !r.freshness_source);
    expect(missing.map((r) => r.target_id)).toEqual([]);
    expect(refs.size).toBe(15);
  });

  /**
   * 同じ事実が章 md と `fetched-references.json` の 2 箇所にある。
   * 2026-08-23 時点で片方だけが更新され、3 件が食い違っている。
   * **食い違いが減っても増えても赤くする**のがこの検査の役目である。
   */
  it("章 md と fetched-references の食い違いは既知の 3 件だけ", () => {
    const drifted: string[] = [];
    for (const row of rows) {
      const ref = refs.get(row.target);
      if (ref === undefined) throw new Error(`${row.target} が fetched-references に無い`);
      // 章のバージョン欄 1 つに対し、参照側は版と更新日の 2 欄を持つ。
      // 版を公表する対象は版を、公表しない対象は公式表明の更新日を、章が写すべき値とみなす。
      const expected = ref.version ?? ref.last_updated;
      if (row.version !== expected) {
        drifted.push(`${row.target}: 章=${row.version} / 参照=${expected}`);
      }
    }
    expect(drifted).toEqual([
      "better-auth: 章=1.6.29 / 参照=1.7.1",
      "owasp-asvs: 章=5.0 / 参照=5.0.0",
      "apple-hig: 章=2026-08-16 / 参照=2026-08-06",
    ]);
  });

  /**
   * 見つける側が効くことを、同じ検査の中で示す。
   * これが無いと上の「apple-hig だけ」は、**取得日だから 1 つなのか、
   * 判定が何も当たらずたまたま 1 つなのか**が区別できない。
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

    /**
     * `isRetrievalDate` は `looksLikeDate` より狭い。
     * **日付であること**と**取得日と同じであること**を取り違えると、
     * 版を公表しない対象の正しい更新日まで誤りとして数えてしまう。
     * その境目——同じ日付が、取得日と一致するかしないかだけで判定が割れること——を示す。
     */
    const at = (version: string, retrievedAt: string): Row => ({
      chapter: "x",
      target: "x",
      version,
      retrievedAt,
      confirmedAt: retrievedAt,
    });

    it("取得日と同じ日付は、取得日を版として書いたものとして数えられる", () => {
      expect(isRetrievalDate(at("2026-08-16", "2026-08-16T09:11:20Z"))).toBe(true);
    });

    it("同じ日付でも、取得日と違えば数えられない（公表された更新日を誤検出しない）", () => {
      expect(isRetrievalDate(at("2026-08-16", "2026-08-19T15:30:39Z"))).toBe(false);
      expect(isRetrievalDate(at("2026-04-30", "2026-08-19T15:30:39Z"))).toBe(false);
    });

    it("版番号は取得日と同じ日に取っていても数えられない", () => {
      expect(isRetrievalDate(at("5.0.0", "2026-08-16T09:11:19Z"))).toBe(false);
      expect(isRetrievalDate(at("2017", "2026-08-19T15:30:40Z"))).toBe(false);
    });
  });
});
