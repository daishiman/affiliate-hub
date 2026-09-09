/**
 * @tier 1
 * @req REQ-SEO09
 * @types decision-table, boundary, equivalence
 *
 * 観測した事実を規則へ照らして所見を出す純関数（受入 A2）。
 *
 * --- なぜ HTML を 1 行も書かないのか ---
 *
 * それがこのファイルの分け方そのものだから。`<img>` に alt が無いときに
 * 何が出るかを見るのに、HTML を組み立ててパーサを通す必要は無い。
 * ここで HTML を書き始めたら、**規則を確かめているつもりで
 * パーサを確かめている**ことになる。
 *
 * 実測（2026-09-08）で分岐 78.9%。埋まっていなかったのは
 * 「上限を越えた側」「canonical が別ページを指す」「OGP がずれる」
 * ——つまり**所見が出るはずの側**が多い。合っている入力ばかりを
 * 通していると、規則が緩んでも誰も気づかない。
 */
import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX_CHARS,
  DESCRIPTION_MIN_CHARS,
  TITLE_MAX_CHARS,
  TITLE_MIN_CHARS,
  auditPageObservation,
  type PageObservation,
} from "@/domain/seo/aeo-measurement/page-observation";
import { pageKeyOf } from "@/domain/seo/aeo-measurement/page-key";

const URL_SELF = "https://example.test/s/alpha/hello";
const OBSERVED_AT = "2026-09-08T17:00:00.000Z";

function keyOf(url: string) {
  const key = pageKeyOf(url);
  if (!key.ok) throw new Error(`鍵を作れない URL をテストに使っている: ${url}`);
  return key.key;
}

/** 所見が 1 件も出ない観測。ここから 1 項目ずつ崩す。 */
function clean(overrides: Partial<PageObservation> = {}): PageObservation {
  return {
    pageKey: keyOf(URL_SELF),
    url: URL_SELF,
    title: "あ".repeat(TITLE_MIN_CHARS),
    metaDescription: "い".repeat(DESCRIPTION_MIN_CHARS),
    canonical: URL_SELF,
    ogImage: "https://example.test/cover.webp",
    jsonLdTypes: ["BlogPosting"],
    headingLevels: [1, 2, 3, 2],
    internalLinkCount: 3,
    images: [{ src: "/a.webp", hasAlt: true, hasDimensions: true }],
    ...overrides,
  };
}

function codes(observation: PageObservation): readonly string[] {
  return auditPageObservation(observation, OBSERVED_AT).map((finding) => finding.code);
}

describe("合っているものを合格印として並べない", () => {
  it("すべて満たす観測は所見 0 件", () => {
    expect(auditPageObservation(clean(), OBSERVED_AT)).toEqual([]);
  });

  it("所見には観測時刻と出どころが必ず付く（あとから根拠を辿るため）", () => {
    const [finding] = auditPageObservation(clean({ title: null }), OBSERVED_AT);
    expect(finding).toMatchObject({
      source: "static_audit",
      pageKey: keyOf(URL_SELF),
      code: "missing_title",
      observedAt: OBSERVED_AT,
    });
  });
});

describe("題名", () => {
  it.each([
    ["null", null],
    ["空文字", ""],
    ["空白だけ", "   "],
  ])("%s は「無い」として扱う", (_label, title) => {
    expect(codes(clean({ title }))).toContain("missing_title");
  });

  it("下限に 1 字足りないと短すぎる、下限ちょうどは出ない", () => {
    expect(codes(clean({ title: "あ".repeat(TITLE_MIN_CHARS - 1) }))).toContain("title_too_short");
    expect(codes(clean({ title: "あ".repeat(TITLE_MIN_CHARS) }))).not.toContain("title_too_short");
  });

  it("上限を 1 字越えると長すぎる、上限ちょうどは出ない", () => {
    expect(codes(clean({ title: "あ".repeat(TITLE_MAX_CHARS + 1) }))).toContain("title_too_long");
    expect(codes(clean({ title: "あ".repeat(TITLE_MAX_CHARS) }))).not.toContain("title_too_long");
  });

  it("絵文字を 2 字として数えない（コードポイントで数える）", () => {
    // `.length` で数えると 2 字ぶんになり、下限ちょうどが「越えた」に見える。
    const title = `${"あ".repeat(TITLE_MAX_CHARS - 1)}🎈`;
    expect(codes(clean({ title }))).not.toContain("title_too_long");
  });
});

