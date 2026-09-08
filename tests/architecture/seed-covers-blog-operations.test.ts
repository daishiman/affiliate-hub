/**
 * @tier 1
 * @req REQ-FD06
 * @types equivalence, boundary
 *
 * 運営管理層の見本データが、**画面の分かれ目を全部作っていること**。
 *
 * --- なぜ要るか ---
 *
 * 住所・観測・改善の 3 層は、どれも「状態によって見え方が変わる」画面を持つ。
 * 発行済みの証明書しか入っていなければ、`expired` の行を描く実装が
 * 抜けていても画面は正しく見える。`open` の指摘しか無ければ、
 * 「見送った指摘を隠す」実装が動いていなくても一覧は正しく見える。
 *
 * 見本データが足りないときの症状は、画面が壊れることではなく、
 * **壊れていても気づかないこと**である。だから一覧側（domain の定数）を
 * 期待値に取り、種がそこに追いついているかを機械で見る。
 *
 * --- 二重に書き写さない ---
 *
 * 期待値は `@/domain/...` の定数から取る。ここに区分名を書き写すと、
 * 区分を 1 つ足した日に直す場所が 2 つになり、片方だけ古くなる。
 */

import { describe, expect, it } from "vitest";
import {
  ANSWER_UNIT_KINDS,
  AEO_GAP_KINDS,
} from "@/domain/aeo/answer-unit";
import {
  CERTIFICATE_STATUSES,
  CUSTOM_DOMAIN_STATUSES,
} from "@/domain/domains/custom-domain";
import {
  INTERACTION_KINDS,
  READER_SEGMENTS,
  VIEWPORT_BANDS,
} from "@/domain/analytics/reader-interaction";
import { ASSESSMENT_STATES, SEO_SEVERITIES } from "@/domain/seo/assessment";
import {
  OPERATIONS_SEED_TABLES,
  buildBlogOperationsSeedSql,
} from "../../scripts/seed/blog-operations-seed";

const NOW = Math.floor(new Date("2026-08-28T00:00:00.000Z").getTime() / 1000);
const SQL = buildBlogOperationsSeedSql({
  workspaceId: "ws_sample",
  nowSeconds: NOW,
  sites: [
    { siteSlug: "hub-site", articleSlugs: ["first-article", "second-article"] },
    { siteSlug: "sub-site", articleSlugs: ["third-article"] },
  ],
});
const TEXT = SQL.join("\n");

/** その表へ入れる文だけを取り出す。DELETE を数に入れない。 */
function insertsInto(table: string): readonly string[] {
  return SQL.filter((statement) => statement.startsWith(`INSERT INTO ${table} `));
}

describe("運営管理層の表が全部埋まる", () => {
  it("7 つの表すべてに、消す文と入れる文の両方がある", () => {
    for (const table of OPERATIONS_SEED_TABLES) {
      expect(TEXT, `${table} を消す文がありません`).toContain(`DELETE FROM ${table} `);
      expect(insertsInto(table).length, `${table} へ入れる文がありません`).toBeGreaterThan(0);
    }
  });

  it("入れる文はすべて workspace_id を書いている", () => {
    // 空の作業場所で入ると、どの画面からも見えない行が静かに増える。
    for (const statement of SQL) {
      if (!statement.startsWith("INSERT INTO ")) continue;
      expect(statement, `${statement.slice(0, 60)}… に workspace_id がありません`).toContain(
        "workspace_id",
      );
      expect(statement).toContain("'ws_sample'");
    }
  });
});

