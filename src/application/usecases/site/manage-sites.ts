import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import {
  REVENUE_MODEL_LABEL,
  SITE_PATTERN_LABEL,
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
  assertWorkspaceWideAccess,
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

// ブログパターンと収益モデルの表示名は domain（`@/domain/authoring`）が持つ。
// 作成ウィザードと一覧で別々に持っていたため、
// 同じ収益モデルが「提携販売」と「成果報酬の紹介」の 2 通りに見えていた。

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
  /**
   * 10 軸のうち、書き分けの判断に要る 3 つ (A5)。
   *
   * 一覧に持たせているのは、書き分ける先を選ぶ画面がブログ 1 本ずつ
   * 設計図を引き直さずに済むようにするため。1 本ずつ引くと、
   * 選ぶ本数だけ問い合わせが増え、しかも途中で失敗した 1 本だけ
   * 切り口が空のまま並ぶ。
   *
   * 10 軸すべてを持たせない。選ぶ場で読むのはこの 3 つで、
   * 残り 7 つは設計図の画面で読む。
   */
  readonly differentiation: {
    readonly targetReader: string;
    readonly searchIntent: string;
    readonly conclusionStance: string;
  };
  /** 揃っていない信頼ページ。空でないブログは公開できない。 */
  readonly missingTrustPages: readonly StandardPage[];
  readonly launchBlockedReason: string | null;
};

/**
 * 自分の会社のブログだけに絞る。
 *
 * **運営者向けの読み取りは、必ずここを通す。** 読者向け (`read-site.ts`) と違い、
 * こちらは公開前の設計図・公開できない理由まで見える。絞り忘れると、
 * 同じ役割を持つ別の会社の人が、他社のブログ構成をそのまま読めてしまう。
 *
 * 保管庫のポートは会社を引数に取らない（どの会社のものも同じ 1 つの入れ物にある）。
 * だから絞り込みはこの層の責任になる。ポート側で絞る形に変えるなら、
 * この関数が不要になったことを確かめてから消すこと。
 */
function ownedBy<T extends { readonly blueprint: SiteBlueprint }>(
  actor: ActorContext,
  sites: readonly T[],
): readonly T[] {
  return sites.filter((s) => s.blueprint.workspaceId === actor.workspaceId);
}

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
    differentiation: {
      targetReader: blueprint.differentiation.targetReader,
      searchIntent: blueprint.differentiation.searchIntent,
      conclusionStance: blueprint.differentiation.conclusionStance,
    },
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
    async execute(actor: ActorContext): Promise<Result<ListManagedSitesOutput, DomainError>> {
      const scoped = assertWorkspaceWideAccess(actor, "ブログ");
      if (!scoped.ok) return scoped;
      const listed = await deps.sites.list();
      if (!listed.ok) return listed;
      const items = ownedBy(actor, listed.value).map((s) => summarize(s.slug, s.blueprint));
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
      actor: ActorContext,
      input: GetManagedSiteInput,
    ): Promise<Result<GetManagedSiteOutput, DomainError>> {
      const scoped = assertWorkspaceWideAccess(actor, "ブログ");
      if (!scoped.ok) return scoped;
      const found = await deps.sites.findBySlug(input.siteSlug);
      if (!found.ok) return found;
      const blueprint = found.value;
      // 他社のブログは「無い」と同じ応答にする。エラーの種類を分けると、
      // 返ってくる `code` の違いだけで「その名前は実在する」と分かってしまう。
      if (blueprint === null || blueprint.workspaceId !== actor.workspaceId) {
        return err(
          domainError("NOT_FOUND", "このブログが見つかりません。", {
            suggestedAction: "ブログの一覧から選び直してください。",
          }),
        );
      }
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
    async execute(actor: ActorContext): Promise<Result<CheckSiteDifferentiationOutput, DomainError>> {
      const scoped = assertWorkspaceWideAccess(actor, "ブログ");
      if (!scoped.ok) return scoped;
      const listed = await deps.sites.list();
      if (!listed.ok) return listed;
      // 比べる相手も自分の会社のブログだけ。他社と比べて「似ている」と言われても直せない。
      const sites = ownedBy(actor, listed.value);
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
