import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import { markEditorial, ok } from "@/domain/shared";
import { listPublishedBlueprints } from "./site-draft-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 読者向けブログの一覧（D1）。
 *
 * D1 モードでは D1 に実在するブログだけを返す。
 * コード上の見本を一覧に重ねると、管理画面では開けるように見えるのに
 * D1 を読む公開経路では 404 になる。見本は sample モードの保存先だけが
 * 返し、一覧と公開解決のモード境界を一致させる。
 */
async function allSites(db: DrizzleD1) {
  return (await listPublishedBlueprints(db)).published;
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
