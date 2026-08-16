import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCheckSiteDifferentiationUseCase,
  createGetManagedSiteUseCase,
  createListManagedSitesUseCase,
} from "@/application/usecases/site/manage-sites";
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
