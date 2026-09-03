import { notFound, permanentRedirect } from "next/navigation";
import {
  type FixedPageKind,
  FIXED_PAGE_KINDS,
  FIXED_PAGE_PATH,
  LEGACY_FIXED_PAGE_REDIRECT_PATH,
} from "@/domain/blogops";
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
  if (kind === null) notFound();
  permanentRedirect(siteHref(site, LEGACY_FIXED_PAGE_REDIRECT_PATH[kind]));
}
