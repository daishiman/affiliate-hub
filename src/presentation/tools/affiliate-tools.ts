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
import {
  createDisableAffiliateLinkUseCase,
  createListAffiliateLinksUseCase,
} from "@/application/usecases/monetization/manage-affiliate-links";
import {
  createListLinkInboxUseCase,
  createMatchLinkIngestionUseCase,
  createRejectLinkIngestionUseCase,
  createResolveLinkIngestionUseCase,
  createSubmitAffiliateUrlUseCase,
} from "@/application/usecases/monetization/manage-link-inbox";
import { createRegisterAffiliateLinkUseCase } from "@/application/usecases/monetization/register-affiliate-link";
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
    ids: deps.ids,
    // 記録は画面と道具の両方に配る。片方だけにすると
    // 「AI から出したときだけ誰がやったか残らない」が生まれる。
    auditLog: deps.auditLog,
    now: () => new Date(),
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
      name: "list_affiliate_links",
      description:
        "登録済みの成果リンクを、読者に出ている商品名と状態（出ている・止めた・期限切れ）つきで返します。ASP が発行した URL は接続先だけを返し、全体は返しません。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListAffiliateLinksUseCase(affiliate),
    }),
    defineTool({
      name: "disable_affiliate_link",
      /*
        **人の操作でのみ実行できる。** 止めると読者に出なくなり、元へは戻せない
        （戻すには新しいリンクとして登録し直す）。AI が「表記が古そうだ」と
        判断して止められると、実際には正しかったリンクが消え、
        記事から成果リンクが静かに減っていく。減ったことは画面に出ない。
      */
      description:
        "登録済みの成果リンクを止めます。記事に貼ったままでも公開のときに読者へ出なくなります。行は消えないので、いつまで出ていたかは後から辿れます。元へは戻せません。理由は必須で、記録に残ります。人の操作でのみ実行できます。",
      schema: z.object({
        affiliateLinkId: z.string().min(1),
        reason: z.string().min(1),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createDisableAffiliateLinkUseCase(affiliate),
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
    ...linkInboxTools(deps),
  ];
}

/**
 * 成果リンク受信箱の道具。
 *
 * 読むものだけ AI から使える。**広告主の確定と商品との結びつけは人の操作だけ。**
 * ここを AI に任せると、間違った広告主に結びついたリンクが記事に載り、
 * 誰がいつそう決めたのかを後から辿れなくなる。
 */
function linkInboxTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const inbox = {
    inbox: deps.linkInbox,
    programs: deps.affiliatePrograms,
    ids: deps.ids,
    events: deps.events,
    // 記録は画面と道具の両方に配る。片方だけにすると
    // 「AI から出したときだけ誰がやったか残らない」が生まれる。
    auditLog: deps.auditLog,
    now: () => new Date(),
  };

  return [
    defineTool({
      name: "list_link_inbox",
      description:
        "貼り付けられた成果リンクの受信箱を返します。状態（未調査・広告主判明・結びつけ済み・対象外）ごとの件数と、重複している件数も返します。",
      schema: z.object({
        state: z.enum(["all", "received", "resolved", "matched", "rejected"]).optional(),
      }),
      readOnly: true,
      useCase: createListLinkInboxUseCase(inbox),
    }),
    defineTool({
      name: "submit_affiliate_url",
      description:
        "成果リンクの URL を受信箱に入れます。内部ネットワーク宛の URL は受け取りません。同じ URL が既にある場合も捨てずに受け取り、重複として印を付けます。人の操作でのみ実行できます。",
      schema: z.object({
        url: z.string().min(1),
        source: z.enum(["paste", "csv", "api", "extension", "webmcp"]),
        note: z.string().optional(),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createSubmitAffiliateUrlUseCase(inbox),
    }),
    defineTool({
      name: "resolve_link_ingestion",
      description:
        "受信箱のリンクについて、どの提携プログラムのものかを確定します。人の操作でのみ実行できます。",
      schema: z.object({
        linkIngestionId: z.string().min(1),
        programId: z.string().min(1),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createResolveLinkIngestionUseCase(inbox),
    }),
    defineTool({
      name: "match_link_ingestion_product",
      description:
        "受信箱のリンクを商品に結びつけます。広告主が確定していないリンクは結びつけられません。人の操作でのみ実行できます。",
      schema: z.object({
        linkIngestionId: z.string().min(1),
        productId: z.string().min(1),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createMatchLinkIngestionUseCase(inbox),
    }),
    defineTool({
      name: "register_affiliate_link",
      description:
        "商品まで決まった受信箱のリンクを、記事に出せる成果リンクとして登録します。商品名は ASP の管理画面の表記をそのまま指定し、人が確認して実行します。",
      schema: z.object({
        linkIngestionId: z.string().min(1),
        productName: z.string().min(1),
        brand: z.string().optional(),
        oneLine: z.string().optional(),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createRegisterAffiliateLinkUseCase({
        inbox: deps.linkInbox,
        links: deps.affiliateLinks,
        ids: deps.ids,
        auditLog: deps.auditLog,
        now: () => new Date(),
      }),
    }),
    defineTool({
      name: "reject_link_ingestion",
      description:
        "受信箱のリンクを対象外にします。理由は必須です。人の操作でのみ実行できます。",
      schema: z.object({
        linkIngestionId: z.string().min(1),
        reason: z.string().min(1),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createRejectLinkIngestionUseCase(inbox),
    }),
  ];
}
