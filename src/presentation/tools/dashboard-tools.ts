import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import { createGetDashboardUseCase } from "@/application/usecases/dashboard/read-dashboard";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * ホーム画面の道具。
 *
 * 「いま何に手を付ければよいか」を最初に聞かれる問いとして、
 * 画面と AI に同じ答えを返す。画面が `/admin` で見る 11 個の数字と、
 * この道具が返す 11 個は同じユースケースの出力そのもの。
 *
 * 読み取りだけなので WebMCP にも載る。
 * 数字と一緒に「解消できる画面の場所 (href)」も返しているため、
 * AI は「未処理が 3 件あります」で終わらず、行き先まで案内できる。
 */
export function dashboardTools(deps: AppDeps): readonly AnyToolDefinition[] {
  return [
    defineTool({
      name: "get_dashboard",
      description:
        "いま手当てが要るものを 11 個の数字で返します。それぞれに、その数の意味と、解消できる画面の場所が付きます。",
      schema: z.object({}),
      readOnly: true,
      useCase: createGetDashboardUseCase({
        contentVariants: deps.contentVariants,
        products: deps.products,
        publications: deps.publications,
        channelConnections: deps.channelConnections,
        linkInbox: deps.linkInbox,
        affiliateLinks: deps.affiliateLinks,
        conversions: deps.conversions,
      }),
    }),
  ];
}
