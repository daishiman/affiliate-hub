import type { PortResult } from "@/application/ports/common";
import {
  SITE_COMPOSITION_ELEMENTS,
  SITE_COMPOSITION_LABEL,
  SITE_COMPOSITION_SEVERITY,
  type CompositionCounts,
  type CompositionReport,
  type SiteCompositionElement,
  type SiteCompositionGap,
  siteHostname,
} from "@/domain/authoring";
import {
  type ActorContext,
  type DomainError,
  type Result,
  assertWorkspaceWideAccess,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 「このブログは本当に読者から開けるのか」を、保存先を数えて答える。
 *
 * **設計図（`getSite`）とは別の口である。** 設計図は「そう作るつもりだった」を
 * 返し、こちらは「実際にそう置かれている」を返す。この 2 つを同じ画面の
 * 同じ節に混ぜていたのが、13 問に答えて緑の成功表示が出るのに
 * `/s/<URL名>` が 404、という食い違いの正体だった。
 *
 * 作成時（`build-site`）と同じ公開投影由来の `CompositionReport` を受け取る。
 * 管理画面用に別の数え方を書かないため、作成判定と画面の警告が分かれない。
 */

export type InspectSiteCompositionDeps = {
  /** 読者面と同じ公開投影から導いたレポート。管理専用の数え直しを持たない。 */
  readonly readComposition: (
    siteSlug: string,
  ) => PortResult<CompositionReport | null>;
  /** 住所の基底ドメイン。無い環境では `null`（パスだけを案内する）。 */
  readonly siteBaseDomain?: string | null;
};

export type SiteCompositionElementView = {
  readonly element: SiteCompositionElement;
  readonly label: string;
  readonly count: number;
  readonly severity: "blocking" | "degrading";
  /** 0 件のときに何をすれば埋まるか。埋まっているときは `null`。 */
  readonly remedy: string | null;
  /** その要素を直す画面。無い（作り直すしかない）ものは `null`。 */
  readonly manageHref: string | null;
};

export type InspectSiteCompositionOutput = {
  readonly slug: string;
  /** 読者が開ける状態か。`false` なら開いても 404 になる。 */
  readonly reachable: boolean;
  /** 必須構成が公開投影にすべて実在するか。到達可能性とは分けて示す。 */
  readonly provisioningComplete: boolean;
  readonly contentReady: boolean;
  /** パスでの住所。基底ドメインの有無に関わらず常に開ける。 */
  readonly readerPath: string;
  /** サブドメインでの住所。基底ドメイン未設定なら `null`。 */
  readonly readerHost: string | null;
  readonly counts: CompositionCounts;
  readonly gaps: readonly SiteCompositionGap[];
  /** 5 要素すべて。埋まっているものも出す（何があるかが見えないと直せない）。 */
  readonly elements: readonly SiteCompositionElementView[];
};

export type InspectSiteCompositionInput = { readonly siteSlug: string };

/** 要素ごとの直し先。`null` は「作り直す以外に無い」の意味。 */
function manageHref(element: SiteCompositionElement, slug: string): string | null {
  const site = encodeURIComponent(slug);
  switch (element) {
    case "network_node":
      return null;
    case "fixed_pages":
      return `/admin/sites/${site}/documents`;
    case "layout_bands":
    case "layout_slots":
      // 版面の画面はブログ別ではなく 1 枚。`/admin/blogs/<URL名>/layout` は実在しない。
      // 実在しない行き先を出すと、直しに行った人が 404 を見て「壊れている」と読む。
      return "/admin/blog/layout";
    case "categories":
      return `/admin/sites/${site}/edit`;
    case "articles":
      return "/admin/blog/articles";
  }
}

export function createInspectSiteCompositionUseCase(
  deps: InspectSiteCompositionDeps,
): UseCase<InspectSiteCompositionInput, InspectSiteCompositionOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: InspectSiteCompositionInput,
    ): Promise<Result<InspectSiteCompositionOutput, DomainError>> {
      const scoped = assertWorkspaceWideAccess(actor, "ブログ");
      if (!scoped.ok) return scoped;

      const inspected = await deps.readComposition(input.siteSlug);
      if (!inspected.ok) return inspected;
      if (inspected.value === null) {
        // 他の作業場のブログも「無い」と同じ応答にする。
        // 種類を分けると、返る `code` の違いだけで実在が分かってしまう。
        return err(
          domainError("NOT_FOUND", "このブログが見つかりません。", {
            suggestedAction: "ブログの一覧から選び直してください。",
          }),
        );
      }

      const report = inspected.value;
      const gaps = new Map(report.gaps.map((gap) => [gap.element, gap]));
      const elements = SITE_COMPOSITION_ELEMENTS.map((element) => {
        const gap = gaps.get(element);
        return {
          element,
          label: gap?.label ?? SITE_COMPOSITION_LABEL[element],
          count: report.counts[element],
          severity: gap?.severity ?? SITE_COMPOSITION_SEVERITY[element],
          remedy: gap?.remedy ?? null,
          manageHref: manageHref(element, input.siteSlug),
        };
      });

      return ok({
        slug: input.siteSlug,
        reachable: report.reachable,
        provisioningComplete: report.provisioningComplete,
        contentReady: report.contentReady,
        readerPath: `/s/${input.siteSlug}`,
        readerHost: siteHostname(input.siteSlug, deps.siteBaseDomain ?? null),
        counts: report.counts,
        gaps: report.gaps,
        elements,
      });
    },
  };
}
