import { and, desc, eq } from "drizzle-orm";
import type { EditorialContentPackageRepositoryPort } from "@/application/ports/authoring";
import type { BrandScopeFilter, PageRequest, Paged } from "@/application/ports/common";
import type { ContentPackage } from "@/domain/authoring";
import {
  type ContentPackageId,
  type WorkspaceId,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { type ContentPackageRow, contentPackages } from "@/db/schema";
import { SAMPLE_CONTENT_PACKAGES } from "../sample/content-editorial-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 企画の保存先（D1）。
 *
 * **これはスタブではない。** 見本版と同じ契約（`ContentPackageRepositoryPort`）を
 * 満たす、実際に保存する実装。
 *
 * --- なぜ今これを本物にしたか ---
 *
 * 保存先を本物にする順番の決めごとは書き手（`persona-repository.ts`）と同じ。
 * **入れる口が無いものを先に本物にすると、一生埋まらない空の画面ができる。**
 * だからここでは、同じ変更のなかで `/admin/content/packages/new`（＝入れる口）と
 * `/admin/content/packages`（＝見る口）を用意している。
 *
 * それまでは記事を作る画面が `sampleContentPackageId()`（`cp_laptop_2026`）を
 * 決め打ちで渡していた。つまり**作られる記事はすべて 1 つの見本企画にぶら下がり、
 * 「この企画で何本書いたか」がどの記事についても同じ答えになる**状態だった。
 *
 * --- 列の切り方 ---
 *
 * 一覧が絞り込みと並べ替えに使うものだけを列にする（`objective` / `status` /
 * `domainScope`）。切り口・主張・根拠・生まれた記事の一覧は増え続けるので
 * JSON 1 列にまとめた。とくに `variantIds` を列にすると、記事を 1 本作るたびに
 * 企画の行の作り直しが要る形になる。
 *
 * --- 見本を消さない ---
 *
 * 保存された分の**後ろへ**見本を重ねる（`mergeWithSamples`）。
 * 見本の企画（`cp_laptop_2026`）で作った記事が、保存先をつないだ日に
 * 「企画が見つかりません」で開けなくなるのを防ぐ。
 */

/** 行 → 業務の型。ID の作り方を知っているのはこの層だけ。 */
function toPackage(row: ContentPackageRow): ContentPackage {
  const stored = JSON.parse(row.packageJson) as Omit<
    ContentPackage,
    "id" | "workspaceId" | "objective" | "status" | "domainScope"
  >;
  return {
    ...stored,
    id: taggedString<"ContentPackageId">(row.id) as ContentPackageId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    objective: row.objective,
    status: row.status as ContentPackage["status"],
    domainScope: row.domainScope as ContentPackage["domainScope"],
  };
}

function inBrandScope(pkg: ContentPackage, scope: BrandScopeFilter | undefined): boolean {
  return (
    scope === undefined ||
    scope.brandIds.some((brandId) => String(brandId) === pkg.brandId)
  );
}

/** scope適用後の列にcursor/limitを当てる。cursorも見えない行を基準にしない。 */
function pagePackages(items: readonly ContentPackage[], page: PageRequest): Paged<ContentPackage> {
  const cursorIndex =
    page.cursor === null ? -1 : items.findIndex((pkg) => String(pkg.id) === page.cursor);
  const start = cursorIndex + 1;
  const visible = items.slice(start, start + page.limit);
  return {
    items: visible,
    nextCursor:
      visible.length > 0 && start + visible.length < items.length
        ? String(visible.at(-1)?.id)
        : null,
  };
}

export function createD1ContentPackageRepository(
  db: DrizzleD1,
): EditorialContentPackageRepositoryPort {
  return markEditorial({
    async findById(workspaceId: WorkspaceId, id: ContentPackageId) {
      try {
        const rows = await db
          .select()
          .from(contentPackages)
          .where(
            and(
              eq(contentPackages.workspaceId, String(workspaceId)),
              eq(contentPackages.id, String(id)),
            ),
          )
          .limit(1);
        if (rows.length > 0) return ok(toPackage(rows[0]));
        return ok(
          SAMPLE_CONTENT_PACKAGES.find(
            (pkg) => pkg.workspaceId === workspaceId && pkg.id === id,
          ) ?? null,
        );
      } catch (cause) {
        return storageFailure("企画の読み出し", cause);
      }
    },

    async list(
      workspaceId: WorkspaceId,
      page: PageRequest,
      brandScope?: BrandScopeFilter,
    ) {
      try {
        const rows = await db
          .select()
          .from(contentPackages)
          .where(eq(contentPackages.workspaceId, String(workspaceId)))
          // 新しい順。企画は書き手と違って**作った順に手を付ける**もので、
          // 目的の文字列で並べても次にやる 1 件が上に来ない。
          .orderBy(desc(contentPackages.updatedAt));
        const samples = SAMPLE_CONTENT_PACKAGES.filter(
          (pkg) => pkg.workspaceId === workspaceId,
        );
        const merged = mergeWithSamples(rows.map(toPackage), samples).filter((pkg) =>
          inBrandScope(pkg, brandScope),
        );
        return ok(pagePackages(merged, page));
      } catch (cause) {
        return storageFailure("企画の一覧の読み出し", cause);
      }
    },

    async save(pkg: ContentPackage) {
      const { id, workspaceId, objective, status, domainScope, ...rest } = pkg;
      const columns = {
        objective,
        status,
        domainScope,
        updatedAt: new Date(),
        packageJson: JSON.stringify(rest),
      };
      try {
        await db
          .insert(contentPackages)
          .values({ id: String(id), workspaceId: String(workspaceId), ...columns })
          // 同じ企画を直したら差し替える。**弾かない。**
          // 弾くと、記事が 1 本増えるたび（＝`variantIds` が伸びるたび）に
          // 企画を保存し直せなくなり、企画から記事へ辿れなくなる。
          .onConflictDoUpdate({ target: contentPackages.id, set: columns });
        return ok(pkg);
      } catch (cause) {
        return storageFailure("企画の保存", cause);
      }
    },
  });
}
