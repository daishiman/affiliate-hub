import { notFound } from "next/navigation";
import type { SitePattern } from "@/domain/authoring/site-blueprint";
import { currentActor, platformUseCases } from "@/presentation/composition";

/**
 * site 配下の画面が、最初に必ず通る関門。
 *
 * **ワークスペースのデータを読む前に、ブログが引けるかを先に確かめる。**
 * 順番が逆だと、書き手や読者像はワークスペース単位で持っているので、
 * 存在しないブログの URL でも一覧が出てしまう。出てしまえば、
 * 「そのブログのもの」として読まれる。住所が嘘をつく状態である。
 *
 * 引けないときは `notFound()` を投げる。`getSite` は「無い」と
 * 「他のワークスペースのもの」を同じ `NOT_FOUND` で返すので、
 * ここで区別を足さない。足すと、他人のブログの存在が漏れる。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md §2.1
 */
export async function resolveSiteOrNotFound(siteSlug: string): Promise<{
  readonly siteSlug: string;
  readonly siteName: string;
  /** 書き方の重みを決めるのに要る (`cloneWritingMethodForSite`)。 */
  readonly pattern: SitePattern;
}> {
  const [actor, platform] = await Promise.all([currentActor(), platformUseCases()]);
  const result = await platform.getSite.execute(actor, { siteSlug });
  if (!result.ok) notFound();
  return {
    siteSlug,
    siteName: result.value.summary.name,
    pattern: result.value.summary.pattern,
  };
}
