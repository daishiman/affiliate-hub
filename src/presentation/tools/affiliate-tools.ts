import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createAdjustConversionUseCase,
  createGetConversionUseCase,
  createListAffiliateAccountsUseCase,
  createListAffiliateProgramsUseCase,
  createListConversionsUseCase,
  createListProductLinksUseCase,
} from "@/application/usecases/monetization/manage-affiliate";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 提携と成果の道具。
 *
 * **ここで返る報酬額は、順位づけの道具からは決して見えない。**
 * 順位づけのユースケースは編集用の印が付いたつなぎ目しか受け取らないため、
 * この道具が使うつなぎ目を渡そうとするとコンパイルが通らない。
 *
 * 金額の修正は人の操作でのみ行える。AI が売上の数字を書き換えられると、
 * 後から誤りを見つけられなくなる。
 */
export function affiliateTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const affiliate = {
    accounts: deps.affiliateAccounts,
    programs: deps.affiliatePrograms,
    links: deps.affiliateLinks,
    conversions: deps.conversions,
  };
  const period = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "会計期間は 2026-08 のような形式で指定してください。");

  return [
    defineTool({
      name: "list_affiliate_accounts",
      description:
        "提携先（ASP）の一覧を返します。接続情報が登録されているかどうかだけを返し、その値は決して返しません。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListAffiliateAccountsUseCase(affiliate),
    }),
    defineTool({
      name: "list_affiliate_programs",
      description:
        "提携しているプログラムの一覧を、報酬の決め方・承認率・人が確認すべき掲載条件つきで返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListAffiliateProgramsUseCase(affiliate),
    }),
    defineTool({
      name: "list_conversions",
      description:
        "指定した会計期間の成果を返します。取り込んだ金額と手で直した金額を分けて返し、確定分だけを合計します。",
      schema: z.object({ period }),
      readOnly: true,
      useCase: createListConversionsUseCase(affiliate),
    }),
    defineTool({
      name: "get_conversion",
      description:
        "成果 1 件の内訳と、金額を直せるかどうか（直せない場合はその理由）を返します。",
      schema: z.object({ conversionId: z.string().min(1) }),
      readOnly: true,
      useCase: createGetConversionUseCase(affiliate),
    }),
    defineTool({
      name: "list_product_links",
      description:
        "商品につながる提携リンクを返します。URL は発行されたままの形で返し、印を足しません。",
      schema: z.object({ productId: z.string().min(1) }),
      readOnly: true,
      useCase: createListProductLinksUseCase(affiliate),
    }),
    defineTool({
      name: "adjust_conversion_reward",
      description:
        "成果の金額を手で直します。人の操作でのみ実行できます。取り込んだ金額は残したままにします。",
      schema: z.object({
        conversionId: z.string().min(1),
        amountMinor: z.number().int().min(0),
        currency: z.enum(["JPY", "USD"]),
        reason: z.string().min(1),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createAdjustConversionUseCase(affiliate),
    }),
  ];
}
