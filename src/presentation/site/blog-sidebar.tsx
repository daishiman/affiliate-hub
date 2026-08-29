import type { BlogLayoutSlotRecord } from "@/application/ports/blog-ops";
import { brandTagCloud, slotHeading } from "@/domain/blogops";
import { ListView, Prose, Section, TextLink, proseParagraphs } from "@/presentation/ui";
import type { PublicSiteProjection } from "./public-site-projection";
import { siteHref } from "./view-model";

/**
 * 本文の脇に出る枠（§3.4）。
 *
 * **どの枠を、どの順で、出すか出さないかは管理画面が正本**（`/admin/blog/layout`）。
 * ここは保存された通りに描くだけで、既定の並びを持たない。持たせると、
 * 管理画面で消したのに消えない枠が生まれる。
 *
 * 中身の作り方は枠ごとに 3 通りある:
 *
 * 1. **保存された本文をそのまま出す**（運営者の紹介・おすすめなど）。
 * 2. **保存された HTML を出す**（`custom-html-slot-*`）。削るのは
 *    **保存の直前**で済んでいる（`domain/blogops/custom-html.ts`）。ここでもう一度
 *    削らないのは、描く場所が増えるたびに削り忘れが 1 か所ずつ増えるため。
 * 3. **いまのデータから作る**（ブランド・カテゴリー・探す）。
 *
 * 3 に当たらない枠を「まだ作っていない」と書かないのは、
 * **運営者が本文を入れれば出る**からで、空なのは未実装ではなく未記入である。
 */

export type SidebarCategory = {
  readonly slug: string;
  readonly name: string;
};

/** 枠 1 つ分の中身。出すものが無ければ `null`（見出しだけの箱を作らない）。 */
function slotBody(
  slot: BlogLayoutSlotRecord,
  siteSlug: string,
  categories: readonly SidebarCategory[],
  projection: PublicSiteProjection,
): React.ReactNode | null {
  if (slot.slotKey === "site-search") {
    return (
      <Prose>
        <TextLink href={siteHref(siteSlug, "/search")}>言葉を入れて探す</TextLink>
      </Prose>
    );
  }

  if (slot.slotKey === "nested-category-list") {
    if (categories.length === 0) return null;
    return (
      <ListView
        rows={categories.map((c) => ({
          key: c.slug,
          label: c.name,
          href: siteHref(siteSlug, `/categories/${c.slug}`),
        }))}
      />
    );
  }

  if (slot.slotKey === "brand-tag-cloud") {
    /*
      **ここも `brandTagCloud()` を通す。**枠の名前が「ブランド」と言っている以上、
      話題のタグが混じると枠そのものが嘘になる。絞る条件をこの場に `filter` で
      書かないのは、枠が増えた日に書き忘れても画面は正しく見え、
      **気づく機会が無い**ため（`domain/blogops/blog-tag.ts`）。
    */
    const brands = brandTagCloud(projection.tags, SIDEBAR_TAG_LIMIT);
    if (brands.length === 0) return null;
    return (
      <ListView
        rows={brands.map((t) => ({
          key: t.id,
          label: t.name,
          href: siteHref(siteSlug, `/search?tag=${encodeURIComponent(t.slug)}`),
        }))}
      />
    );
  }

  if (slot.slotKey === "custom-html-slot-upper" || slot.slotKey === "custom-html-slot-lower") {
    if (slot.body.trim() === "") return null;
    // biome-ignore lint/security/noDangerouslySetInnerHtml: 保存の直前に `sanitizeSlotHtml` を通した値だけがここに来る
    return <div dangerouslySetInnerHTML={{ __html: slot.body }} />;
  }

  const paragraphs = proseParagraphs(slot.body);
  if (paragraphs.length === 0) return null;
  return (
    <>
      {paragraphs.map((text) => (
        <Prose key={text}>{text}</Prose>
      ))}
    </>
  );
}

/**
 * 脇に出すブランドの件数。
 *
 * **上限をここに置く。**帯（`BlogTopBands`）は管理画面の `itemLimit` を使うが、
 * 枠には件数の設定が無い。無いものを 0 と読むと 1 件も出ないので、
 * 「脇に置いて読める長さ」をこの 1 か所で決める。
 */
const SIDEBAR_TAG_LIMIT = 12;

/**
 * 枠を描く。追従する枠かどうかは呼ぶ側（`region`）が決める。
 *
 * **JSX として `<BlogSidebar />` と置かず、関数として呼ぶ。**
 * 要素として置くと、中身が空でも「要素はある」ので `SiteShell` が段組みを出し、
 * 空の脇のぶんだけ本文が狭くなる。関数で呼べば `null` が呼ぶ側の手元に返り、
 * **描き始める前に段組みを出さない判断ができる。**名前を小文字にしてあるのは、
 * 次に読む人が JSX で置きたくならないようにするため。
 */
export function blogSidebar({
  siteSlug,
  region,
  projection,
  categories = [],
}: {
  readonly siteSlug: string;
  readonly region: "sidebar" | "sidebar_sticky";
  readonly projection: PublicSiteProjection;
  readonly categories?: readonly SidebarCategory[];
}) {
  const ordered = projection.slots
    .filter((s) => s.region === region && s.enabled)
    .sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;

  const drawn = ordered.map((slot) => ({
    slot,
    body: slotBody(slot, siteSlug, categories, projection),
  }));
  const shown = drawn.filter((d) => d.body !== null);
  if (shown.length === 0) return null;

  return (
    <>
      {shown.map(({ slot, body }) => (
        <Section key={slot.id} title={slotHeading(slot.slotKey, slot.title)}>
          {body}
        </Section>
      ))}
    </>
  );
}
