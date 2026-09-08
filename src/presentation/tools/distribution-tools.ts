import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCancelPublicationUseCase,
  createExportManualDraftUseCase,
  createGetContentChannelStatusUseCase,
  createGetPublicationUseCase,
  createListChannelsUseCase,
  createListPublicationsUseCase,
  createRegisterChannelConnectionUseCase,
  createSchedulePublicationUseCase,
  createUpdatePublicationUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import {
  createGetPublicationCalendarUseCase,
  createReschedulePublicationUseCase,
} from "@/application/usecases/distribution/publication-calendar";
import {
  createPreparePublishArticleUseCase,
  createPublishArticleUseCase,
} from "@/application/usecases/site/publish-article";
import { ARTICLE_TYPES, type ArticleType } from "@/domain/authoring/article-structure";
import { RELATIONSHIP_LABEL, type RelationshipType } from "@/domain/compliance/disclosure";
import { CHANNEL_CAPABILITIES, type ChannelKind } from "@/domain/distribution/channel";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 配信の道具。
 *
 * **「note へ投稿する」道具はここに無い。** note には公開された投稿の
 * 仕組みが無く、下書きの書き出しまでしか行えないため。
 * 道具の名前で「できる」と誤解させないよう、書き出しは
 * `export_manual_draft`（書き出し）という名前にしている。
 */
