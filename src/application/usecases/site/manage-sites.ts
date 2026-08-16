import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import {
  type SiteBlueprint,
  type SitePattern,
  type SiteRoute,
  type StandardPage,
  differentiationGap,
  missingTrustPages,
  routesFor,
} from "@/domain/authoring";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * サイトの管理（プラットフォーム側）。
 *
 * **「ブログを 1 本増やす」= 設計図の設定値を 1 件足すこと**、を画面で見せるための入口。
 * ここに「このブログのときだけこうする」を書き始めたら、
 * それは Blueprint の項目が足りていない合図であり、分岐を足す合図ではない。
 *
 * 依存は読者向けと同じ `sites` ポート 1 つだけ。
 * 管理画面のために別の読み取り口を作ると、
 * 管理画面に出る設計図と読者に出る設計図がずれる。
 */

export type ManageSitesDeps = {
  readonly sites: EditorialSiteRepositoryPort;
};

function guardEditorial(deps: ManageSitesDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `サイト管理に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額をブログの設計・並び順の入力にすることはできません。",
    );
  }
}

/** ブログパターンの表示名。識別子をそのまま画面に出さない。 */
export const SITE_PATTERN_LABEL: Readonly<Record<SitePattern, string>> = {
  specialist_review: "専門レビュー型",
  comparison_lab: "比較研究所型",
  beginner_guide: "初心者案内型",
  personal_brand: "個人ブランド型",
  product_discovery: "商品発見型",
  service_signup: "サービス申込み型",
  tool: "ツール型",
  editorial_media: "メディア編集部型",
  story: "ストーリー型",
  database: "データベース型",
};

/** 収益モデルの表示名。 */
export const REVENUE_MODEL_LABEL: Readonly<Record<string, string>> = {
  affiliate: "提携販売",
  ad: "広告",
  lead: "見込み客の紹介",
  own_product: "自社商品",
  mixed: "組み合わせ",
};

/** 差別化の 10 軸の表示名。空欄を画面で指摘できるようにするために要る。 */
export const DIFFERENTIATION_AXIS_LABEL: Readonly<Record<string, string>> = {
  targetReader: "読者",
  searchIntent: "探している理由",
  articlePurpose: "記事の役目",
  evaluationAxis: "評価の軸",
  usageScene: "使う場面",
  uniqueExperience: "自分たちにしかない経験",
  comparisonScope: "比べる範囲",
  conclusionStance: "結論の出し方",
  internalLinkStrategy: "記事どうしのつなぎ方",
  ctaStrategy: "行動の促し方",
};

export type ManagedSiteSummary = {
  readonly slug: string;
  readonly name: string;
  readonly pattern: SitePattern;
  readonly patternLabel: string;
  readonly genre: string;
  readonly revenueModelLabel: string;
  readonly brandTheme: string;
  readonly categoryCount: number;
  readonly routeCount: number;
  /** 揃っていない信頼ページ。空でないブログは公開できない。 */
  readonly missingTrustPages: readonly StandardPage[];
  readonly launchBlockedReason: string | null;
};

export type ListManagedSitesOutput = {
  readonly items: readonly ManagedSiteSummary[];
  readonly total: number;
  readonly emptyReason: string | null;
};

function launchBlockedReason(blueprint: SiteBlueprint): string | null {
  const missing = missingTrustPages(blueprint);
  if (missing.length === 0) return null;
  return `信頼のための固定ページが揃っていません（${missing.join(" / ")}）。広告表記の説明先が無い記事を公開させないため、ここが空になるまで公開できません。`;
}

function summarize(slug: string, blueprint: SiteBlueprint): ManagedSiteSummary {
  return {
    slug,
    name: blueprint.name,
    pattern: blueprint.pattern,
    patternLabel: SITE_PATTERN_LABEL[blueprint.pattern],
    genre: blueprint.genre,
    revenueModelLabel: REVENUE_MODEL_LABEL[blueprint.revenueModel] ?? blueprint.revenueModel,
    brandTheme: blueprint.theme.brandTheme,
    categoryCount: blueprint.categories.length,
    routeCount: routesFor(blueprint).length,
    missingTrustPages: missingTrustPages(blueprint),
    launchBlockedReason: launchBlockedReason(blueprint),
  };
}

/** 運用中のブログ一覧。 */
export function createListManagedSitesUseCase(
  deps: ManageSitesDeps,
): UseCase<Record<string, never>, ListManagedSitesOutput> {
  guardEditorial(deps);
  return {
    async execute(): Promise<Result<ListManagedSitesOutput, DomainError>> {
      const listed = await deps.sites.list();
      if (!listed.ok) return listed;
      const items = listed.value.map((s) => summarize(s.slug, s.blueprint));
      return ok({
        items,
        total: items.length,
        emptyReason:
          items.length === 0 ? "運用中のブログがまだ 1 本もありません。" : null,
      });
    },
  };
}

export type GetManagedSiteInput = { readonly siteSlug: string };
export type GetManagedSiteOutput = {
  readonly summary: ManagedSiteSummary;
  readonly blueprint: SiteBlueprint;
  readonly routes: readonly SiteRoute[];
  /** 差別化の 10 軸。空欄があれば画面で指摘する。 */
  readonly axes: readonly { readonly key: string; readonly label: string; readonly value: string }[];
};

/** ブログ 1 本の設計図。 */
export function createGetManagedSiteUseCase(
  deps: ManageSitesDeps,
): UseCase<GetManagedSiteInput, GetManagedSiteOutput> {
  guardEditorial(deps);
  return {
    async execute(
      _actor: ActorContext,
      input: GetManagedSiteInput,
    ): Promise<Result<GetManagedSiteOutput, DomainError>> {
      const found = await deps.sites.findBySlug(input.siteSlug);
      if (!found.ok) return found;
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "このブログが見つかりません。", {
            suggestedAction: "ブログの一覧から選び直してください。",
          }),
        );
      }
      const blueprint = found.value;
      const axes = Object.entries(blueprint.differentiation).map(([key, value]) => ({
        key,
        label: DIFFERENTIATION_AXIS_LABEL[key] ?? key,
        value: String(value),
      }));
      return ok({
        summary: summarize(input.siteSlug, blueprint),
        blueprint,
        routes: routesFor(blueprint),
        axes,
      });
    },
  };
}

export type SiteDifferentiationPair = {
  readonly a: string;
  readonly b: string;
  readonly aName: string;
  readonly bName: string;
  readonly differentAxisLabels: readonly string[];
  readonly sufficient: boolean;
};

export type CheckSiteDifferentiationOutput = {
  readonly pairs: readonly SiteDifferentiationPair[];
  readonly insufficientCount: number;
  readonly emptyReason: string | null;
};

/**
 * ブログどうしが十分に違うかを総当たりで見る。
 *
 * 同じ商品を扱うブログを増やすときに、ここが「不足」のままだと
 * 言い換え記事の量産になる。増やす前に画面で気づけるようにする。
 */
export function createCheckSiteDifferentiationUseCase(
  deps: ManageSitesDeps,
): UseCase<Record<string, never>, CheckSiteDifferentiationOutput> {
  guardEditorial(deps);
  return {
    async execute(): Promise<Result<CheckSiteDifferentiationOutput, DomainError>> {
      const listed = await deps.sites.list();
      if (!listed.ok) return listed;
      const sites = listed.value;
      const pairs: SiteDifferentiationPair[] = [];
      for (let i = 0; i < sites.length; i += 1) {
        for (let j = i + 1; j < sites.length; j += 1) {
          const left = sites[i];
          const right = sites[j];
          if (left === undefined || right === undefined) continue;
          const gap = differentiationGap(
            left.blueprint.differentiation,
            right.blueprint.differentiation,
          );
          pairs.push({
            a: left.slug,
            b: right.slug,
            aName: left.blueprint.name,
            bName: right.blueprint.name,
            differentAxisLabels: gap.differentAxes.map(
              (k) => DIFFERENTIATION_AXIS_LABEL[k] ?? k,
            ),
            sufficient: gap.sufficient,
          });
        }
      }
      return ok({
        pairs,
        insufficientCount: pairs.filter((p) => !p.sufficient).length,
        emptyReason:
          pairs.length === 0
            ? "ブログが 1 本しかないため、比べる相手がありません。"
            : null,
      });
    },
  };
}
