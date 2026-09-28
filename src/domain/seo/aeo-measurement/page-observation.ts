/**
 * 公開 HTML から観測した事実と、そこから所見を導く規則（受入 A2）。
 *
 * ==========================================================================
 * 「HTML を読むこと」と「規則に照らすこと」を分ける
 * ==========================================================================
 *
 * HTML を解く手段は動く。いまは Workers の `HTMLRewriter` を使うが、
 * それは実行環境の都合であって、規則の話ではない。混ぜて書くと
 * **規則を確かめるテストが、毎回 HTML を書くことになる。**
 * `<img>` に alt が無いときどうなるかを見るのに、HTML を組み立てて
 * パーサを通す必要は無い。
 *
 * だからここは「観測した事実（`PageObservation`）」を受け取って
 * 所見を返す純関数だけを持つ。HTML を事実へ変える側はインフラにある。
 *
 * この分け方には別の効き目もある。系統①の所見は自動反映の根拠になれる
 * （NFR5）ので、**根拠を作る規則が読める形で 1 箇所にある**必要がある。
 */

import { type Finding, type FindingCode } from "./finding";
import { pageKeyOf, type PageKey } from "./page-key";

/** ページ内の画像 1 枚について観測したこと。 */
export type ObservedImage = {
  readonly src: string;
  readonly hasAlt: boolean;
  readonly hasDimensions: boolean;
};

/** OGP は画像を必須にせず、公開画面が常に生成する4項目を個別に観測する。 */
export type OpenGraphObservation = {
  readonly title: string | null;
  readonly description: string | null;
  readonly type: string | null;
  readonly url: string | null;
  /** 実在画像があるページだけ生成されるため、欠落だけでは所見にしない。 */
  readonly image: string | null;
};

/** JSON-LD 1 node の型と、検査に必要なpropertyだけを残した事実。 */
export type JsonLdNodeObservation = {
  readonly types: readonly string[];
  readonly properties: readonly string[];
  readonly datePublished: string | null;
  readonly dateModified: string | null;
};

/**
 * 1 ページを読んで分かったこと。**判断を含めない。**
 *
 * 「title が短すぎる」ではなく「title はこれ」を持つ。判断を混ぜると、
 * 規則を変えたときに観測をやり直す必要が出る。事実だけなら、
 * 保存しておいた観測へ新しい規則を当て直せる。
 */
export type PageObservation = {
  readonly pageKey: PageKey;
  readonly url: string;
  readonly title: string | null;
  readonly metaDescription: string | null;
  readonly canonical: string | null;
  readonly ogImage: string | null;
  /** JSON-LD の `@type` の一覧。読めなかった塊は入れない。 */
  readonly jsonLdTypes: readonly string[];
  /** 現れた順の見出しの段（h1 なら 1）。飛びの検出に順が要る。 */
  readonly headingLevels: readonly number[];
  /** 同じホストの中を指すリンクの数。 */
  readonly internalLinkCount: number;
  readonly images: readonly ObservedImage[];
  /** 新しいcollectorが返す構造化された事実。旧保存値との互換のため任意。 */
  readonly openGraph?: OpenGraphObservation;
  readonly jsonLdNodes?: readonly JsonLdNodeObservation[];
  readonly visibleDateTimes?: readonly string[];
  /** 自己・fragment・別origin・同host別site・閲覧者依存URLを除いた一意な行き先。 */
  readonly internalLinkPageKeys?: readonly PageKey[];
};

export const TITLE_MIN_CHARS = 10;
export const TITLE_MAX_CHARS = 60;
export const DESCRIPTION_MIN_CHARS = 50;
export const DESCRIPTION_MAX_CHARS = 160;

/**
 * 観測を規則へ照らして、所見を並べる。
 *
 * 空の配列を返すことがあり、それは「合っている」という意味である。
 * 合っていることを 1 件の所見として返さない —— 一覧が合格印で埋まると、
 * 直すべき件が埋もれる。
 */
