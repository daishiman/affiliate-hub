import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCancelPublicationUseCase,
  createExportManualDraftUseCase,
  createGetPublicationUseCase,
  createListChannelsUseCase,
  createListPublicationsUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import {
  createGetPublicationCalendarUseCase,
  createReschedulePublicationUseCase,
} from "@/application/usecases/distribution/publication-calendar";
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
    publications: deps.publications,
    manualExport: deps.manualExport,
  };
  const calendar = {
    publications: deps.publications,
    connections: deps.channelConnections,
    contentVariants: deps.contentVariants,
    contentPackages: deps.contentPackages,
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
        "公式の投稿の仕組みが無い先（note）向けに、貼り付け用の下書きを書き出します。投稿は行いません。",
      schema: z.object({ publicationId }),
      readOnly: true,
      useCase: createExportManualDraftUseCase(distribution),
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
  ];
}
