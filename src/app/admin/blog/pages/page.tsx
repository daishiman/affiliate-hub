import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 旧管理 URL を `SiteDocumentKey` 正本の画面へ寄せるだけの adapter。 */
export default async function BlogPagesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = (await searchParams).site;
  const siteSlug = Array.isArray(requested) ? requested[0]?.trim() : requested?.trim();
  if (siteSlug === undefined || siteSlug === "") {
    permanentRedirect("/admin/sites");
  }
  permanentRedirect(`/admin/sites/${encodeURIComponent(siteSlug)}/documents`);
}