describe("住所の状態が全部そろっている", () => {
  it("住所の状態 5 種が全部ある", () => {
    for (const status of CUSTOM_DOMAIN_STATUSES) {
      expect(TEXT, `住所の状態 ${status} の行がありません`).toContain(`'${status}'`);
    }
  });

  it("証明書の状態 5 種が全部ある", () => {
    for (const status of CERTIFICATE_STATUSES) {
      expect(TEXT, `証明書の状態 ${status} の行がありません`).toContain(`'${status}'`);
    }
  });

  it("正規の住所は、ブログごとに多くて 1 つ", () => {
    /*
     * 索引 (`site_custom_domain_canonical_idx`) が `canonical=1 かつ active` を
     * 1 つに絞る。種が 2 つ作ると、当てた瞬間に一意制約で落ちる。
     * ここで見ておかないと、気づくのは `pnpm seed:local` の実行時になる。
     */
    const canonical = insertsInto("site_custom_domain").filter((s) => /, 1, /.test(s));
    expect(canonical.length).toBeLessThanOrEqual(1);
  });
});

describe("観測が、切り替えの意味が見える形で入っている", () => {
  it("行動の種類 5 種が全部ある", () => {
    for (const kind of INTERACTION_KINDS) {
      expect(TEXT, `行動 ${kind} の観測がありません`).toContain(`'${kind}'`);
    }
  });

  it("流入の区分 5 種が全部ある", () => {
    for (const segment of READER_SEGMENTS) {
      expect(TEXT, `流入 ${segment} の観測がありません`).toContain(`'${segment}'`);
    }
  });

  it("画面幅 3 種が全部ある（切り替えても同じ絵しか出ない、が起きていない）", () => {
    for (const band of VIEWPORT_BANDS) {
      expect(TEXT, `画面幅 ${band} の観測がありません`).toContain(`'${band}'`);
    }
  });

  it("読み進んだ深さが 1 人ごとに違う", () => {
    // 全員が同じ深さだと、到達率がどの区間でも同じ値になり、
    // 「記事のどこで離れているか」の画面が真っ平らのまま正しく見える。
    const ratios = new Set(TEXT.match(/, 0\.\d+, \d+, /g) ?? []);
    expect(ratios.size, "読み進んだ位置が 1 種類しかありません").toBeGreaterThan(3);
  });

  it("日次集計が、生の観測より後ろに来ている", () => {
    /*
     * 当てる順が逆だと、集計を入れた後で生を消すことになり、
     * 集計の元が無い状態が種の中に作れてしまう。
     */
    const events = SQL.findIndex((s) => s.startsWith("INSERT INTO reader_interaction_event "));
    const daily = SQL.findIndex((s) => s.startsWith("INSERT INTO site_daily_metric "));
    expect(events).toBeGreaterThanOrEqual(0);
    expect(daily).toBeGreaterThan(events);
  });
});

describe("ブログの合計と、記事の内訳が合う", () => {
  /**
   * 日次集計の INSERT から `(site_slug, day)` ごとの数値を取り出す。
   * 列の順は生成側の VALUES と同じなので、そこから位置で読む。
   */
  function dailyRows(table: "site_daily_metric" | "article_daily_metric"): readonly {
    siteSlug: string;
    day: string;
    views: number;
    clicks: number;
    conversions: number;
    revenueMinor: number;
  }[] {
    const isArticle = table === "article_daily_metric";
    return insertsInto(table).map((statement) => {
      const values = statement.slice(statement.indexOf("VALUES (") + "VALUES (".length);
      const cells = values.split(",").map((cell) => cell.trim());
      // site: ws, site, day, views, sessions, clicks, conversions, revenue, …
      // article: ws, site, article, day, views, sessions, clicks, conversions, revenue, …
      const base = isArticle ? 3 : 2;
      const unquote = (cell: string): string => cell.replace(/^'|'$/g, "");
      return {
        siteSlug: unquote(cells[1] ?? ""),
        day: unquote(cells[base] ?? ""),
        views: Number(cells[base + 1]),
        clicks: Number(cells[base + 3]),
        conversions: Number(cells[base + 4]),
        revenueMinor: Number(cells[base + 5]),
      };
    });
  }

  it("ブログの PV・クリック・成果・売上が、その日の記事の合計と一致する", () => {
    /*
     * 売上と成果は観測から導けない値で、ロールアップも売上の列に触れない。
     * つまりこの一致を守っている実装が**どこにも無い**。種が両側を別々に
     * 決めた瞬間に、画面の「ブログの売上」と記事一覧の合計が食い違う。
     * 実データで気づく前に、ここで止める。
     */
    const totals = new Map<string, { views: number; clicks: number; conversions: number; revenueMinor: number }>();
    for (const row of dailyRows("article_daily_metric")) {
      const key = `${row.siteSlug} ${row.day}`;
      const sum = totals.get(key) ?? { views: 0, clicks: 0, conversions: 0, revenueMinor: 0 };
      totals.set(key, {
        views: sum.views + row.views,
        clicks: sum.clicks + row.clicks,
        conversions: sum.conversions + row.conversions,
        revenueMinor: sum.revenueMinor + row.revenueMinor,
      });
    }

    const siteRows = dailyRows("site_daily_metric");
    expect(siteRows.length, "ブログの日次集計が 1 行もありません").toBeGreaterThan(0);
    for (const row of siteRows) {
      const key = `${row.siteSlug} ${row.day}`;
      expect(totals.get(key), `${key} に対応する記事の行がありません`).toEqual({
        views: row.views,
        clicks: row.clicks,
        conversions: row.conversions,
        revenueMinor: row.revenueMinor,
      });
    }
  });
});

