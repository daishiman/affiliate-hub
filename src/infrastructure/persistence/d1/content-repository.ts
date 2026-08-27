import { and, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import type { EditorialContentVariantRepositoryPort } from "@/application/ports/authoring";
import type { BrandScopeFilter, PageRequest, Paged, PortResult } from "@/application/ports/common";
import type { ContentState, ContentVariant } from "@/domain/authoring";
import {
  type AffiliateLinkId,
  type AudiencePersonaId,
  type AuthorPersonaId,
  type ClaimId,
  type ContentPackageId,
  type ContentVariantId,
  type EvidenceId,
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { contentPackages, contentVariants, type ContentVariantRow } from "@/db/schema";
import {
  SAMPLE_CONTENT_PACKAGES,
  compareContentVariantPageOrder,
  orderContentVariantsForPaging,
  pageContentVariants,
  sampleContentVariants,
  SAMPLE_CONTENT_VARIANT_REVISION,
} from "../sample/content-editorial-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 記事の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約を満たす、実際に保存する実装。
 *
 * ここで扱うのは記事本文と**進行の現在地**の 2 つ。現在地は業務の型には無く、
 * 行の上でだけ本文と隣り合う（理由は `src/db/schema.ts` と
 * `src/application/ports/authoring.ts` に書いた）。
 *
 * 企画（ContentPackage）と書き手（Persona）はここでは扱わない。
 * **作る入口がまだどこにも無い**ので、保存先だけ用意しても永久に空のままになる。
 * それらは見本のまま残し、台帳（`docs/product/stub-ledger.md`）に条件を書いている。
 */

/** 行 → 業務の形。ID の作り方を知っているのはこの層だけ。 */
function toVariant(row: ContentVariantRow): ContentVariant {
  return {
    id: taggedString<"ContentVariantId">(row.id) as ContentVariantId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    contentPackageId: taggedString<"ContentPackageId">(row.contentPackageId) as ContentPackageId,
    channel: row.channel,
    format: row.format,
    authorPersonaId: taggedString<"AuthorPersonaId">(row.authorPersonaId) as AuthorPersonaId,
    audiencePersonaId: taggedString<"AudiencePersonaId">(
      row.audiencePersonaId,
    ) as AudiencePersonaId,
    angle: row.angle,
    title: row.title,
    body: row.body,
    summary: row.summary,
    cta: row.cta,
    disclosure: row.disclosure,
    affiliateLinkIds: row.affiliateLinkIds.map(
      (id) => taggedString<"AffiliateLinkId">(id) as AffiliateLinkId,
    ),
    claimIds: row.claimIds.map((id) => taggedString<"ClaimId">(id) as ClaimId),
    evidenceIds: row.evidenceIds.map((id) => taggedString<"EvidenceId">(id) as EvidenceId),
    assumptions: row.assumptions,
    platformWarnings: row.platformWarnings,
    factualityScore: row.factualityScore,
    personaFitScore: row.personaFitScore,
    channelFitScore: row.channelFitScore,
    complianceStatus: row.complianceStatus,
    generationPromptVersion: row.generationPromptVersion,
    modelId: row.modelId,
    status: row.status,
  };
}

/**
 * 業務の形 → 行。
 *
 * 現在地は業務の形が持っていないので、**別に受け取る**。
 * ここで既定値を決め打ちにすると、本文を直しただけで進行が巻き戻る。
 */
function toRow(item: ContentVariant, state: ContentState, revision: number): ContentVariantRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    contentPackageId: String(item.contentPackageId),
    channel: item.channel,
    format: item.format,
    authorPersonaId: String(item.authorPersonaId),
    audiencePersonaId: String(item.audiencePersonaId),
    angle: item.angle,
    title: item.title,
    body: item.body,
    summary: item.summary,
    cta: item.cta,
    disclosure: item.disclosure,
    affiliateLinkIds: item.affiliateLinkIds.map(String),
    claimIds: item.claimIds.map(String),
    evidenceIds: item.evidenceIds.map(String),
    assumptions: [...item.assumptions],
    platformWarnings: [...item.platformWarnings],
    factualityScore: item.factualityScore,
    personaFitScore: item.personaFitScore,
    channelFitScore: item.channelFitScore,
    complianceStatus: item.complianceStatus,
    generationPromptVersion: item.generationPromptVersion,
    modelId: item.modelId,
    status: item.status,
    revision,
    state,
    reviewDueAt: null,
  };
}

