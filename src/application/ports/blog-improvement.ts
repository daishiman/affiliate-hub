import type { AnswerUnit, SiteAeoProfile } from "@/domain/aeo";
import type { SeoFinding } from "@/domain/seo";
import type { Editorial, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * SEO / AEO の診断と反映 (改善層) のポート。
 *
 * この層は公開面を直接書かない (AD-3)。診断から作れるのは**下書き**までで、
 * そこから先は既存の記事編集・承認経路が担う。自動反映は速いが、誤った
 * 指摘がそのまま読者へ出る。読者に見えるものを機械の判断だけで変えない、
 * という線をポートの形で引いておく。
 *
 * 全体が Editorial 印なのは、診断が報酬を入力にしないためである。
 * 「報酬の高い記事から直す」は編集判断ではなく、この層の外の話になる。
 */

/** 診断を回す対象。ブログ全体か、記事 1 本か。 */
export type AssessmentTarget =
  | { readonly kind: "site"; readonly siteSlug: string }
  | { readonly kind: "article"; readonly siteSlug: string; readonly articleSlug: string };

/** 診断 1 回の結果。 */
export type AssessmentRun = {
  readonly findings: readonly SeoFinding[];
  /** 診断した記事の本数。0 本なら「指摘なし」ではなく「対象なし」。 */
  readonly assessedArticles: number;
  readonly ranAt: Date;
};

export type SeoAssessmentPort = {
  /**
   * 診断を回す。既存の指摘は同じ観点なら置き換える。
   *
   * 積み増さないのは、同じ指摘が何度も並ぶと、運用者が「対応しない」と
   * 決めた判断まで毎回流されるためである。
   */
  assess(workspaceId: WorkspaceId, target: AssessmentTarget): PortResult<AssessmentRun>;
  /** 未対応の指摘を、出す順 (`rankFindings` の順) で返す。 */
  listOpen(workspaceId: WorkspaceId, siteSlug: string): PortResult<readonly SeoFinding[]>;
  /**
   * 指摘から下書きを作る。
   *
   * 戻り値は作った改訂の id で、**公開はしない**。呼び出し側は
   * この id を既存の編集画面へ渡す。
   */
  draftFix(
    workspaceId: WorkspaceId,
    findingId: string,
  ): PortResult<{ readonly draftRevisionId: string }>;
  /** 「これは直さない」と記録する。理由は必須。 */
  dismiss(workspaceId: WorkspaceId, findingId: string, reason: string): PortResult<true>;
};

/** AEO の構えと、記事から抽出した引用単位。 */
export type AeoProfilePort = {
  get(workspaceId: WorkspaceId, siteSlug: string): PortResult<SiteAeoProfile | null>;
  save(workspaceId: WorkspaceId, profile: SiteAeoProfile): PortResult<SiteAeoProfile>;
};

export type AnswerUnitPort = {
  /**
   * 記事から引用単位を抽出し直す。既存の単位は同じ問いなら置き換える。
   *
   * 抽出が 0 件なのは失敗ではない。「引用できる形になっていない」という
   * 結果であり、それ自体が改善層の出す答えである。
   */
  extract(
    workspaceId: WorkspaceId,
    siteSlug: string,
    articleSlug: string,
  ): PortResult<readonly AnswerUnit[]>;
  listForSite(workspaceId: WorkspaceId, siteSlug: string): PortResult<readonly AnswerUnit[]>;
  listForArticle(
    workspaceId: WorkspaceId,
    siteSlug: string,
    articleSlug: string,
  ): PortResult<readonly AnswerUnit[]>;
};

export type EditorialSeoAssessmentPort = Editorial<SeoAssessmentPort>;
export type EditorialAeoProfilePort = Editorial<AeoProfilePort>;
export type EditorialAnswerUnitPort = Editorial<AnswerUnitPort>;
