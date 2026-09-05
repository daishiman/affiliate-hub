import type {
  EditorialContentPackageRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { BrandRepositoryPort } from "@/application/ports/identity";
import type { EditorialProductRepositoryPort } from "@/application/ports/product";
import { ensureOwnedReference } from "@/application/owned-reference";
import { createContentPackage, type ContentAngle, type ContentPackage, type FunnelStage } from "@/domain/authoring/content-package";
import type { PolicyDomainScope } from "@/domain/compliance";
import { requireCapability } from "@/domain/identity";
import {
  type AudiencePersonaId,
  type AuthorPersonaId,
  type BrandId,
  type ContentPackageId,
  type DomainError,
  type ProductId,
  type Result,
  assertBrandAccess,
  coversBrandScope,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import { brandScopeFilterFor } from "../content/content-brand-access";

/**
 * 企画の管理（プラットフォーム層 §7.3・§15.3）。
 *
 * **企画は記事ではない。記事を何本も生む親である。**
 * 「どの商品を・どの根拠で・誰が・誰に向けて・何のために・どの購買段階で・
 * どの切り口で」までを企画が決め、媒体と長さと CTA を記事が決める。
 *
 * ここが 1 件しか無いと、書いた記事の「これは何の企画の記事か」が
 * どの記事についても同じ答えになる。並べ替えも絞り込みも意味を失う。
 *
 * この文脈は Editorial 区分。報酬のつなぎ目は受け取らない。
 */
export type ManageContentPackagesDeps = {
  readonly packages: EditorialContentPackageRepositoryPort;
  /**
   * 書き手と読者像。**一覧の表示にだけ使う。**
   *
   * 企画の行が持っているのは ID だけなので、これが無いと
   * 一覧に `ap_3f2a...` と並ぶ。人が読んで選べる画面にならない。
   */
  readonly personas: EditorialPersonaRepositoryPort;
  /** 企画が参照するブランドと商品。保存前の workspace 所有確認に使う。 */
  readonly brands: BrandRepositoryPort;
  readonly products: EditorialProductRepositoryPort;
  /**
   * ID の作り方。**登録のときだけ要る。**
   * 参照だけの経路に「ID を作れる道具」を持たせないため省略できる。
   */
  readonly ids?: IdGeneratorPort;
  readonly affiliateLinks?: never;
};

/** 企画を**書き換える**側の口。一覧だけの経路には持たせない。 */
export type RecordedContentPackagesDeps = ManageContentPackagesDeps & {
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

/** 登録の口が ID の作り方を持たずに組まれたとき（`manage-personas.ts` と同じ理由）。 */
function idsMissing() {
  return err(
    domainError("NOT_IMPLEMENTED", "企画の登録は、この画面からは行えません。", {
      suggestedAction: "公開した環境（pnpm run preview か本番）で開いてください。",
    }),
  );
}

export const FUNNEL_STAGE_LABELS: Readonly<Record<FunnelStage, string>> = {
  awareness: "まだ困りごとに気づいていない人",
  consideration: "何を買うか迷っている人",
  decision: "どれにするか決める直前の人",
  retention: "すでに買って使っている人",
};

export const CONTENT_ANGLE_LABELS: Readonly<Record<ContentAngle, string>> = {
  conclusion_first: "結論から書く",
  problem_first: "悩みから書く",
  experience_first: "使ってみた話から書く",
  data_first: "測った数字から書く",
  comparison_first: "他と比べて書く",
  beginner: "はじめての人向け",
  expert: "詳しい人向け",
  budget: "予算から考える",
  drawback: "弱いところも書く",
  surprise: "意外な点から書く",
  story: "物語として書く",
  seasonal: "季節に合わせて書く",
  use_case: "使う場面から書く",
  faq: "よくある質問に答える",
  paradox: "常識の逆から書く",
  checklist: "確かめる項目を並べる",
};

export const DOMAIN_SCOPE_LABELS: Readonly<Record<PolicyDomainScope, string>> = {
  general: "とくに規制の無い分野",
  health_food: "健康食品（薬機法）",
  cosmetics: "化粧品（薬機法）",
  medical: "医療・医薬品",
  finance: "お金・金融商品",
  gambling: "公営競技・賭けごと",
  alcohol: "お酒",
  children: "子ども向け",
};

const STATUS_LABELS: Readonly<Record<ContentPackage["status"], string>> = {
  researching: "調べている",
  ready: "書き始められる",
  generating: "文章を作っている",
  review: "確かめてもらっている",
  approved: "出してよい",
  published: "出した",
  refresh_due: "見直しの時期",
};

export type ContentPackageSummary = {
  readonly packageId: string;
  readonly objective: string;
  readonly statusLabel: string;
  readonly funnelLabel: string;
  readonly domainLabel: string;
  readonly angleLabels: readonly string[];
  readonly authorName: string;
  readonly audienceNames: readonly string[];
  /** この企画から生まれた記事の本数。0 なら「まだ 1 本も書いていない」。 */
  readonly variantCount: number;
  /**
   * 生成に進めない理由。空なら進める。
   *
   * 一覧に出すのは、**足りないまま「書き始められる」に見えるのを防ぐ**ため。
   * 主張と根拠が空の企画は、生成の画面まで行って初めて断られる。
   */
  readonly missing: readonly string[];
};

export type ListContentPackagesOutput = {
  readonly items: readonly ContentPackageSummary[];
  /** 0 件のときに出す理由。無言の空表を作らないため。 */
  readonly emptyReason: string | null;
};

/**
 * 企画の一覧。
 *
 * 書き手と読者像の名前をここで引いて混ぜる。**画面側で引かない。**
 * 画面ごとに引くと、名前の出し方（敬称・肩書きの付け方）が画面の数だけ増える。
 */
export function createListContentPackagesUseCase(
  deps: ManageContentPackagesDeps,
): UseCase<Record<string, never>, ListContentPackagesOutput> {
  return {
    async execute(actor): Promise<Result<ListContentPackagesOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "企画の参照");
      if (!allowed.ok) return allowed;

      const page = { limit: 100, cursor: null };
      const [listed, authors, audiences] = await Promise.all([
        deps.packages.list(actor.workspaceId, page, brandScopeFilterFor(actor)),
        deps.personas.listAuthors(actor.workspaceId, page),
        deps.personas.listAudiences(actor.workspaceId, page),
      ]);
      if (!listed.ok) return listed;
      if (!authors.ok) return authors;
      if (!audiences.ok) return audiences;

      const authorName = new Map(authors.value.items.map((a) => [String(a.id), a.displayName]));
      const audienceName = new Map(audiences.value.items.map((a) => [String(a.id), a.name]));

      const visiblePackages = listed.value.items.filter(
        (pkg) =>
          pkg.workspaceId === actor.workspaceId &&
          coversBrandScope(actor, taggedString<"BrandId">(pkg.brandId) as BrandId),
      );
      const items = visiblePackages.map((pkg): ContentPackageSummary => {
        const missing: string[] = [];
        if (pkg.claimIds.length === 0) missing.push("承認済みの主張");
        if (pkg.evidenceIds.length === 0) missing.push("根拠");
        return {
          packageId: String(pkg.id),
          objective: pkg.objective,
          statusLabel: STATUS_LABELS[pkg.status],
          funnelLabel: FUNNEL_STAGE_LABELS[pkg.funnelStage],
          domainLabel: DOMAIN_SCOPE_LABELS[pkg.domainScope],
          angleLabels: pkg.contentAngles.map((a) => CONTENT_ANGLE_LABELS[a]),
          // 引けなかった ID をそのまま出さない。消された書き手を指している
          // ことが分かる言い方にする（ID を出しても読む人には何も分からない）。
          authorName: authorName.get(String(pkg.authorPersonaId)) ?? "（見つからない書き手）",
          audienceNames: pkg.audiencePersonaIds.map(
            (id) => audienceName.get(String(id)) ?? "（見つからない読者像）",
          ),
          variantCount: pkg.variantIds.length,
          missing,
        };
      });

      return ok({
        items,
        emptyReason: items.length === 0 ? "まだ企画がありません。1 つ作ってください。" : null,
      });
    },
  };
}

export type SaveContentPackageInput = {
  readonly brandId: string;
  readonly primarySubjectId: string;
  readonly domainScope: PolicyDomainScope;
  readonly authorPersonaId: string;
  readonly audiencePersonaIds: readonly string[];
  readonly objective: string;
  readonly funnelStage: FunnelStage;
  readonly contentAngles: readonly ContentAngle[];
};

export type SavedContentPackage = {
  readonly packageId: string;
  readonly objective: string;
};

/**
 * 企画を 1 つ登録する。
 *
 * **主張と根拠は受け取らない。** 企画を立てる時点ではまだ調べ終わっていないのが
 * 普通で、必須にすると「とりあえず何か入れる」が起きる。空の主張が付いた企画は、
 * 生成の直前（`canStartGeneration`）で断られるほうが安全である。
 * だから作った直後の状態は `researching`（調べている）になる。
 */
export function createSaveContentPackageUseCase(
  deps: RecordedContentPackagesDeps,
): UseCase<SaveContentPackageInput, SavedContentPackage> {
  return {
    async execute(actor, input): Promise<Result<SavedContentPackage, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "企画の登録");
      if (!allowed.ok) return allowed;
      if (deps.ids === undefined) return idsMissing();

      const brandId = taggedString<"BrandId">(input.brandId.trim()) as BrandId;
      const brand = ensureOwnedReference(
        await deps.brands.findById(actor.workspaceId, brandId),
        actor.workspaceId,
        "brandId",
        "そのブランドはこの作業場所に見つかりません。ブランドの一覧から選び直してください。",
      );
      if (!brand.ok) return brand;
      const accessibleBrand = assertBrandAccess(actor, brand.value);
      if (!accessibleBrand.ok) return accessibleBrand;

      const productId = taggedString<"ProductId">(input.primarySubjectId.trim()) as ProductId;
      const product = ensureOwnedReference(
        await deps.products.findById(actor.workspaceId, productId),
        actor.workspaceId,
        "primarySubjectId",
        "その商品はこの作業場所に見つかりません。商品の一覧から選び直してください。",
      );
      if (!product.ok) return product;

      const authorPersonaId = taggedString<"AuthorPersonaId">(
        input.authorPersonaId.trim(),
      ) as AuthorPersonaId;
      const author = ensureOwnedReference(
        await deps.personas.findAuthor(actor.workspaceId, authorPersonaId),
        actor.workspaceId,
        "authorPersonaId",
        "その書き手はこの作業場所に見つかりません。書き手の一覧から選び直してください。",
      );
      if (!author.ok) return author;

      const audiencePersonaIds = input.audiencePersonaIds.map(
        (id) => taggedString<"AudiencePersonaId">(id.trim()) as AudiencePersonaId,
      );
      for (const audiencePersonaId of audiencePersonaIds) {
        const audience = ensureOwnedReference(
          await deps.personas.findAudience(actor.workspaceId, audiencePersonaId),
          actor.workspaceId,
          "audiencePersonaIds",
          "選んだ読者像がこの作業場所に見つかりません。読者像の一覧から選び直してください。",
        );
        if (!audience.ok) return audience;
      }

      const built = createContentPackage({
        id: taggedString<"ContentPackageId">(`cp_${deps.ids.newId()}`) as ContentPackageId,
        workspaceId: actor.workspaceId,
        brandId: String(brandId),
        primarySubjectId: productId,
        domainScope: input.domainScope,
        claimIds: [],
        evidenceIds: [],
        authorPersonaId,
        audiencePersonaIds,
        objective: input.objective.trim(),
        funnelStage: input.funnelStage,
        contentAngles: input.contentAngles,
      });
      if (!built.ok) return built;

      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "content_package.changed",
        targetType: "content_package",
        targetId: String(built.value.id),
        before: null,
        after: {
          brandId: String(built.value.brandId),
          objective: built.value.objective,
          funnelStage: built.value.funnelStage,
          authorPersonaId: String(built.value.authorPersonaId),
        },
      });
      if (!entry.ok) return entry;

      const saved = await deps.packages.save(built.value);
      if (!saved.ok) return saved;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("企画の登録は済んでいます", appended.error.details));
      }
      return ok({ packageId: String(saved.value.id), objective: saved.value.objective });
    },
  };
}