describe("説明文", () => {
  it("無ければ 1 件だけ出す（短すぎるとは重ねない）", () => {
    const found = codes(clean({ metaDescription: "  " }));
    expect(found).toContain("missing_meta_description");
    expect(found).not.toContain("meta_description_too_short");
  });

  it.each([
    [DESCRIPTION_MIN_CHARS - 1, "meta_description_too_short"],
    [DESCRIPTION_MAX_CHARS + 1, "meta_description_too_long"],
  ])("%i 字で %s", (length, code) => {
    expect(codes(clean({ metaDescription: "い".repeat(length) }))).toContain(code);
  });

  it("下限と上限のちょうどは、どちらの所見も出さない", () => {
    for (const length of [DESCRIPTION_MIN_CHARS, DESCRIPTION_MAX_CHARS]) {
      const found = codes(clean({ metaDescription: "い".repeat(length) }));
      expect(found).not.toContain("meta_description_too_short");
      expect(found).not.toContain("meta_description_too_long");
    }
  });
});

describe("canonical", () => {
  it("無ければ「無い」、別ページを指していれば「自身でない」", () => {
    expect(codes(clean({ canonical: null }))).toContain("missing_canonical");
    expect(codes(clean({ canonical: "https://example.test/s/alpha/other" })))
      .toContain("canonical_not_self");
  });

  it("相対で書かれていても、このページ自身なら所見にしない", () => {
    expect(codes(clean({ canonical: "/s/alpha/hello" }))).not.toContain("canonical_not_self");
  });

  it("URL として読めない値は「自身でない」に倒す（黙って通さない）", () => {
    expect(codes(clean({ canonical: "http://[" }))).toContain("canonical_not_self");
  });

  it("鍵を作れない仕組みの URL も「自身でない」に倒す", () => {
    expect(codes(clean({ canonical: "mailto:owner@example.test" })))
      .toContain("canonical_not_self");
  });
});

describe("OGP", () => {
  const og = {
    title: "あ".repeat(TITLE_MIN_CHARS),
    description: "い".repeat(DESCRIPTION_MIN_CHARS),
    type: "article",
    url: URL_SELF,
    image: "https://example.test/cover.webp",
  };

  it("観測そのものが無い旧い保存値では、OGP の所見を作らない", () => {
    const found = codes(clean());
    expect(found).not.toContain("missing_open_graph");
    expect(found).not.toContain("open_graph_mismatch");
  });

  it("4 項目が揃っていれば所見にしない（画像の欠落だけでは出さない）", () => {
    expect(codes(clean({ openGraph: { ...og, image: null } })))
      .not.toContain("missing_open_graph");
  });

  it("欠けた項目を名指しで並べる", () => {
    const findings = auditPageObservation(
      clean({ openGraph: { ...og, type: null, description: "  " } }),
      OBSERVED_AT,
    );
    const missing = findings.find((finding) => finding.code === "missing_open_graph");
    expect(missing?.detail).toBe("OGP の description / type がありません。");
  });

  it.each([
    ["題名がずれる", { title: "ぜんぜん違う題名です" }],
    ["説明がずれる", { description: "う".repeat(DESCRIPTION_MIN_CHARS) }],
    ["URL が別ページを指す", { url: "https://example.test/s/alpha/other" }],
    ["URL が読めない", { url: "http://[" }],
  ])("%s と、ずれとして 1 件出す", (_label, patch) => {
    expect(codes(clean({ openGraph: { ...og, ...patch } })))
      .toContain("open_graph_mismatch");
  });

  it("URL が空のときは、ずれではなく欠落として扱う", () => {
    const found = codes(clean({ openGraph: { ...og, url: "  " } }));
    expect(found).toContain("missing_open_graph");
    expect(found).not.toContain("open_graph_mismatch");
  });

  it("相対 URL でも、このページ自身ならずれにしない", () => {
    expect(codes(clean({ openGraph: { ...og, url: "/s/alpha/hello" } })))
      .not.toContain("open_graph_mismatch");
  });
});

