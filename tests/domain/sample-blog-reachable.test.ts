/** @tier 1 @req REQ-BLOG01 */
/**
 * 見本のブログが「開ける」ことを、いちばん手前で固定する。
 *
 * 2026-08-31 に、見本のブログ 5 本が全部 404 になった。
 * 原因は import の輪である:
 *
 *   site-draft-sample → blog-ops-sample → site-sample → site-draft-sample
 *
 * 輪の中では、相手の module がまだ定数を数え終わっていない時点で読まれる。
 * `blog-ops-sample` の種データ（`NETWORK`）が `siteSlug: undefined` で組み上がり、
 * `resolveSamplePublicSiteIdentity` の「該当が 1 件でなければ通さない」に落ちて
 * `openSite` が `null` を返した。**例外は 1 つも出ない。**
 * 画面まで行って初めて 404 として現れる種類の壊れ方である。
 *
 * だからここは、画面も HTTP も通さず、読み口を直接呼んで確かめる。
 * 住所の正本は `sample-identity.ts`（保存先を持たない葉）に置いてあり、
 * 保存先どうしで貸し借りしないことがこの試験の前提である。
 */
import { describe, expect, it } from "vitest";
import {
  FIFTH_SITE_SLUG,
  FOURTH_SITE_SLUG,
  SAMPLE_SITE_SLUG,
  SECOND_SITE_SLUG,
  THIRD_SITE_SLUG,
  createSampleSiteRepository,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import { createSamplePublicBlogPort } from "@/infrastructure/persistence/sample/blog-ops-sample-repository";
import { readPublicSiteComposition } from "@/presentation/site/public-site-projection";

const 見本の住所 = [
  SAMPLE_SITE_SLUG,
  SECOND_SITE_SLUG,
  THIRD_SITE_SLUG,
  FOURTH_SITE_SLUG,
  FIFTH_SITE_SLUG,
];

describe("見本のブログは、読み口から開ける", () => {
  it("住所が 5 本とも文字列で、取り違えが無い", () => {
    // 輪ができると、ここが `undefined` になる。設計図の中身より先に効く検査。
    for (const slug of 見本の住所) {
      expect(typeof slug).toBe("string");
      expect(slug.length).toBeGreaterThan(0);
    }
    expect(new Set(見本の住所).size).toBe(見本の住所.length);
  });

  it("種データのブログは、住所を持ち、読み口が設計図を返す", async () => {
    const sites = createSampleSiteRepository();
    const port = createSamplePublicBlogPort(sites);

    for (const slug of [SAMPLE_SITE_SLUG, SECOND_SITE_SLUG]) {
      const opened = await port.openSite(slug);
      expect(opened.ok).toBe(true);
      if (!opened.ok) continue;
      // `null` は「そんなブログは無い」の意味で、画面では 404 になる。
      expect(opened.value).not.toBeNull();
      expect(opened.value?.blueprint.name.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("公開投影に住所と版面が置かれている", async () => {
    const result = await readPublicSiteComposition(SAMPLE_SITE_SLUG, {
      source: "sample",
      port: createSamplePublicBlogPort(createSampleSiteRepository()),
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value === null) return;
    const counts = result.value.counts;
    // ここが 0 だと、設計図はあるのに読者からは開けない状態である。
    expect(counts.network_node).toBeGreaterThan(0);
    expect(counts.layout_bands).toBeGreaterThan(0);
    expect(counts.layout_slots).toBeGreaterThan(0);
  });

  it("無い住所は `null` を返す（見本だからといって何でも開けない）", async () => {
    const port = createSamplePublicBlogPort(createSampleSiteRepository());
    const opened = await port.openSite("no-such-blog");
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.value).toBeNull();
  });
});