export function distributionTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const distribution = {
    connections: deps.channelConnections,
    connectors: deps.channelConnectors,
    publications: deps.publications,
    manualExport: deps.manualExport,
    variants: deps.contentVariants,
    contentPackages: deps.contentPackages,
    ids: deps.ids,
    auditLog: deps.auditLog,
  };
  const calendar = {
    publications: deps.publications,
    connections: deps.channelConnections,
    contentVariants: deps.contentVariants,
    contentPackages: deps.contentPackages,
    events: deps.events,
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  // 自分のブログへ出す口。画面（配信の詳細）と同じユースケースをここへも載せる。
  // 載せないと「画面からは出せるが AI からは出せない」が生まれ、
  // どちらが正しい手順なのかが説明できなくなる。
  const ownSite = {
    sites: deps.sites,
    packages: deps.contentPackages,
    variants: deps.contentVariants,
    publications: deps.publications,
    articles: deps.publishedArticles,
    // 成果リンクの引き当ても両方に配る。片方だけにすると
    // 「AI から出した記事にだけ成果リンクが 1 件も出ない」が生まれ、
    // 記事としては成立して見えるので画面からは気づけない。
    offers: deps.articleOffers,
    // 記録は画面と道具の両方に配る。片方だけにすると
    // 「AI から出したときだけ誰がやったか残らない」が生まれる。
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  const publicationId = z.string().min(1);

  return [
    defineTool({
      name: "list_channels",
      description:
        "出し先の一覧を、接続の状態・文字数の上限・広告表記の置き場所つきで返します。自動投稿できない先はその理由を返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListChannelsUseCase(distribution),
    }),
    defineTool({
      name: "register_channel_connection",
      description:
        "事前に安全な保管先へ登録した認証情報の参照名を、workspace共通の外部媒体接続として登録します。秘密の値そのものは受け付けません。",
      schema: z.object({
        channelKind: z.enum(Object.keys(CHANNEL_CAPABILITIES) as [ChannelKind, ...ChannelKind[]]),
        accountLabel: z.string().min(1),
        credentialRef: z.string().min(1),
        expiresAt: z.string().optional(),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createRegisterChannelConnectionUseCase(distribution),
    }),
    defineTool({
      name: "list_publications",
      description: "直近の配信と、手当てが要るもの（失敗・貼り付け待ち）を返します。",
      schema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      readOnly: true,
      useCase: createListPublicationsUseCase(distribution),
    }),
    defineTool({
      name: "get_publication",
      description: "配信 1 件の状態と、そこから進められる先を返します。",
      schema: z.object({ publicationId }),
      readOnly: true,
      useCase: createGetPublicationUseCase(distribution),
    }),
    defineTool({
      name: "export_manual_draft",
      description:
        "公式の投稿の仕組みが無い先（note）向けに、貼り付け用の下書きを書き出します。投稿は行いません。誰がいつ書き出したかを記録に残します。",
      schema: z.object({ publicationId }),
      /*
       * **読み取り専用ではない。** 投稿はしないが、
       * 「誰が本文を持ち出したか」を記録に残す（仕様書 §7 の必須記録対象）。
       * 記録は状態の変更なので、`readOnly: true` は事実と違う。
       *
       * ここが `true` だったあいだ、この道具は WebMCP に載っていた。
       * つまり**ページ内の AI が記事の本文を丸ごと取り出せて、
       * その痕跡がどこにも残らなかった**。
       *
       * なお 2026-08-21 以降、**この旗は掲載を決めていない**。
       * 載る／載らないは `webmcp-policy.ts` の `PAGE_TOOLS` に名前があるかだけで決まる
       * （`WEBMCP_LISTED_TOOLS`）。ここを `false` にしておくのは、
       * MCP の `readOnlyHint` を事実に合わせるためと、
       * `isToolAllowedForScope()` が同一オリジンの呼び出しへ書き込みを許さないためである。
       */
      readOnly: false,
      useCase: createExportManualDraftUseCase(distribution),
    }),
    defineTool({
      name: "schedule_publication",
      description:
        "承認済みの記事を、指定した先へ出す配信を作ります。承認前の記事は断ります。同じ記事・同じ先・同じ時刻の要求は 1 件にまとめます。実際の投稿は配信の進行で行われます。",
      schema: z.object({
        variantId: z.string().min(1),
        // 出し先は登録表から列挙する。手で並べると、チャネルを 1 つ足した日に
        // 道具だけが古くなり、「その先は選べません」と断る理由が説明できなくなる。
        channelKind: z.enum(
          Object.keys(CHANNEL_CAPABILITIES) as [ChannelKind, ...ChannelKind[]],
        ),
        connectionId: z.string().min(1).optional(),
        // 日時は文字列で受ける。Date は JSON Schema に写せず、道具一覧が作れなくなる。
        scheduledAt: z.string().optional(),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createSchedulePublicationUseCase(distribution),
    }),
    defineTool({
      name: "update_publication",
      description:
        "まだ送っていない配信の送り先と時刻を直します。文面はここでは直せません（記事の側を直すと反映されます）。送信中・送信済みの配信は直せません。",
      schema: z.object({
        publicationId,
        channelKind: z
          .enum(Object.keys(CHANNEL_CAPABILITIES) as [ChannelKind, ...ChannelKind[]])
          .optional(),
        // 空文字は「予約を外して即時にする」。日時は文字列で受ける
        // （Date は JSON Schema に写せず、道具一覧が作れなくなる）。
        scheduledAt: z.string().optional(),
      }),
      /*
       * **承認を課さない。** 隣の `schedule_publication` とは可逆性が違う。
       * あちらは「外へ出る予定を新しく作る」操作で、作られた時点から
       * 進行が始まる。こちらはすでに在る予定の宛先と時刻を直すだけで、
       * 送信前のものにしか届かない（`ALREADY_LEFT` で断る）。
       * 直し間違えても、もう一度直せるか取りやめられる。
       */
      readOnly: false,
      useCase: createUpdatePublicationUseCase(distribution),
    }),
    defineTool({
      name: "get_content_channel_status",
      description:
        "記事 1 本について、全ての配信先の状態を返します。まだ出していない先も「未着手」として必ず 1 行返します。失敗している先には理由が付きます。",
      schema: z.object({ variantId: z.string().min(1) }),
      readOnly: true,
      useCase: createGetContentChannelStatusUseCase(distribution),
    }),
    defineTool({
      name: "cancel_publication",
      description: "予定していた配信を取りやめます。人の操作でのみ実行できます。",
      schema: z.object({ publicationId }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createCancelPublicationUseCase(distribution),
    }),
    defineTool({
      name: "get_publication_calendar",
      description:
        "指定した月の投稿予定を日付ごとに返します。同じ日に同じ媒体へ寄っている、承認前のまま予約されている、失敗したまま止まっている、を日付つきで知らせます。",
      schema: z.object({ month: z.string().optional() }),
      readOnly: true,
      useCase: createGetPublicationCalendarUseCase(calendar),
    }),
    defineTool({
      name: "reschedule_publication",
      description:
        "配信の予定日時を変えます。過去の日時は指定できません。人の操作でのみ実行できます。",
      schema: z.object({ publicationId, scheduledAt: z.string() }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createReschedulePublicationUseCase(calendar),
    }),
    defineTool({
      name: "prepare_publish_article",
      description:
        "自分のブログへ出す前に必要な選択肢（記事の種類ごとの原稿の欄・出し先のブログとカテゴリー・広告表記の文）と、もとの記事から写した初期値を返します。何も出しません。",
      schema: z.object({ publicationId }),
      readOnly: true,
      useCase: createPreparePublishArticleUseCase(ownSite),
    }),
    defineTool({
      name: "publish_article_to_own_site",
      description:
        "承認済みの記事を、自分のブログの読者ページへ出します。書き手・広告表記・次に見直す日・根拠がそろっていないものは断ります。自社サイト向けの配信でだけ使えます。人の操作でのみ実行できます。",
      schema: z.object({
        publicationId,
        siteSlug: z.string().min(1),
        categorySlug: z.string().min(1),
        // 種類は構成表から列挙する。手で並べると、種類を 1 つ足した日に
        // 道具だけが古くなり、画面と選べるものが食い違う。
        articleType: z.enum(ARTICLE_TYPES as unknown as [ArticleType, ...ArticleType[]]),
        slug: z.string().min(1),
        title: z.string().min(1),
        conclusion: z.string().min(1),
        authorName: z.string().min(1),
        authorBio: z.string(),
        authorCredentials: z.array(z.string()).default([]),
        // 広告との関係は、表示文の正本の鍵から列挙する。
        relationshipType: z
          .enum(
            Object.keys(RELATIONSHIP_LABEL) as [RelationshipType, ...RelationshipType[]],
          )
          .nullable()
          .default(null),
        disclosureMessage: z.string(),
        // 日付は文字列で受ける。Date は JSON Schema に写せず、道具一覧が作れなくなる。
        nextReviewOn: z.string().nullable().default(null),
        claims: z
          .array(
            z.object({
              statement: z.string().min(1),
              sourceLabel: z.string(),
              sourceUrl: z.string().nullable().default(null),
              checkedOn: z.string(),
            }),
          )
          .default([]),
        sectionBodies: z.record(z.string(), z.string()).default({}),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createPublishArticleUseCase(ownSite),
    }),
  ];
}
