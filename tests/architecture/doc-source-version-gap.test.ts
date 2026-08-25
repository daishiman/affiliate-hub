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
 * ── 2026-08-25、解除条件どおりに 4 つとも赤くなった ──────────
 *
 * 前版は「部分的に直った状態を、部分的に直ったまま固定する」ものだった。
 * 書き残した解除条件が 4 つとも当たったので、指示どおり**消さず向きを反転**させる。
 *
 * 何が起きたか。`system-spec/` を直接書けないので生成器を止めていたのだが、
 * C03 compile が既存の手書き行を消さずに済むようになり (接地根拠の描画・
 * 生成節の中の小節の引き継ぎ・保てなかった行の章末報告)、正本から章を
 * 導出し直せるようになった。**乖離の原因は二重管理そのものではなく、
 * 写し側を生成器で更新できずにいたことだった。**
 *
 *   | 対象 | 旧 (章 md) | 新 (章 md = fetched-references) |
 *   | --- | --- | --- |
 *   | `better-auth` | `1.6.29` | `1.7.1` |
 *   | `owasp-asvs` | `5.0` | `5.0.0` |
 *   | `apple-hig` | `2026-08-16` ← 取得日 | `2026-08-06` |
 *
 * ── 前提が 1 つ壊れた: 章は出典を 1 本ずつ持たない ────────────
 *
 * `maintenance-ops` の出典が 1 本から 4 本になった (google-sre / vitest /
 * github-actions / stryker-mutator)。これは退行ではない。CI/CD 品質ゲートの
 * 質疑を正本へ足したことで、章が引く出典が正しく増えた。
 * **旧版が固定していたのは事実ではなく、当時の形だった。**
 * 数える単位を「章」から「出典行」へ移す (8 章 = 11 行)。
 *
 * ── 解除条件（次に赤くなる日） ──────────────────────────
 *
 *   - 「食い違いは 0 件」が赤 → 写しが再び開いた。compile を当て直す
 *   - 「版が取得日である行は 0 件」が赤 → 確かめた値の無い出典が戻った
 *   - 「8 章 = 11 行」が赤 → 出典が増減した。増ならこの数を上げて残す
 *
 * どの赤でも**消さず、また向きを反転させて残すこと。**
 * 穴を見張る検査は、穴が塞がった日に役目を終えるのではない。
 * 塞がったものが再び開く道は、塞がる前から在る。
 */

const ROOT = process.cwd();

/**
 * 章 → その章が引く出典対象。**1 本とは限らない。**
 * `maintenance-ops` は CI/CD 品質ゲートの質疑を正本へ足したことで 4 本になった。
 */
const CHAPTER_TARGETS = {
  auth: ["better-auth"],
  backend: ["drizzle-orm"],
  database: ["cloudflare-d1"],
  frontend: ["nextjs"],
  infrastructure: ["cloudflare-workers"],
  "maintenance-ops": ["google-sre", "vitest", "github-actions", "stryker-mutator"],
  security: ["owasp-asvs"],
  "ui-ux": ["apple-hig"],
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

/** 「最新ドキュメント出典」表の本文行を全部取り出す。 */
function sourceRows(chapter: string): Row[] {
  const text = readFileSync(join(ROOT, `system-spec/${chapter}.md`), "utf8");
  const section = text.split(/^## /m).find((s) => s.startsWith("最新ドキュメント出典"));
  if (section === undefined) throw new Error(`${chapter}.md に最新ドキュメント出典が無い`);
  const rows = section
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-+/.test(line) && !/^\|\s*対象\s*\|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  if (rows.length === 0) throw new Error(`${chapter}.md の出典行が 0 本`);
  return rows.map(([target, version, , , retrievedAt, confirmedAt]) => ({
    chapter,
    target,
    version,
    retrievedAt,
    confirmedAt,
  }));
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

describe("最新ドキュメント出典の欄が欄名どおりの値を持っているか (塞がった状態の固定)", () => {
  const rows = Object.keys(CHAPTER_TARGETS).flatMap(sourceRows);
  const refs = references();

  it("確定 8 章が引く出典は合わせて 11 本で、対象も並びも正本どおり", () => {
    expect(rows.map((r) => [r.chapter, r.target])).toEqual(
      Object.entries(CHAPTER_TARGETS).flatMap(([chapter, targets]) =>
        targets.map((t) => [chapter, t]),
      ),
    );
  });

  it("版の欄が取得日そのものになっている行は 1 本も無い——戻れば赤くなる", () => {
    const selfDated = rows.filter(isRetrievalDate);
    expect(selfDated.map((r) => `${r.chapter}/${r.target}=${r.version}`)).toEqual([]);
  });

  it("11 本すべてが版か、取得日ではない公式表明の更新日を持っている", () => {
    expect(rows.map((r) => `${r.target}=${r.version}`)).toEqual([
      "better-auth=1.7.1",
      "drizzle-orm=0.45.2",
      "cloudflare-d1=2026-04-30",
      "nextjs=16.3.2",
      "cloudflare-workers=2026-04-23",
      "google-sre=2017",
      "vitest=2026-04-08",
      "github-actions=free-pro-team@latest",
      "stryker-mutator=10.0.0",
      "owasp-asvs=5.0.0",
      "apple-hig=2026-08-06",
    ]);
  });

  /**
   * 「最新確認」が取得と別の瞬間である＝取得したきり放置せず確かめ直した、という意味。
   * 2026-08-25 実測で 11 本中 4 本 (nextjs / stryker-mutator / owasp-asvs / apple-hig)。
   * 旧版は「nextjs だけ」と**同一性**で固定していたが、その形はもう無い。
   */
  it("取得と別の瞬間に確かめ直された出典が、達成済みの本数を下回らない", () => {
    const independent = rows.filter(
      (r) => (Date.parse(r.confirmedAt) - Date.parse(r.retrievedAt)) / 1000 >= 60,
    );
    // 下限で見張る。5 本目を確かめ直したという**良い変化で赤くしない**ため。
    expect(independent.length).toBeGreaterThanOrEqual(4);
    // ただし本数だけでは、確かめ直した出典が入れ替わっても気づけない。
    // 達成済みの顔ぶれは包含で残す (増えるのは自由、抜けたら赤)。
    const names = independent.map((r) => r.target);
    for (const target of ["nextjs", "stryker-mutator", "owasp-asvs", "apple-hig"]) {
      expect(names, `${target} の 最新確認 が取得と同じ瞬間へ戻っていないか`).toContain(target);
    }
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
   * 2026-08-23 は 3 件が食い違っていた。C03 compile を当てて 0 になった。
   * 写しは黙って古くなる。**再び開いた日に赤くする**のがこの検査の役目である。
   */
  it("章 md と fetched-references は 1 件も食い違わない", () => {
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
    expect(drifted).toEqual([]);
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
