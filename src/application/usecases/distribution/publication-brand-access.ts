import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
} from "@/application/ports/authoring";
import type { BrandScopeFilter } from "@/application/ports/common";
import type { ContentVariant } from "@/domain/authoring";
import type { Publication } from "@/domain/distribution";
import {
  type ActorContext,
  type BrandId,
  type DomainError,
  type Result,
  assertSameTenant,
  coversBrandScope,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";

/** 配信から記事、企画、ブランドへ辿るための最小依存。 */
export type PublicationBrandAccessDeps = {
  readonly contentVariants: EditorialContentVariantRepositoryPort;
  readonly contentPackages: EditorialContentPackageRepositoryPort;
};

function hidden(what: "配信" | "記事"): DomainError {
  return domainError("TENANT_MISMATCH", `この${what}が見つかりません。`, {
    suggestedAction: `担当ブランドの${what}一覧から選び直してください。`,
  });
}

function isLimited(actor: ActorContext): boolean {
  return (actor.scopedBrandIds?.length ?? 0) > 0;
}

/** 空配列は workspace 全体、それ以外は保存先で limit 前に絞るブランド一覧。 */
export function publicationListScopeOf(actor: ActorContext): BrandScopeFilter | undefined {
  return isLimited(actor) ? { brandIds: actor.scopedBrandIds } : undefined;
}

/**
 * 読み出し済みの記事が、実行主体のブランド範囲に入るかを正本の企画から判定する。
 *
 * ContentVariant 自体に brandId は無い。入力された ID や表示文字列を信用せず、
 * variant.contentPackageId -> ContentPackage.brandId の順でサーバー側から辿る。
 * 親が消えている・別 workspace・担当外のいずれも false に畳み、存在を区別させない。
 */
export async function isVariantInBrandScope(
  deps: PublicationBrandAccessDeps,
  actor: ActorContext,
  variant: ContentVariant,
): Promise<Result<boolean, DomainError>> {
  if (!isLimited(actor)) return ok(true);

  const ownedVariant = assertSameTenant(actor, variant, "この記事");
  if (!ownedVariant.ok) return ok(false);

  const foundPackage = await deps.contentPackages.findById(
    actor.workspaceId,
    variant.contentPackageId,
  );
  if (!foundPackage.ok) return err(foundPackage.error);
  if (foundPackage.value === null) return ok(false);

  const ownedPackage = assertSameTenant(actor, foundPackage.value, "この企画");
  if (!ownedPackage.ok) return ok(false);

  return ok(
    coversBrandScope(actor, taggedString<"BrandId">(foundPackage.value.brandId) as BrandId),
  );
}

/** 入力された記事 ID をサーバー側で引き直し、担当ブランドでなければ隠す。 */
export async function ensureVariantBrandAccess(
  deps: PublicationBrandAccessDeps,
  actor: ActorContext,
  variant: ContentVariant,
): Promise<Result<true, DomainError>> {
  const accessible = await isVariantInBrandScope(deps, actor, variant);
  if (!accessible.ok) return err(accessible.error);
  return accessible.value ? ok(true) : err(hidden("記事"));
}

/** 配信 -> 記事 -> 企画 -> ブランドを逆引きする。辿れない配信は限定担当者へ見せない。 */
export async function isPublicationInBrandScope(
  deps: PublicationBrandAccessDeps,
  actor: ActorContext,
  publication: Publication,
): Promise<Result<boolean, DomainError>> {
  if (!isLimited(actor)) return ok(true);

  const ownedPublication = assertSameTenant(actor, publication, "この配信");
  if (!ownedPublication.ok) return ok(false);

  const foundVariant = await deps.contentVariants.findById(
    actor.workspaceId,
    publication.variantId,
  );
  if (!foundVariant.ok) return err(foundVariant.error);
  if (foundVariant.value === null) return ok(false);

  return isVariantInBrandScope(deps, actor, foundVariant.value);
}

export async function ensurePublicationBrandAccess(
  deps: PublicationBrandAccessDeps,
  actor: ActorContext,
  publication: Publication,
): Promise<Result<true, DomainError>> {
  const accessible = await isPublicationInBrandScope(deps, actor, publication);
  if (!accessible.ok) return err(accessible.error);
  return accessible.value ? ok(true) : err(hidden("配信"));
}

/** 一覧では担当外を 1 件ずつ隠す。保存先の障害だけは空一覧へ潰さず、そのまま返す。 */
export async function filterPublicationsByBrandScope(
  deps: PublicationBrandAccessDeps,
  actor: ActorContext,
  publications: readonly Publication[],
): Promise<Result<readonly Publication[], DomainError>> {
  if (!isLimited(actor)) return ok(publications);

  // 同じ記事を複数媒体へ出した配信では親ブランドも同じ。variant 単位で 1 回だけ
  // 逆引きし、媒体数ぶん同じ D1 問い合わせを繰り返さない。
  const accessByVariant = new Map<string, Promise<Result<boolean, DomainError>>>();
  const checks = await Promise.all(
    publications.map((publication) => {
      if (!assertSameTenant(actor, publication, "この配信").ok) return ok(false);
      const key = String(publication.variantId);
      const cached = accessByVariant.get(key);
      if (cached !== undefined) return cached;
      const resolved = (async (): Promise<Result<boolean, DomainError>> => {
        const foundVariant = await deps.contentVariants.findById(
          actor.workspaceId,
          publication.variantId,
        );
        if (!foundVariant.ok) return err(foundVariant.error);
        if (foundVariant.value === null) return ok(false);
        return isVariantInBrandScope(deps, actor, foundVariant.value);
      })();
      accessByVariant.set(key, resolved);
      return resolved;
    }),
  );
  const failed = checks.find((check) => !check.ok);
  if (failed !== undefined && !failed.ok) return err(failed.error);

  return ok(
    publications.filter(
      (_publication, index) => checks[index]?.ok === true && checks[index].value,
    ),
  );
}
