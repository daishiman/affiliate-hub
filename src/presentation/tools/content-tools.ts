import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createGetContentUseCase,
  createListContentBoardUseCase,
  createListReviewOverdueUseCase,
} from "@/application/usecases/content/manage-content";
import { CONTENT_STATES } from "@/domain/authoring";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 記事を運ぶ道具。
 *
 * **承認と状態変更は `requiresHumanApproval: true`。**
 * AI サービスアカウントから呼ばれた時点で入口で止まる（`invokeTool`）。
 * さらに domain の `transition` / `approveVariant` でも止まる。
 * 二重にしているのは、入口を 1 つ足したときに片方の守りを付け忘れても
 * もう一方が残るようにするため。
 */
export function contentTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const content = {
    packages: deps.contentPackages,
    variants: deps.contentVariants,
    personas: deps.personas,
    events: deps.events,
  };
  const variantId = z.string().min(1);
  const state = z.enum(CONTENT_STATES);

  return [
    defineTool({
      name: "list_content_board",
      description: "記事を進行の段階ごとに並べて返します。段階ごとに進める先も返します。",
      schema: z.object({ limitPerState: z.number().int().min(1).max(50).optional() }),
      readOnly: true,
      useCase: createListContentBoardUseCase(content),
    }),
    defineTool({
      name: "get_content",
      description:
        "記事 1 本の本文と、17 項目の自動確認の結果を返します。確認しなかった項目も理由つきで返します。",
      schema: z.object({ variantId }),
      readOnly: true,
      useCase: createGetContentUseCase(content),
    }),
    defineTool({
      name: "list_review_overdue",
      description: "見直しの期日を過ぎた公開済み記事を返します。",
      schema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      readOnly: true,
      useCase: createListReviewOverdueUseCase(content),
    }),
    defineTool({
      name: "advance_content_state",
      description:
        "記事の段階を進めます。承認・公開予約・公開へは人の操作が必要です（AI からは実行できません）。",
      schema: z.object({ variantId, from: state, to: state }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createAdvanceContentStateUseCase(content),
    }),
    defineTool({
      name: "approve_content",
      description: "記事を承認します。人の操作でのみ実行できます。",
      schema: z.object({ variantId }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createApproveContentUseCase(content),
    }),
  ];
}
