import { READER_DISCLOSURE_TEXT } from "@/domain/compliance/disclosure";
import { requireCapability } from "@/domain/identity";
import {
  type ContentPackageId,
  type DomainError,
  type Result,
  assertWorkspaceWideAccess,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import {
  type EditContentDeps,
  createCreateContentVariantUseCase,
} from "./edit-content";
import { assertContentPackageBrandScope } from "./content-brand-access";

/**
 * 1 商品を、選んだブログの数だけ書き分ける (A5)。
 *
 * **切り口を人に入力させない。** ブログの設計図が既に 10 軸の違いを持っており、
 * 画面はそのうち 3 軸をそのまま運んでくる。ここがやるのは
 * 「運ばれてきた切り口を、記事の枠 1 本ずつに写す」ことだけである。
 *
 * 画面側でこの繰り返しを書かない。書くと、ブログを 1 本足すたびに
 * 「何を既定にするか」の判断が画面の数だけ増える。
 *
 * 作るのは**枠**であって文章ではない。文章は `draft_content_variant` が書く。
 * 分けてあるのは `edit-content.ts` に書いた理由と同じで、
 * 生成が返らなかったときに枠だけ残ったのかを履歴から読めるようにするため。
 */

export type ConceptDraftTarget = {
  /** どのブログ向けか。記録に残す名前としてだけ使う。 */
  readonly siteName: string;
  readonly audience: string;
  readonly searchIntent: string;
  readonly stance: string;
};

export type CreateConceptDraftsInput = {
  readonly contentPackageId: string;
  readonly targets: readonly ConceptDraftTarget[];
};

export type CreateConceptDraftsOutput = {
  /**
   * この要求に対応して利用可能になった枠。
   * 再試行時に既存の枠を再利用した場合も含み、同じ枠は1度だけ返す。
   * そのため、永続化後に利用できる異なる枠の集合と意味が一致する。
   */
  readonly created: readonly { readonly variantId: string; readonly siteName: string }[];
};

/**
 * 書き出しの 1 行。
 *
 * 空にしない（業務側が空の本文を断る）。当たり障りのない定型文にもしない——
 * どのブログでも同じ書き出しになると、書き分けたはずの枠が
 * 見分けられなくなる。3 軸をそのまま文にすれば、枠を開いた人が
 * 「このブログでは何を書くはずだったか」を読み返せる。
 */
function openingLine(target: ConceptDraftTarget): string {
  return `${target.audience}に向けて、${target.searchIntent}に答える記事。結論は${target.stance}。`;
}

function normalizeTarget(target: ConceptDraftTarget): ConceptDraftTarget {
  return {
    siteName: target.siteName.normalize("NFC").trim(),
    audience: target.audience.normalize("NFC").trim(),
    searchIntent: target.searchIntent.normalize("NFC").trim(),
    stance: target.stance.normalize("NFC").trim(),
  };
}

/**
 * 企画とブログ別の 4 軸から、概念下書き 1 本の変わらない ID を作る。
 *
 * タイトルは後から編集でき、同名の記事もあり得るので対応キーにしない。
 * 4 軸を JSON の配列にして境界を保ち、SHA-256 で URL に運べる固定長へ縮める。
 * ID は保存済み記事そのものに残るため、プロセス内の記憶に依存しない。
 */
async function conceptDraftVariantId(
  contentPackageId: string,
  target: ConceptDraftTarget,
): Promise<string> {
  const source = JSON.stringify([
    contentPackageId.normalize("NFC").trim(),
    target.siteName,
    target.audience,
    target.searchIntent,
    target.stance,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `cv_concept_${hex}`;
}

export function createCreateConceptDraftsUseCase(
  deps: EditContentDeps,
): UseCase<CreateConceptDraftsInput, CreateConceptDraftsOutput> {
  const createOne = createCreateContentVariantUseCase(deps);

  return {
    async execute(actor, input): Promise<Result<CreateConceptDraftsOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "ブログ別の記事作成");
      if (!allowed.ok) return allowed;

      if (input.targets.length === 0) {
        return err(
          domainError("VALIDATION_FAILED", "書き分ける先が 1 本も選ばれていません。", {
            field: "targets",
            suggestedAction: "ブログを 1 本以上選んでください。",
          }),
        );
      }

      const packageId = taggedString<"ContentPackageId">(
        input.contentPackageId,
      ) as ContentPackageId;
      const pkg = await deps.packages.findById(actor.workspaceId, packageId);
      if (!pkg.ok) return pkg;
      if (pkg.value === null) {
        return err(
          domainError("NOT_FOUND", "この記事のまとまりが見つかりません。", {
            field: "contentPackageId",
          }),
        );
      }
      const scoped = assertContentPackageBrandScope(actor, pkg.value, "記事のまとまり");
      if (!scoped.ok) return err(scoped.error);

      // SiteBlueprint はまだ brandId を持たない。限定担当者へ入力されたブログ名を
      // 担当ブランドのものだと推測して own_site の枠を作らない。
      const siteAccess = assertWorkspaceWideAccess(actor, "書き分け先のブログ");
      if (!siteAccess.ok) return err(siteAccess.error);

      const audiencePersonaId = pkg.value.audiencePersonaIds[0];
      if (audiencePersonaId === undefined) {
        return err(
          domainError("VALIDATION_FAILED", "この企画には読者像が 1 つも設定されていません。", {
            suggestedAction: "先に読者像を選んでください。誰に向けた記事かが決まりません。",
          }),
        );
      }

      const existing = await deps.variants.listByPackage(actor.workspaceId, packageId);
      if (!existing.ok) return existing;
      const availableIds = new Set(existing.value.map((variant) => String(variant.id)));

      /*
       * 途中で失敗したらそこで止める。**続けて残りを作らない。**
       *
       * 3 本のうち 2 本目で断られたのに 3 本目を作ると、画面には
       * 「1 本目と 3 本目がある」という、誰も指示していない結果が残る。
       * 止めれば、押し直したときに続きから作れる（既にある分は
       * 同じ切り口の枠として並ぶので、作り直しにはならない）。
      */
      const created: { readonly variantId: string; readonly siteName: string }[] = [];
      const reportedIds = new Set<string>();
      for (const rawTarget of input.targets) {
        const target = normalizeTarget(rawTarget);
        const variantId = await conceptDraftVariantId(input.contentPackageId, target);
        if (availableIds.has(variantId)) {
          if (!reportedIds.has(variantId)) {
            created.push({ variantId, siteName: target.siteName });
            reportedIds.add(variantId);
          }
          continue;
        }

        const one = await createOne.execute(actor, {
          variantId,
          contentPackageId: input.contentPackageId,
          // 自社ブログ向けの枠として作る。SNS へ出すのは配信側の操作で、
          // ここで先に SNS の枠まで作ると、出すと決めていない下書きが並ぶ。
          channel: "own_site",
          format: "article",
          authorPersonaId: String(pkg.value.authorPersonaId),
          audiencePersonaId: String(audiencePersonaId),
          angle: pkg.value.contentAngles[0] ?? "conclusion_first",
          cta: "read_detail",
          disclosure: READER_DISCLOSURE_TEXT.body,
          title: `${target.siteName}｜${target.stance}`,
          body: openingLine(target),
          summary: openingLine(target),
        });
        if (!one.ok) return err(one.error);
        availableIds.add(variantId);
        reportedIds.add(variantId);
        created.push({ variantId: one.value.variantId, siteName: target.siteName });
      }

      return ok({ created });
    },
  };
}
