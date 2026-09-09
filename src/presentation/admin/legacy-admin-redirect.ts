import { cookies } from "next/headers";
import { currentActor, platformUseCases } from "@/presentation/composition";
import {
  type LegacyQuery,
  SITE_PICKER_PATH,
  resolveSiteSlug,
  siteScopedRedirectTarget,
} from "./site-scoped-redirect";

/**
 * 旧 URL の殻から呼ぶ、副作用のある側の入口。
 *
 * cookie とワークスペースのブログ一覧を読み、規則そのものは
 * `site-scoped-redirect.ts` の純粋関数へ渡す。
 * ここに条件分岐を書かない。書くと、5 本の殻それぞれで規則がずれる。
 */

/** 直近に開いていたブログを覚えている cookie。 */
export const LAST_SITE_COOKIE = "ah_last_site";

export async function legacyAdminRedirect(
  legacyPath: string,
  query: LegacyQuery = {},
): Promise<string> {
  const [jar, actor, uc] = await Promise.all([
    cookies(),
    currentActor(),
    platformUseCases(),
  ]);

  const listed = await uc.listSites.execute(actor, {});
  /*
    一覧が引けなかったときも例外にしない。ここは転送の途中であって、
    利用者は「読者像を見たい」と言っただけである。決められないなら
    ブログ選択へ出す (A3)。エラー画面を出すと、何をすればいいか分からない。
  */
  const siteSlugs = listed.ok ? listed.value.items.map((site) => site.slug) : [];

  const querySite = query.site;
  const siteSlug = resolveSiteSlug({
    querySite: typeof querySite === "string" ? querySite : null,
    cookieSite: jar.get(LAST_SITE_COOKIE)?.value ?? null,
    siteSlugs,
  });

  return siteScopedRedirectTarget(legacyPath, siteSlug, query) ?? SITE_PICKER_PATH;
}
