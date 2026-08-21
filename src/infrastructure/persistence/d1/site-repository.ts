import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import type { SiteBlueprint } from "@/domain/authoring";
import { markEditorial, ok } from "@/domain/shared";
import { sampleSites } from "../sample/site-sample-repository";
import { listPublishedBlueprints } from "./site-draft-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

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

/**
 * 保存先が落ちたときは、**例外を上へ通さず断りとして返す。**
 *
 * ここだけ try が無く、2026-08-21 に本番の入口が 500 になった。
 * 原因はマイグレーションの当て忘れ（`site_blueprints` が無い）で、
 * drizzle の投げた例外がそのまま画面まで抜けた。
 *
 * 呼び出し側（`page.tsx`）は `result.ok === false` を受け取れば
 * 「一覧を取れませんでした」と出す作りになっていたのに、この経路だけ
 * そこへ落ちなかった。**素の 500 は、利用者に何も伝えないうえ、
 * 手がかりが実行ログにしか残らない。**
 *
 * 見本へ黙って落とす選択はしない。それをすると、保存したものが消えたのか
 * 保存先が落ちているのかを、画面から見分けられなくなる。
 */
export function createD1SiteRepository(db: DrizzleD1): EditorialSiteRepositoryPort {
  return markEditorial({
    async findBySlug(slug: string) {
      try {
        return ok((await allSites(db)).find((entry) => entry.slug === slug)?.blueprint ?? null);
      } catch (cause) {
        return storageFailure("ブログの読み出し", cause);
      }
    },
    async list() {
      try {
        return ok(await allSites(db));
      } catch (cause) {
        return storageFailure("ブログの一覧の読み出し", cause);
      }
    },
  });
}
