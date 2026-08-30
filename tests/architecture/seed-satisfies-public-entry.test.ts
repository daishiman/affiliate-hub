/**
 * @tier 1
 * @req REQ-FD06
 * @types equivalence, boundary
 *
 * 見本データが、**読者側の入口が通る条件を全部満たしていること**。
 *
 * --- 何が起きたか（2026-08-30 実測）---
 *
 * `/s/<ブログ>` 以下を開くと、`page-frame.tsx` は骨格を描く前に
 * `readPublicSiteProjection` を呼び、`null` なら `notFound()` する。
 * その内側（`resolvePublicSiteIdentity`）が通るには **2 つの表が要る**——
 *
 *   1. `site_blueprints` にそのブログの設計図が在る
 *   2. `site_network_node` に同じ URL 名が `status='active'` で在る
 *
 * seed は **1 を 1 行も書いていなかった。** それでも開発機で画面が出ていたのは、
 * D1 に過去の別経路で入った行が残っていたからである。`pnpm db:migrate:local` から
 * 作り直せば表は空になり、記事も固定ページも版面も全部入っているのに
 * **`/s/` 以下が 1 枚残らず 404 になる。**
 *
 * さらに、子側の URL 名だけが手書きの `"gear-for-small-kitchen"` で、
 * 見本の 2 本目（`compact-kitchen-gear`）と食い違っていた。**設計図の無い
 * URL 名**へ固定ページ 8 枚と版面と記事を入れていたことになる。
 *
 * --- なぜこの形で見張るか ---
 *
 * 「`site_blueprints` への INSERT が在ること」だけを見ると、行が在りさえすれば
 * 緑になる。**入口が実際に要求している組**——設計図と網が同じ URL 名で揃っていること——
 * を見る。片方だけ在る状態は、画面から「まだ作っていないブログ」と区別が付かない。
 *
 * 隣の `seed-and-sample-agree.test.ts` は親ブログの URL 名しか突き合わせていない。
 * だから子側の食い違いを 1 度も止められなかった。ここでは **seed が名乗る
 * URL 名すべて**を見本と突き合わせる。
 */
import { describe, expect, it } from "vitest";
import {
  SEED_HUB_SLUG,
  SEED_SUB_SLUG,
  buildSeedSql,
  seedNetwork,
} from "../../scripts/seed/local-seed-data";
import { sampleSites } from "@/infrastructure/persistence/sample/site-sample-repository";

const STATEMENTS = buildSeedSql(1_756_000_000);

/** `INSERT INTO <表>` の文だけを拾う。 */
function insertsInto(table: string): string[] {
  return STATEMENTS.filter((sql) => new RegExp(`^\\s*INSERT INTO ${table}\\b`, "i").test(sql));
}

/** 設計図の INSERT が名乗る URL 名。値の並びは `(id, workspace_id, slug, ...)`。 */
function blueprintSlugs(): string[] {
  return insertsInto("site_blueprints")
    .map((sql) => /VALUES\s*\(\s*'[^']*',\s*'[^']*',\s*'([^']*)'/.exec(sql)?.[1] ?? "")
    .filter((slug) => slug !== "")
    .sort();
}

describe("見本データが読者側の入口を通ること", () => {
  it("設計図の行を書いている", () => {
    // 0 行なら `/s/` 以下は全滅する。**件数まで見る**——1 本だけ書いて
    // 緑になる形を作らない。
    const rows = insertsInto("site_blueprints");
    expect(rows.length, "site_blueprints へ 1 行も入れていません").toBeGreaterThan(0);
    expect(rows.length).toBe(sampleSites().length);
  });

  it("設計図の URL 名は見本と 1 つ残らず一致する", () => {
    // 写した値ではなく見本を指しているので、見本が変われば seed も変わる。
    // ここが赤くなるのは、**どちらかを写し直した日**である。
    expect(blueprintSlugs()).toEqual(
      sampleSites()
        .map((site) => site.slug)
        .sort(),
    );
  });

  it("網に載せる 2 本には、必ず設計図が在る", () => {
    // 入口が要求する組。網にだけ在るブログは、画面から
    // 「まだ作っていない」と区別が付かないまま 404 になる。
    const designed = new Set(blueprintSlugs());
    const orphans = seedNetwork()
      .filter((node) => !designed.has(node.siteSlug))
      .map((node) => node.siteSlug);
    expect(orphans, "設計図の無い URL 名を網に載せています").toEqual([]);
  });

  it("網の 2 本は active で、親を持たない中心が 1 本だけである", () => {
    // `status !== 'active'` でも入口は null を返す。**組の残り半分。**
    const nodes = seedNetwork();
    expect(nodes.every((n) => n.status === "active")).toBe(true);
    expect(nodes.filter((n) => n.parentSlug === null)).toHaveLength(1);
  });

  it("親子の URL 名は、どちらも見本の 1 本目・2 本目を指している", () => {
    // 定数を写すと、見本にブログを足した日や名前を変えた日に seed だけ古くなる。
    // そのとき vitest（見本の上で描く）は緑のまま、**本物の通信だけが 404** になる。
    const [first, second] = sampleSites();
    expect(SEED_HUB_SLUG).toBe(first.slug);
    expect(SEED_SUB_SLUG).toBe(second.slug);
  });

  it("固定ページを消す文が、URL 名を変えても取り残しを作らない", () => {
    // 2026-08-30: 子の URL 名を直したら、古い名前の行が消えずに残り、
    // id は同じなので次の INSERT が主キー衝突で落ちた。
    // **id の接頭辞で消している**ことをここで固定する。
    const deletes = STATEMENTS.filter((sql) => /^\s*DELETE FROM legal_page\b/i.test(sql));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain("lp_seed_");
  });
});
