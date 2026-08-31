import type { EditorialContentPackageRepositoryPort } from "@/application/ports/authoring";
import type { BrandScopeFilter } from "@/application/ports/common";
import type { ContentPackage, ContentVariant } from "@/domain/authoring";
import {
  type ActorContext,
  type BrandId,
  type DomainError,
  type Result,
  assertBrandScope,
  assertSameTenant,
  err,
  ok,
  taggedString,
} from "@/domain/shared";

/** workspace全体は条件なし、限定membershipは列挙ブランドのquery条件へ写す。 */
export function brandScopeFilterFor(actor: ActorContext): BrandScopeFilter | undefined {
  return (actor.scopedBrandIds?.length ?? 0) === 0
    ? undefined
    : { brandIds: actor.scopedBrandIds };
}

/** 企画が actor の workspace とブランド範囲の両方に入ることを確かめる。 */
export function assertContentPackageBrandScope(
  actor: ActorContext,
  pkg: ContentPackage,
  what: string,
): Result<true, DomainError> {
  const owned = assertSameTenant(actor, pkg, what);
  if (!owned.ok) return err(owned.error);

  const rawBrandId = pkg.brandId.trim();
  return assertBrandScope(
    actor,
    rawBrandId === "" ? null : (taggedString<"BrandId">(rawBrandId) as BrandId),
    what,
  );
}

/** 記事から企画を逆引きしてブランド範囲を照合する。入力側の brandId は信じない。 */
export async function assertContentVariantBrandScope(
  packages: EditorialContentPackageRepositoryPort,
  actor: ActorContext,
  variant: ContentVariant,
  what: string,
): Promise<Result<true, DomainError>> {
  const owned = assertSameTenant(actor, variant, what);
  if (!owned.ok) return err(owned.error);

  // workspace 全体を扱える actor には、既存の欠損企画を読む診断経路を残す。
  // 限定 actor だけは企画が引けない時点で所属ブランドを証明できないため拒否する。
  if ((actor.scopedBrandIds?.length ?? 0) === 0) return ok(true);

  const found = await packages.findById(actor.workspaceId, variant.contentPackageId);
  if (!found.ok) return err(found.error);
  if (
    found.value === null ||
    String(found.value.id) !== String(variant.contentPackageId)
  ) {
    return assertBrandScope(actor, null, what);
  }
  return assertContentPackageBrandScope(actor, found.value, what);
}

/** 一覧では担当外を存在ごと隠す。保存先エラーだけは空一覧に偽装せず返す。 */
export async function filterContentVariantsByBrandScope(
  packages: EditorialContentPackageRepositoryPort,
  actor: ActorContext,
  variants: readonly ContentVariant[],
): Promise<Result<readonly ContentVariant[], DomainError>> {
  const visible: ContentVariant[] = [];
  for (const variant of variants) {
    const scoped = await assertContentVariantBrandScope(packages, actor, variant, "記事");
    if (scoped.ok) {
      visible.push(variant);
      continue;
    }
    if (scoped.error.code === "TENANT_MISMATCH") continue;
    return err(scoped.error);
  }
  return ok(visible);
}
