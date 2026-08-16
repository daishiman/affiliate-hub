import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCreateSiteFromDraftUseCase,
  createGetSiteDraftUseCase,
  createListSiteDraftsUseCase,
  createSaveSiteDraftStepUseCase,
  createStartSiteDraftUseCase,
} from "@/application/usecases/site/build-site";
import {
  createCheckSiteDifferentiationUseCase,
  createGetManagedSiteUseCase,
  createListManagedSitesUseCase,
} from "@/application/usecases/site/manage-sites";
import { SITE_WIZARD_STEPS } from "@/domain/authoring";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * プラットフォーム側（運営者向け）の道具。
 *
 * 読者向けの `site-tools.ts` と分けているのは対象が違うから。
 * こちらは「ブログを何本運用していて、どれが公開できない状態か」を見る。
 * 画面 (`/admin/sites`) が呼ぶのと同じユースケースをそのまま載せる。
 */
export function platformTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const sites = { sites: deps.sites };

  return [
    ...siteBuilderTools(deps),
    defineTool({
      name: "list_managed_sites",
      description:
        "運用中のブログの一覧を、パターン・カテゴリー数・公開できない理由つきで返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListManagedSitesUseCase(sites),
    }),
    defineTool({
      name: "get_managed_site",
      description:
        "ブログ 1 本の設計図（差別化の 10 軸・出す画面の一覧・テーマ）を返します。",
      schema: z.object({ siteSlug: z.string().min(1) }),
      readOnly: true,
      useCase: createGetManagedSiteUseCase(sites),
    }),
    defineTool({
      name: "check_site_differentiation",
      description:
        "運用中のブログどうしを総当たりで比べ、差別化が足りない組み合わせを返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createCheckSiteDifferentiationUseCase(sites),
    }),
  ];
}

/**
 * ブログ作成ウィザードの道具 (§16.2)。
 *
 * **画面と同じ 5 つのユースケースをそのまま載せる。**
 * 「AI に手順を聞きながら、人が画面で押す」ことも、
 * 「AI が下書きを進めて、人が最後だけ押す」ことも同じ道具でできる。
 *
 * 最後の `create_site_from_draft` だけ人の操作を必須にしている。
 * ブログを世に出すのは取り消しの効きにくい操作で、
 * 名前も URL も後から気軽には変えられないため。
 */
function siteBuilderTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const builder = { drafts: deps.siteDrafts, ids: deps.ids };

  return [
    defineTool({
      name: "list_site_drafts",
      description: "作りかけのブログ（下書き）の一覧と、それぞれの進み具合を返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListSiteDraftsUseCase(builder),
    }),
    defineTool({
      name: "get_site_draft",
      description:
        "下書き 1 つの 13 段階すべてと、いま入っている答え、まだ埋まっていない段階を返します。",
      schema: z.object({
        draftId: z.string().min(1),
        step: z.enum(SITE_WIZARD_STEPS).optional(),
      }),
      readOnly: true,
      useCase: createGetSiteDraftUseCase(builder),
    }),
    defineTool({
      name: "start_site_draft",
      description: "新しいブログの下書きを始めます。この時点ではまだ公開されません。",
      schema: z.object({}),
      readOnly: false,
      useCase: createStartSiteDraftUseCase(builder),
    }),
    defineTool({
      name: "save_site_draft_step",
      description:
        "下書きの 1 段階を保存します。埋まっていない項目があれば、どこを直せばよいかを返します。",
      schema: z.object({
        draftId: z.string().min(1),
        step: z.enum(SITE_WIZARD_STEPS),
        answers: z.record(z.string(), z.string()),
        categoriesText: z.string().optional(),
        articleTypes: z.array(z.string()).optional(),
      }),
      readOnly: false,
      useCase: createSaveSiteDraftStepUseCase(builder),
    }),
    defineTool({
      name: "create_site_from_draft",
      description:
        "下書きからブログを作ります。作ると読者から見えるようになります。人の操作でのみ実行できます。",
      schema: z.object({ draftId: z.string().min(1) }),
      readOnly: false,
      // 公開は取り消しの効きにくい操作。AI 単独では実行させない。
      requiresHumanApproval: true,
      useCase: createCreateSiteFromDraftUseCase(builder),
    }),
  ];
}
