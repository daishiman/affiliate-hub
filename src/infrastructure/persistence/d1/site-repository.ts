import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import type { SiteBlueprint } from "@/domain/authoring";
import { markEditorial, ok } from "@/domain/shared";
import { sampleSites } from "../sample/site-sample-repository";
import { listPublishedBlueprints } from "./site-draft-repository";
import type { DrizzleD1 } from "./link-inbox-repository";

/**
 * 読者向けブログの一覧（D1）。
 *
 * **見本の 3 本を消さない。** ウィザードで作ったブログを保存先へ載せても、
 * 見本は残したまま合わせて返す。消すと、まだ 1 本も作っていない状態で
 * 読者側の画面が全部空になり、「作っていない」のか「壊れている」のかを
 * 見分けられなくなる。見本には仮であることの表示が付いている。
 *
 * **同じ URL 名なら、作ったほうが勝つ。** 見本と同じ名前で作った人が、
 * 自分の作ったものを開けないのはおかしいため。
 */
type SiteEntry = { readonly slug: string; readonly blueprint: SiteBlueprint };

async function allSites(db: DrizzleD1): Promise<readonly SiteEntry[]> {
  const published = await listPublishedBlueprints(db);
  const takenSlugs = new Set(published.map((entry) => entry.slug));
  return [...published, ...sampleSites().filter((entry) => !takenSlugs.has(entry.slug))];
}

export function createD1SiteRepository(db: DrizzleD1): EditorialSiteRepositoryPort {
  return markEditorial({
    async findBySlug(slug: string) {
      return ok((await allSites(db)).find((entry) => entry.slug === slug)?.blueprint ?? null);
    },
    async list() {
      return ok(await allSites(db));
    },
  });
}