export function auditPageObservation(
  observation: PageObservation,
  observedAt: string,
): readonly Finding[] {
  const findings: Finding[] = [];
  const add = (code: FindingCode, detail: string) => {
    findings.push({ source: "static_audit", pageKey: observation.pageKey, code, detail, observedAt });
  };

  const title = observation.title?.trim() ?? "";
  if (title === "") add("missing_title", "title が空です。");
  // 字数は書記素ではなくコードポイントで数える（`[...s]`）。
  // `s.length` だと絵文字や一部の漢字が 2 字として数えられる。
  else if ([...title].length < TITLE_MIN_CHARS) {
    add("title_too_short", `題名が ${[...title].length} 字です（下限 ${TITLE_MIN_CHARS} 字）。`);
  } else if ([...title].length > TITLE_MAX_CHARS) {
    add("title_too_long", `題名が ${[...title].length} 字あります（上限 ${TITLE_MAX_CHARS} 字）。`);
  }

  const description = observation.metaDescription?.trim() ?? "";
  if (description === "") add("missing_meta_description", "meta description がありません。");
  else {
    const length = [...description].length;
    if (length < DESCRIPTION_MIN_CHARS) {
      add("meta_description_too_short", `説明文が ${length} 字です（下限 ${DESCRIPTION_MIN_CHARS} 字）。`);
    } else if (length > DESCRIPTION_MAX_CHARS) {
      add("meta_description_too_long", `説明文が ${length} 字あります（上限 ${DESCRIPTION_MAX_CHARS} 字）。`);
    }
  }

  if ((observation.canonical?.trim() ?? "") === "") {
    add("missing_canonical", "link rel=canonical がありません。");
  } else {
    let canonical;
    try {
      canonical = pageKeyOf(new URL(observation.canonical!, observation.url).toString());
    } catch {
      canonical = { ok: false as const, reason: "unparsable" as const };
    }
    const self = pageKeyOf(observation.url);
    if (!canonical.ok || !self.ok || canonical.key !== self.key) {
      add("canonical_not_self", "canonical がこのページ自身の正規URLを指していません。");
    }
  }

  if (observation.openGraph !== undefined) {
    const missing = (["title", "description", "type", "url"] as const)
      .filter((property) => (observation.openGraph?.[property]?.trim() ?? "") === "");
    if (missing.length > 0) {
      add("missing_open_graph", `OGP の ${missing.join(" / ")} がありません。`);
    }
    const ogUrl = observation.openGraph.url?.trim();
    let ogUrlIsSelf = ogUrl === undefined || ogUrl === "";
    if (typeof ogUrl === "string" && ogUrl !== "") {
      try {
        const actual = pageKeyOf(new URL(ogUrl, observation.url).toString());
        const self = pageKeyOf(observation.url);
        ogUrlIsSelf = actual.ok && self.ok && actual.key === self.key;
      } catch { ogUrlIsSelf = false; }
    }
    const differs = [
      observation.openGraph.title !== null && observation.title !== null
        && observation.openGraph.title.trim() !== observation.title.trim(),
      observation.openGraph.description !== null && observation.metaDescription !== null
        && observation.openGraph.description.trim() !== observation.metaDescription.trim(),
      !ogUrlIsSelf,
    ].some(Boolean);
    if (differs) add("open_graph_mismatch", "OGP の題名・説明・URLが公開ページ自身の内容と一致していません。");
  }
  if (observation.jsonLdTypes.length === 0) {
    add("missing_json_ld", "読める JSON-LD がありません。");
  }
  if (observation.jsonLdNodes !== undefined) {
    auditStructuredData(observation, add);
  }

  const h1Count = observation.headingLevels.filter((level) => level === 1).length;
  if (h1Count === 0) add("missing_h1", "h1 がありません。");
  else if (h1Count > 1) add("multiple_h1", `h1 が ${h1Count} 個あります。`);

  const skipped = firstSkippedHeading(observation.headingLevels);
  if (skipped !== null) {
    add("heading_level_skipped", `h${skipped.from} の次に h${skipped.to} が来ています。`);
  }

  if (observation.internalLinkCount === 0) {
    add("no_internal_links", "同じブログの中を指すリンクが 1 本もありません。");
  }

  const withoutAlt = observation.images.filter((image) => !image.hasAlt);
  if (withoutAlt.length > 0) {
    add("missing_image_alt", `alt の無い画像が ${withoutAlt.length} 枚あります（例: ${withoutAlt[0]?.src ?? ""}）。`);
  }
  const withoutSize = observation.images.filter((image) => !image.hasDimensions);
  if (withoutSize.length > 0) {
    add(
      "missing_image_dimensions",
      `width/height の無い画像が ${withoutSize.length} 枚あります（例: ${withoutSize[0]?.src ?? ""}）。`,
    );
  }

  return findings;
}

const REQUIRED_JSON_LD_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  BlogPosting: ["headline", "inLanguage", "articleSection", "datePublished", "author", "publisher", "mainEntityOfPage"],
  BreadcrumbList: ["itemListElement"],
  ItemList: ["itemListElement"],
  FAQPage: ["mainEntity"],
  WebSite: ["name", "url", "potentialAction"],
};

function auditStructuredData(
  observation: PageObservation,
  add: (code: FindingCode, detail: string) => void,
): void {
  const nodes = observation.jsonLdNodes ?? [];
  for (const node of nodes) {
    for (const type of node.types) {
      const required = REQUIRED_JSON_LD_PROPERTIES[type];
      if (required === undefined) continue;
      const missing = required.filter((property) => !node.properties.includes(property));
      if (missing.length > 0) {
        add("incomplete_structured_data", `${type} の ${missing.join(" / ")} がありません。`);
      }
    }

    if (!node.types.includes("BlogPosting")) continue;
    const visible = new Set((observation.visibleDateTimes ?? []).map(datePart).filter(Boolean));
    for (const [label, value] of [["公開日", node.datePublished], ["更新日", node.dateModified]] as const) {
      if (value !== null && !visible.has(datePart(value))) {
        add("structured_data_date_not_visible", `${label} ${value} と一致する time[datetime] が画面にありません。`);
      }
    }
  }
}

function datePart(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.exec(value.trim())?.[0] ?? value.trim();
}

/**
 * 段が飛んでいる最初の場所。
 *
 * 「下がるとき」だけを見る。h3 の次に h2 が来るのは、節が終わって
 * 次の節に入っただけで飛びではない。上がるときに 2 段以上上がると、
 * 読み上げの目次で親の無い項目ができる。
 */
function firstSkippedHeading(levels: readonly number[]): { from: number; to: number } | null {
  for (let i = 1; i < levels.length; i += 1) {
    const from = levels[i - 1];
    const to = levels[i];
    if (from === undefined || to === undefined) continue;
    if (to > from + 1) return { from, to };
  }
  return null;
}