export function createD1ContentVariantRepository(
  db: DrizzleD1,
): EditorialContentVariantRepositoryPort {
  /** scope対象ブランドに属する企画ID。欠損企画は限定actorへ推測で見せない。 */
  async function allowedPackageIds(
    workspaceId: WorkspaceId,
    brandScope: BrandScopeFilter | undefined,
  ): Promise<ReadonlySet<string> | null> {
    if (brandScope === undefined) return null;
    const allowedBrands = new Set(brandScope.brandIds.map(String));
    const rows = await db
      .select({ id: contentPackages.id, packageJson: contentPackages.packageJson })
      .from(contentPackages)
      .where(eq(contentPackages.workspaceId, String(workspaceId)));
    const allowed = new Set<string>();
    for (const row of rows) {
      const stored = JSON.parse(row.packageJson) as { readonly brandId?: unknown };
      if (typeof stored.brandId === "string" && allowedBrands.has(stored.brandId)) {
        allowed.add(row.id);
      }
    }
    for (const pkg of SAMPLE_CONTENT_PACKAGES) {
      if (pkg.workspaceId === workspaceId && allowedBrands.has(pkg.brandId)) {
        allowed.add(String(pkg.id));
      }
    }
    return allowed;
  }

  /** 保存された分と見本を重ねた、この作業場所の全記事（現在地つき）。 */
  async function all(
    workspaceId: WorkspaceId,
    brandScope?: BrandScopeFilter,
  ): Promise<
    readonly {
      readonly state: ContentState;
      readonly variant: ContentVariant;
      readonly revision: number;
      readonly persisted: boolean;
    }[]
  > {
    const rows = await db
      .select()
      .from(contentVariants)
      .where(eq(contentVariants.workspaceId, String(workspaceId)));
    const stored = rows.map((row) => ({
      state: row.state,
      variant: toVariant(row),
      revision: row.revision,
      persisted: true,
    }));
    const samples = sampleContentVariants()
      .filter((s) => s.variant.workspaceId === workspaceId)
      .map((s) => ({
        ...s,
        revision: SAMPLE_CONTENT_VARIANT_REVISION,
        persisted: false,
      }));
    // 重ねる判定は記事の ID で行うので、ID を表に出した形に直してから渡す。
    const merged = mergeWithSamples(
      stored.map((s) => ({ id: s.variant.id, ...s })),
      samples.map((s) => ({ id: s.variant.id, ...s })),
    );
    const allowed = await allowedPackageIds(workspaceId, brandScope);
    const visible =
      allowed === null
        ? merged
        : merged.filter((item) => allowed.has(String(item.variant.contentPackageId)));
    return [...visible].sort((left, right) =>
      compareContentVariantPageOrder(left.variant, right.variant),
    );
  }

  return markEditorial({
    async findById(workspaceId, id): PortResult<ContentVariant | null> {
      try {
        return ok((await all(workspaceId)).find((v) => v.variant.id === id)?.variant ?? null);
      } catch (cause) {
        return storageFailure("記事の読み出し", cause);
      }
    },

    async findVersionedById(workspaceId, id) {
      try {
        const found = (await all(workspaceId)).find((v) => v.variant.id === id);
        return ok(
          found === undefined
            ? null
            : {
                variant: found.variant,
                revision: found.revision,
                persisted: found.persisted,
              },
        );
      } catch (cause) {
        return storageFailure("記事の版つき読み出し", cause);
      }
    },

    async findState(workspaceId, id): PortResult<ContentState | null> {
      try {
        return ok((await all(workspaceId)).find((v) => v.variant.id === id)?.state ?? null);
      } catch (cause) {
        return storageFailure("記事の進行の読み出し", cause);
      }
    },

    async listByPackage(workspaceId, packageId): PortResult<readonly ContentVariant[]> {
      try {
        return ok(
          (await all(workspaceId))
            .filter((v) => v.variant.contentPackageId === packageId)
            .map((v) => v.variant),
        );
      } catch (cause) {
        return storageFailure("企画ごとの記事の取得", cause);
      }
    },

    /**
     * かんばんの 1 列分。
     *
     * **絞り込みは重ねたあとに行う。** 保存先だけで絞ると、見本の記事が
     * どの列にも出てこない。かんばんは 12 列を順に読むので、
     * 1 列でも欠けると「その段階の記事が無い」と読めてしまう。
     */
    async listByState(
      workspaceId,
      state: ContentState,
      page: PageRequest,
      brandScope?: BrandScopeFilter,
    ): PortResult<Paged<ContentVariant>> {
      try {
        const candidates = (await all(workspaceId, brandScope))
          .filter((v) => v.state === state)
          .map((v) => v.variant);
        return ok(pageContentVariants(candidates, page));
      } catch (cause) {
        return storageFailure("記事の一覧取得", cause);
      }
    },

    /**
     * 見直しの時期に来た記事。
     *
     * いまは **「見直しの時期」へ進めた記事**と、次に見る日を過ぎた記事の
     * どちらも拾う。前者しか実際には出ないが（日付を入れる処理がまだ無い）、
     * 後者を先に書いておかないと、日付を入れ始めた日に
     * 「入れたのに一覧へ出ない」という静かな取りこぼしが生まれる。
     */
    async listReviewOverdue(
      workspaceId,
      at: Date,
      limit: number,
      brandScope?: BrandScopeFilter,
    ) {
      try {
        const rows = await db
          .select()
          .from(contentVariants)
          .where(
            and(
              eq(contentVariants.workspaceId, String(workspaceId)),
              or(
                eq(contentVariants.state, "REFRESH_DUE"),
                and(isNotNull(contentVariants.reviewDueAt), lte(contentVariants.reviewDueAt, at)),
              ),
            ),
          );
        const allowed = await allowedPackageIds(workspaceId, brandScope);
        const scopedRows =
          allowed === null
            ? rows
            : rows.filter((row) => allowed.has(String(row.contentPackageId)));
        return ok(orderContentVariantsForPaging(scopedRows.map(toVariant)).slice(0, limit));
      } catch (cause) {
        return storageFailure("見直しが必要な記事の取得", cause);
      }
    },

    /**
     * 本文の保存。
     *
     * **現在地は動かさない。** いまの現在地を読んでから同じ値で書き戻す。
     * ここで既定値を入れると、承認しただけで列が先頭へ戻る。
     * まだ 1 度も保存されていない見本を上書きするときは、見本の現在地を引き継ぐ。
     */
    async save(variant: ContentVariant): PortResult<ContentVariant> {
      try {
        const current = (await all(variant.workspaceId)).find((v) => v.variant.id === variant.id);
        const stored = await db
          .select({ revision: contentVariants.revision })
          .from(contentVariants)
          .where(
            and(
              eq(contentVariants.workspaceId, String(variant.workspaceId)),
              eq(contentVariants.id, String(variant.id)),
            ),
          )
          .limit(1);
        const initialRevision =
          stored[0] === undefined
            ? current === undefined
              ? 1
              : current.revision + 1
            : stored[0].revision + 1;
        const row = toRow(variant, current?.state ?? "GENERATED", initialRevision);
        await db.insert(contentVariants).values(row).onConflictDoUpdate({
          target: contentVariants.id,
          set: {
            ...row,
            // 読み取り後に別保存が入っても、DBの現在値から単調に進める。
            revision: sql`${contentVariants.revision} + 1`,
          },
        });
        return ok(variant);
      } catch (cause) {
        return storageFailure("記事の保存", cause);
      }
    },

    /**
     * 進行の現在地だけを保存する。
     *
     * 本文がまだ保存先に無い（＝見本を進めた）場合は、**本文ごと写してから**
     * 現在地を書く。現在地だけの行を作ると、本文の無い札がかんばんに並ぶ。
     */
    async saveState(
      workspaceId,
      id: ContentVariantId,
      state: ContentState,
    ): PortResult<ContentState> {
      try {
        const current = (await all(workspaceId)).find((v) => v.variant.id === id);
        if (current === undefined) {
          return err(
            domainError("NOT_FOUND", "その記事は見つかりませんでした。", {
              suggestedAction: "記事の一覧から選び直してください。",
            }),
          );
        }
        const row = toRow(current.variant, state, current.revision);
        await db.insert(contentVariants).values(row).onConflictDoUpdate({
          target: contentVariants.id,
          // 進行の現在地は本文の内容ではないため、本文版を進めない。
          set: { state },
        });
        return ok(state);
      } catch (cause) {
        return storageFailure("記事の進行の保存", cause);
      }
    },

    /**
     * 記事を消す。
     *
     * **見本の記事は消せない。** 見本はコードの中にあるので行を消しても次の
     * 読み出しでまた現れる。「消えた」と返して次に開いたら居る、が
     * いちばん質の悪い壊れ方なので、ここで断る。
     */
    async remove(workspaceId, id: ContentVariantId): PortResult<true> {
      try {
        const current = (await all(workspaceId)).find((v) => v.variant.id === id);
        if (current === undefined) {
          return err(
            domainError("NOT_FOUND", "その記事は見つかりませんでした。", {
              suggestedAction: "記事の一覧から選び直してください。",
            }),
          );
        }
        const deleted = await db
          .delete(contentVariants)
          .where(
            and(
              eq(contentVariants.workspaceId, String(workspaceId)),
              eq(contentVariants.id, String(id)),
            ),
          )
          .returning({ id: contentVariants.id });
        if (deleted.length === 0) {
          return err(
            domainError("CONFLICT", "この記事は見本のため消せません。", {
              suggestedAction:
                "見本はコードに含まれています。自分で作った記事を選び直してください。",
            }),
          );
        }
        return ok(true as const);
      } catch (cause) {
        return storageFailure("記事の削除", cause);
      }
    },
  });
}