describe("改善層が、判断の分かれ目を作っている", () => {
  it("指摘の重さ 3 種が全部ある", () => {
    for (const severity of SEO_SEVERITIES) {
      expect(TEXT, `重さ ${severity} の指摘がありません`).toContain(`'${severity}'`);
    }
  });

  it("指摘の状態 4 種が全部ある", () => {
    for (const state of ASSESSMENT_STATES) {
      expect(TEXT, `状態 ${state} の指摘がありません`).toContain(`'${state}'`);
    }
  });

  it("根拠のない指摘が 1 件も無い", () => {
    // `evidence` は非 null。空文字で入れれば SQL は通るが、
    // 「根拠のない提案を作れない」という表の狙いは死ぬ。
    for (const statement of insertsInto("article_seo_assessment")) {
      expect(statement, "根拠が空の指摘があります").not.toContain(", '', ");
    }
  });

  it("引用単位の型 5 種が全部ある", () => {
    for (const kind of ANSWER_UNIT_KINDS) {
      expect(TEXT, `引用単位 ${kind} がありません`).toContain(`'${kind}'`);
    }
  });

  it("不足が見つかる単位と、見つからない単位の両方がある", () => {
    /*
     * 不足は `detectGaps` に出させている（手で書いていない）。だから
     * ここで見ているのは「種の値が診断を通ったときに、両側へ分かれるか」で、
     * 診断そのものの正しさは domain のテストが見る。
     */
    const gapLists = insertsInto("article_answer_unit").map(
      (s) => s.match(/'(\[[^']*\])'/)?.[1] ?? "[]",
    );
    expect(gapLists.some((g) => g === "[]"), "不足の無い単位がありません").toBe(true);
    expect(gapLists.some((g) => g !== "[]"), "不足のある単位がありません").toBe(true);
    for (const list of gapLists) {
      for (const gap of JSON.parse(list) as string[]) {
        expect(AEO_GAP_KINDS as readonly string[], `知らない不足 ${gap} が入りました`).toContain(
          gap,
        );
      }
    }
  });
});

describe("同じものを 2 度当てても増えない", () => {
  it("同じ時刻で 2 度作ると、同じ SQL になる", () => {
    const again = buildBlogOperationsSeedSql({
      workspaceId: "ws_sample",
      nowSeconds: NOW,
      sites: [
        { siteSlug: "hub-site", articleSlugs: ["first-article", "second-article"] },
        { siteSlug: "sub-site", articleSlugs: ["third-article"] },
      ],
    });
    // 乱数で作ると、当て直すたびに画面の数字が変わり、
    // 「実装を直したから変わったのか」を画面から判断できなくなる。
    expect(again.join("\n")).toBe(TEXT);
  });
});
