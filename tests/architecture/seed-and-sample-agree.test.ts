/**
 * @tier 1
 * @req REQ-FD06
 * @types code-boundary
 *
 * 見本（D1 が無いときの代役）と seed（開発機の D1 に入れる本物）が、
 * **同じ世界を語っていること**。
 *
 * --- なぜ要るか ---
 *
 * 画面を開く検査は 2 通りある。vitest は見本の上で描き、Playwright は
 * seed 済みの D1 を本物の通信で開く。同じ URL を両方が使うのに、
 * その URL に入れる値の出どころが別々だと、**片方だけが 404 になる**。
 *
 * 2026-08-26 に実測した。`/s/<ブログ>/blog/starter-kit-2026` は
 * 見本に在って seed に無く、vitest は緑・E2E は 404 だった。しかもその E2E は
 * 別の理由（`tests/e2e/source-registries.ts` の構文木読み）で収集の時点から
 * 落ちていたので、**404 は誰にも見えていなかった**。
 *
 * --- ここで見ないこと ---
 *
 * 記事の本数も、題名も、部品の並びも見ない。見本と seed は役割が違うので、
 * 中身まで同じである必要はない。**URL に出る名前だけ**を揃える。
 */

import { describe, expect, it } from "vitest";
import { buildSeedSql } from "../../scripts/seed/local-seed-data";
import { BLOG_OPS_SAMPLE_ROUTE_IDS } from "@/infrastructure/persistence/sample/blog-ops-sample-repository";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";

const SQL = buildSeedSql(Math.floor(new Date("2026-08-26T00:00:00.000Z").getTime() / 1000)).join(
  "\n",
);

describe("見本と seed が同じ URL で開ける", () => {
  it("seed を読めている", () => {
    // 中身が変わっても壊れない下限。0 行や空文字だけを弾く。
    expect(SQL.length, "seed の SQL が空です").toBeGreaterThan(1000);
    expect(SQL, "canonical articles を 1 行も入れていません").toContain(
      "INSERT INTO articles ",
    );
    expect(SQL, "ブログ記事型が canonical 列へ入っていません").toContain(
      "article_template",
    );
  });

  it("読者側の記事 1 枚を開く URL 名が seed にも在る", () => {
    expect(
      SQL.includes(`'${BLOG_OPS_SAMPLE_ROUTE_IDS.articleSlug}'`),
      `seed に URL 名 ${BLOG_OPS_SAMPLE_ROUTE_IDS.articleSlug} の記事がありません。` +
        "tests/ui/route-cases.ts がこの名前で /s/[site]/blog/[article] を開くので、" +
        "無いと E2E だけが 404 になります",
    ).toBe(true);
  });

  it("運営側の記事 1 枚を開く識別子が seed にも在る", () => {
    expect(
      SQL.includes(`'${BLOG_OPS_SAMPLE_ROUTE_IDS.article}'`),
      `seed に id ${BLOG_OPS_SAMPLE_ROUTE_IDS.article} の記事がありません。` +
        "tests/ui/route-cases.ts がこの id で /admin/blog/articles/[article] を開きます",
    ).toBe(true);
  });

  it("ブログの URL 名が見本と seed で一致している", () => {
    expect(
      SQL.includes(`'${SAMPLE_SITE_SLUG}'`),
      `seed のブログ名が見本の ${SAMPLE_SITE_SLUG} と違います。` +
        "違うと /s/<名前> 以下の 22 枚すべてが本物の通信で 404 になります",
    ).toBe(true);
  });
});
