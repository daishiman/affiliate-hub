/**
 * @tier 1
 * @req REQ-UX02, REQ-BOPS10
 * @types equivalence, boundary
 *
 * 記事とサイトで「適合・配信・鮮度」の読ませ方を揃える部品。
 *
 * --- なぜ画面の総当たりでは足りないのか ---
 *
 * 総当たりは既定の URL しか開かない。絞り込みと並び順は**クエリで作る状態**で、
 * 既定（`all` / `attention`）以外の枝は一度も通らない。実測（2026-08-27）で
 * このファイルの分岐は 0.0% だった。
 *
 * ここで見るのは 2 つ。
 *
 * 1. **手で URL を書き換えられても落とさない。**知らない値は既定へ寄せる。
 *    ここが素通りだと、`?health=ぜんぶ` が型の上でだけ正しい別物として
 *    絞り込みの式へ入る。
 * 2. **絞っていることが文で出る。**絞った状態のまま別の日に開いた人が、
 *    件数が少ない理由を「データが無い」と読まないための 1 文である。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  OperationalHealthControls,
  OperationalHealthView,
  parseOperationalHealthQuery,
} from "@/presentation/admin/operational-health-view";

describe("URL から絞り込みを読む", () => {
  it("既定は「すべて」と「要確認が先」", () => {
    expect(parseOperationalHealthQuery({})).toEqual({ health: "all", sort: "attention" });
  });

  it("知っている値はそのまま通す", () => {
    expect(parseOperationalHealthQuery({ health: "attention", sort: "freshness" })).toEqual({
      health: "attention",
      sort: "freshness",
    });
    expect(parseOperationalHealthQuery({ health: "healthy", sort: "name" })).toEqual({
      health: "healthy",
      sort: "name",
    });
  });

  it("知らない値は落とさず既定へ寄せる", () => {
    // 手で URL を書き換えられても、絞り込みを無視して全件を出す。
    expect(parseOperationalHealthQuery({ health: "ぜんぶ", sort: "てきとう" })).toEqual({
      health: "all",
      sort: "attention",
    });
  });

  it("同じ名前が 2 つ来たとき（配列）も既定へ寄せる", () => {
    expect(parseOperationalHealthQuery({ health: ["attention", "healthy"] })).toEqual({
      health: "all",
      sort: "attention",
    });
  });
});

describe("絞っていることを文で出す", () => {
  function summaryOf(query: { health: string; sort: string }): string {
    return renderToStaticMarkup(
      <OperationalHealthControls
        action="/admin/blog/evaluate"
        query={query as never}
      />,
    );
  }

  it("既定のままなら、絞り込みの文は出さない", () => {
    // 何も絞っていないのに「絞っています」と読める文が常に出ていると、
    // 本当に絞った日にその文が目に入らない。
    expect(summaryOf({ health: "all", sort: "attention" })).not.toContain("健全性:");
  });

  it("状態で絞ったら、何で絞ったかを書く", () => {
    expect(summaryOf({ health: "attention", sort: "attention" })).toContain(
      "健全性: 要確認、並び: 要確認が先",
    );
    expect(summaryOf({ health: "healthy", sort: "attention" })).toContain("健全性: 健全");
  });

  it("並び順だけを変えたときも書く", () => {
    expect(summaryOf({ health: "all", sort: "freshness" })).toContain(
      "健全性: すべて、並び: 鮮度の低い順",
    );
    expect(summaryOf({ health: "all", sort: "name" })).toContain("並び: 名前順");
  });

  it("持ち回る値（どのブログか）を渡せる", () => {
    const html = renderToStaticMarkup(
      <OperationalHealthControls
        action="/admin/blog/evaluate"
        keep={{ site: "owned-blog" }}
        query={{ health: "attention", sort: "name" }}
      />,
    );

    // 絞り直したときに、どのブログを見ていたかが消えると最初からやり直しになる。
    expect(html).toContain("owned-blog");
  });
});

describe("3 つの見どころを 1 つの読み上げにまとめる", () => {
  it("目で読む文と、読み上げに渡す名前が同じことを言う", () => {
    const html = renderToStaticMarkup(
      <OperationalHealthView
        health={{ compliance: "attention", delivery: "unchecked", freshness: "stale" }}
      />,
    );

    // 3 つを別々の要素にすると、読み上げは「要確認」を 3 回読んで
    // どれのことか分からなくなる。1 つの名前にまとめる。
    expect(html).toContain('aria-label="適合: 要確認、配信: 未点検、鮮度: ');
    expect(html).toContain("適合 要確認");
    expect(html).toContain("配信 未点検");
  });

  it("記事が 1 本も無いサイトは、鮮度を「記事なし」と言う", () => {
    const html = renderToStaticMarkup(
      <OperationalHealthView
        health={{ compliance: "healthy", delivery: "healthy", freshness: "unknown" }}
      />,
    );

    // 「古い」と言うと、直しようのない指摘になる。
    expect(html).toContain("鮮度 記事なし");
  });
});
