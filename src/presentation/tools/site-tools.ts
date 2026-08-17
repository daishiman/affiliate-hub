import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createGetArticleUseCase,
  createGetPersonUseCase,
  createGetPolicyDocumentUseCase,
  createGetSiteUseCase,
  createListByCategoryUseCase,
  createListCorrectionsUseCase,
  createListRecentArticlesUseCase,
  createListSitesUseCase,
  createSearchArticlesUseCase,
} from "@/application/usecases/site/read-site";
import {
  createGetReaderToolUseCase,
  createListReaderToolsUseCase,
  createListShortlistUseCase,
  createRemoveFromShortlistUseCase,
  createRunReaderToolUseCase,
  createSaveToShortlistUseCase,
  createSubmitContactUseCase,
} from "@/application/usecases/site/reader-interaction";
import type { AnyToolDefinition } from "./tool-definition";
import { defineTool } from "./define-tool";

/**
 * ブログ側のツール。
 *
 * **画面が呼ぶユースケースと同じものをそのまま載せている。**
 * 「読者が画面でできること」と「AI が道具でできること」を一致させるため、
 * ここに専用の処理は 1 行も書かない。書いた時点で両者はずれ始める。
 *
 * 読み取りは `readOnly: true`（ページ内の AI にも渡してよい）。
 * 状態を変えるものは false にし、問い合わせの送信だけは
 * 人の操作を要求する（AI が勝手に運営者へ送らないようにする）。
 */

const siteSlug = z.string().min(1);

export function siteTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const site = { sites: deps.sites, content: deps.publishedContent };
  const reader = {
    shortlist: deps.shortlist,
    readerTools: deps.readerTools,
    contact: deps.contact,
  };

  return [
    defineTool({
      name: "get_site",
      description: "ブログ 1 本の設計図（目的・カテゴリー・出す画面の一覧）を返します。",
      schema: z.object({ siteSlug }),
      readOnly: true,
      useCase: createGetSiteUseCase(site),
    }),
    defineTool({
      name: "list_sites",
      description: "運用中のブログの一覧を返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListSitesUseCase(site),
    }),
    defineTool({
      name: "list_recent_articles",
      description: "そのブログの新着記事を返します。報酬額は含みません。",
      schema: z.object({ siteSlug, limit: z.number().int().min(1).max(50).optional() }),
      readOnly: true,
      useCase: createListRecentArticlesUseCase(site),
    }),
    defineTool({
      name: "list_articles_by_category",
      description: "カテゴリー内の記事を返します。0 件でも失敗にしません。",
      schema: z.object({ siteSlug, categorySlug: z.string().min(1) }),
      readOnly: true,
      useCase: createListByCategoryUseCase(site),
    }),
    defineTool({
      name: "get_article",
      description:
        "公開済みの記事 1 本を、根拠・事実と推測の区別・広告表示の要否まで含めて返します。",
      schema: z.object({ siteSlug, slug: z.string().min(1) }),
      readOnly: true,
      useCase: createGetArticleUseCase(site),
    }),
    defineTool({
      name: "search_articles",
      description: "そのブログの公開記事を言葉で探します。0 件は失敗ではありません。",
      schema: z.object({ siteSlug, query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
      readOnly: true,
      useCase: createSearchArticlesUseCase(site),
    }),
    defineTool({
      name: "get_person",
      description: "書き手または監修者の紹介と、その人が関わった記事を返します。",
      schema: z.object({ siteSlug, kind: z.enum(["author", "expert"]), slug: z.string().min(1) }),
      readOnly: true,
      useCase: createGetPersonUseCase(site),
    }),
    defineTool({
      name: "list_corrections",
      description: "公開後に訂正した箇所と、その理由の一覧を返します。",
      schema: z.object({ siteSlug }),
      readOnly: true,
      useCase: createListCorrectionsUseCase(site),
    }),
    defineTool({
      name: "get_policy_document",
      description:
        "評価方法・編集方針・広告に関する方針・AI の使い方などの固定文書を返します。",
      schema: z.object({ siteSlug, key: z.string().min(1) }),
      readOnly: true,
      useCase: createGetPolicyDocumentUseCase(site),
    }),

    // --- 読者が自分で操作するもの -------------------------------------------
    defineTool({
      name: "list_shortlist",
      description: "読者が保存した「気になる商品」の一覧を返します。",
      schema: z.object({ siteSlug, readerKey: z.string().min(1).optional() }),
      readOnly: true,
      useCase: createListShortlistUseCase(reader),
    }),
    defineTool({
      name: "save_to_shortlist",
      description: "商品を「気になる商品」に保存します。同じ商品を重ねて保存しません。",
      schema: z.object({
        siteSlug,
        readerKey: z.string().min(1).optional(),
        item: z.object({
          productId: z.string().min(1),
          productName: z.string().min(1),
          savedAt: z.string().min(1),
          fromArticleHref: z.string().optional(),
          oneLine: z.string().optional(),
        }),
      }),
      readOnly: false,
      useCase: createSaveToShortlistUseCase(reader),
    }),
    defineTool({
      name: "remove_from_shortlist",
      description: "「気になる商品」から 1 件を外します。",
      schema: z.object({
        siteSlug,
        readerKey: z.string().min(1).optional(),
        productId: z.string().min(1),
      }),
      readOnly: false,
      useCase: createRemoveFromShortlistUseCase(reader),
    }),
    defineTool({
      name: "list_reader_tools",
      description: "そのブログにある診断・計算の道具の一覧を返します。",
      schema: z.object({ siteSlug }),
      readOnly: true,
      useCase: createListReaderToolsUseCase(reader),
    }),
    defineTool({
      name: "get_reader_tool",
      description: "診断・計算の道具 1 つの入力欄と、結果の読み方を返します。",
      schema: z.object({ siteSlug, slug: z.string().min(1) }),
      readOnly: true,
      useCase: createGetReaderToolUseCase(reader),
    }),
    defineTool({
      name: "run_reader_tool",
      description:
        "診断・計算の道具を実行します。計算式が未登録の道具は、その旨を返します（数値を作りません）。",
      schema: z.object({
        siteSlug,
        slug: z.string().min(1),
        values: z.record(z.string(), z.string()),
      }),
      readOnly: true,
      useCase: createRunReaderToolUseCase(reader),
    }),
    defineTool({
      name: "submit_contact",
      description: "ブログの運営者へ問い合わせを送ります。人の操作でのみ実行できます。",
      schema: z.object({
        siteSlug,
        body: z.string().min(1),
        replyTo: z.string().optional(),
        humanCheckToken: z.string().optional(),
      }),
      readOnly: false,
      // 自動送信を運営者へ届かせない。AI サービスアカウントからは呼べない。
      requiresHumanApproval: true,
      useCase: createSubmitContactUseCase(reader),
    }),
  ];
}
