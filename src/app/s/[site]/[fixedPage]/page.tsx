import { notFound } from "next/navigation";
import {
  type FixedPageKind,
  FIXED_PAGE_KINDS,
  FIXED_PAGE_LABEL,
  FIXED_PAGE_PATH,
} from "@/domain/blogops";
import { PublicFixedPageContent } from "@/presentation/site/public-fixed-page";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref } from "@/presentation/site/view-model";

export const dynamic = "force-dynamic";

function kindForSegment(segment: string): FixedPageKind | null {
  return (
    FIXED_PAGE_KINDS.find((kind) => FIXED_PAGE_PATH[kind] === `/${segment}`) ?? null
  );
}

/** 8 種の固定ページを 1 つの route で描く。未知の名前は fail-closed。 */
export default async function FixedPage({
  params,
}: {
  params: Promise<{ site: string; fixedPage: string }>;
}) {
  const { site, fixedPage } = await params;
  const kind = kindForSegment(fixedPage);
  if (kind === null || kind === "contact") notFound();

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, FIXED_PAGE_PATH[kind])}
      trail={[{ label: FIXED_PAGE_LABEL[kind] }]}
      requiredFixedPageKind={kind}
    >
      {({ projection }) => {
        const page = projection.fixedPages.find((candidate) => candidate.kind === kind);
        if (page === undefined) return null;
        return <PublicFixedPageContent page={page} />;
      }}
    </SiteFrame>
  );
}