describe("構造化データ", () => {
  it("読める JSON-LD が 1 つも無ければ所見にする", () => {
    expect(codes(clean({ jsonLdTypes: [] }))).toContain("missing_json_ld");
  });

  it("知らない型は素通りさせる（規則を持たない型に不足は言えない）", () => {
    expect(codes(clean({
      jsonLdTypes: ["Person"],
      jsonLdNodes: [{ types: ["Person"], properties: [], datePublished: null, dateModified: null }],
    }))).not.toContain("incomplete_structured_data");
  });

  it("必須 property の不足を型ごとに名指しする", () => {
    const findings = auditPageObservation(
      clean({
        jsonLdTypes: ["BreadcrumbList"],
        jsonLdNodes: [{
          types: ["BreadcrumbList"], properties: [], datePublished: null, dateModified: null,
        }],
      }),
      OBSERVED_AT,
    );
    expect(findings.find((finding) => finding.code === "incomplete_structured_data")?.detail)
      .toBe("BreadcrumbList の itemListElement がありません。");
  });

  it("BlogPosting の日付が画面のどこにも出ていなければ所見にする", () => {
    const node = {
      types: ["BlogPosting"],
      properties: [
        "headline", "inLanguage", "articleSection", "datePublished",
        "author", "publisher", "mainEntityOfPage",
      ],
      datePublished: "2026-09-01T00:00:00.000Z",
      dateModified: "2026-09-08T00:00:00.000Z",
    };
    const hidden = auditPageObservation(
      clean({ jsonLdNodes: [node], visibleDateTimes: ["2026-09-01"] }),
      OBSERVED_AT,
    );
    expect(hidden.filter((finding) => finding.code === "structured_data_date_not_visible"))
      .toHaveLength(1);

    // 日付だけ合っていればよい（時刻まで一致させると画面表記を縛る）。
    const shown = codes(clean({
      jsonLdNodes: [node],
      visibleDateTimes: ["2026-09-01T09:00+09:00", "2026-09-08"],
    }));
    expect(shown).not.toContain("structured_data_date_not_visible");
  });

  it("BlogPosting でない型に日付の一致は求めない", () => {
    expect(codes(clean({
      jsonLdTypes: ["FAQPage"],
      jsonLdNodes: [{
        types: ["FAQPage"], properties: ["mainEntity"],
        datePublished: "2026-09-01", dateModified: null,
      }],
    }))).not.toContain("structured_data_date_not_visible");
  });
});

describe("見出しと本文", () => {
  it("h1 が無い・2 つ以上あるをそれぞれ言い分ける", () => {
    expect(codes(clean({ headingLevels: [2, 3] }))).toContain("missing_h1");
    expect(codes(clean({ headingLevels: [1, 1] }))).toContain("multiple_h1");
  });

  it("段が 2 つ以上上がった最初の場所を指す", () => {
    const findings = auditPageObservation(clean({ headingLevels: [1, 3, 5] }), OBSERVED_AT);
    expect(findings.find((finding) => finding.code === "heading_level_skipped")?.detail)
      .toBe("h1 の次に h3 が来ています。");
  });

  it("段が下がるのは飛びではない（節が終わっただけ）", () => {
    expect(codes(clean({ headingLevels: [1, 2, 3, 2, 1] })))
      .not.toContain("heading_level_skipped");
  });

  it("見出しが 1 つだけなら飛びは判定しない", () => {
    expect(codes(clean({ headingLevels: [1] }))).not.toContain("heading_level_skipped");
  });

  it("内部リンクが 1 本も無ければ所見にする", () => {
    expect(codes(clean({ internalLinkCount: 0 }))).toContain("no_internal_links");
  });
});

describe("画像", () => {
  it("alt と width/height を別々に数え、例を 1 枚挙げる", () => {
    const findings = auditPageObservation(
      clean({
        images: [
          { src: "/a.webp", hasAlt: false, hasDimensions: true },
          { src: "/b.webp", hasAlt: false, hasDimensions: false },
        ],
      }),
      OBSERVED_AT,
    );
    expect(findings.find((finding) => finding.code === "missing_image_alt")?.detail)
      .toBe("alt の無い画像が 2 枚あります（例: /a.webp）。");
    expect(findings.find((finding) => finding.code === "missing_image_dimensions")?.detail)
      .toBe("width/height の無い画像が 1 枚あります（例: /b.webp）。");
  });

  it("画像が 1 枚も無いページに、画像の所見は出さない", () => {
    const found = codes(clean({ images: [] }));
    expect(found).not.toContain("missing_image_alt");
    expect(found).not.toContain("missing_image_dimensions");
  });
});
