import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCreateContentVariantUseCase,
  createDeleteContentVariantUseCase,
  createUpdateContentVariantUseCase,
} from "@/application/usecases/content/edit-content";
import {
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createGetContentUseCase,
  createListContentBoardUseCase,
  createListReviewOverdueUseCase,
} from "@/application/usecases/content/manage-content";
import {
  createCheckFactBoundaryUseCase,
  createGetAudiencePersonaUseCase,
  createGetAuthorPersonaUseCase,
  createListAudiencePersonasUseCase,
  createListAuthorPersonasUseCase,
} from "@/application/usecases/authoring/manage-personas";
import {
  MATRIX_ROW_AXES,
  createGetGenerationMatrixUseCase,
} from "@/application/usecases/authoring/plan-generation-matrix";
import { createReadWritingMethodUseCase } from "@/application/usecases/authoring/read-writing-method";
import { ARTICLE_TYPES, CONTENT_ANGLES, CTA_TYPES } from "@/domain/authoring";
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
    policyRules: deps.policyRules,
    auditLog: deps.auditLog,
    ids: deps.ids,
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
        "記事の段階を進めます。承認・公開予約・公開へは人の操作が必要です（AI からは実行できません）。読者に出ている記事を取り下げるときは理由が必要です（記録に残ります）。",
      // 理由は取り下げのときだけ要るが、**スキーマでは任意にしてある。**
      // 「公開中からの ARCHIVED のときだけ必須」は入力の形では表せず、
      // 無理に表すと道具一覧の JSON Schema が読めなくなる。要否の判断は
      // ユースケース側の 1 か所（`isUnpublishing`）に置く。
      schema: z.object({ variantId, from: state, to: state, reason: z.string().optional() }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createAdvanceContentStateUseCase(content),
    }),
    defineTool({
      name: "approve_content",
      description:
        "記事を承認します。人の操作でのみ実行できます。何を確認したのかを理由として必ず添えます（記録に残ります）。",
      schema: z.object({
        variantId,
        reason: z
          .string()
          .min(1)
          .describe("なぜ承認してよいと判断したか。操作の記録に残ります。"),
      }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createApproveContentUseCase(content),
    }),
    ...contentEditingTools(deps),
    ...personaTools(deps),
    ...generationMatrixTools(deps),
  ];
}

/**
 * 記事の枠を、人の手で作る・直す・消す道具。
 *
 * **AI に書かせる `draft_content_variant` とは別に置く。**
 * 理由は `edit-content.ts` の冒頭に書いてある。
 *
 * 作る・直すは `requiresHumanApproval: false`。**やり直せるため。**
 * 間違えて作った枠は消せるし、直した本文は直し戻せる。
 * 承認済みを直した場合は承認が自動で外れるので、
 * 「誰も読んでいない文章が承認済みのまま進む」ことは起きない。
 */
function contentEditingTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const editing = {
    variants: deps.contentVariants,
    packages: deps.contentPackages,
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  const variantId = z.string().min(1);

  return [
    defineTool({
      name: "create_content_variant",
      description:
        "記事 1 本の枠を作ります。本文の自動生成は行いません（それは draft_content_variant です）。作った直後は自動確認を通していない扱いになります。",
      schema: z.object({
        contentPackageId: z.string().min(1),
        channel: z.string().min(1),
        format: z.string().min(1),
        authorPersonaId: z.string().min(1),
        audiencePersonaId: z.string().min(1),
        angle: z.enum(CONTENT_ANGLES),
        cta: z.enum(CTA_TYPES),
        disclosure: z.string().min(1),
        title: z.string().optional(),
        // 本文は空にできない。空の記事を作れると、業務側の決まりを迂回できる。
        body: z.string().min(1),
        summary: z.string().min(1),
      }),
      readOnly: false,
      useCase: createCreateContentVariantUseCase(editing),
    }),
    defineTool({
      name: "update_content_variant",
      description:
        "記事の題名・本文・要約を直します。承認済みの記事を直すと承認は外れます。公開中の記事は直せません（先に取り下げてください）。",
      schema: z.object({
        variantId,
        title: z.string().optional(),
        body: z.string().min(1).optional(),
        summary: z.string().min(1).optional(),
      }),
      readOnly: false,
      useCase: createUpdateContentVariantUseCase(editing),
    }),
    defineTool({
      name: "delete_content_variant",
      description:
        "記事を消します。公開中の記事は消せません（先に取り下げてください）。人の操作でのみ実行できます。",
      schema: z.object({ variantId, reason: z.string().min(1) }),
      readOnly: false,
      // 本文ごと無くなる。後から中身を確かめる手段が残らない。
      requiresHumanApproval: true,
      useCase: createDeleteContentVariantUseCase(editing),
    }),
  ];
}

/**
 * 生成マトリクスの道具 (§15.4・§22.5)。
 *
 * 読み取り専用。**表を見て決めるのは人**で、AI は表を作るところまで。
 * どの組み合わせを作るかは編集方針そのものなので、AI に決めさせない。
 */
function generationMatrixTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const matrix = {
    packages: deps.contentPackages,
    variants: deps.contentVariants,
    personas: deps.personas,
  };

  return [
    defineTool({
      name: "get_generation_matrix",
      description:
        "企画 1 つの生成マトリクスを返します。行は読者・切り口・購買段階のいずれか、列は媒体です。各セルには、作成済み・今回作る・今回は作らない・その媒体では作れない、のどれかと、その理由が入ります。",
      schema: z.object({
        packageId: z.string().min(1),
        rowAxis: z.enum(MATRIX_ROW_AXES).optional(),
        limit: z.number().int().positive().optional(),
      }),
      readOnly: true,
      useCase: createGetGenerationMatrixUseCase(matrix),
    }),
  ];
}

/**
 * 書き手と読者像の道具。
 *
 * すべて読み取り専用。**ここに保存の道具を置いていないのは意図的で、**
 * 見本の保存先がまだ書き込みを受け付けないため。
 * 「押せるが必ず失敗する」ボタンを AI にも人にも見せない。
 */
function personaTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const personas = { personas: deps.personas };

  return [
    defineTool({
      name: "list_author_personas",
      description:
        "書き手の一覧を返します。文体・使わない言葉・書いてよい事実の範囲と、その書き手にできないことを併せて返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListAuthorPersonasUseCase(personas),
    }),
    defineTool({
      name: "get_author_persona",
      description: "書き手 1 人の設定を返します。",
      schema: z.object({ personaId: z.string().min(1) }),
      readOnly: true,
      useCase: createGetAuthorPersonaUseCase(personas),
    }),
    defineTool({
      name: "list_audience_personas",
      description:
        "読者像の一覧を返します。判断条件・信頼のために必要なもの・決めつけてはいけないことを併せて返します。",
      schema: z.object({}),
      readOnly: true,
      useCase: createListAudiencePersonasUseCase(personas),
    }),
    defineTool({
      name: "get_audience_persona",
      description: "読者像 1 つの設定を返します。",
      schema: z.object({ personaId: z.string().min(1) }),
      readOnly: true,
      useCase: createGetAudiencePersonaUseCase(personas),
    }),
    defineTool({
      name: "check_fact_boundary",
      description:
        "文章がその書き手の書いてよい範囲に収まっているかを調べます。実際に試した記録が無いのに一人称の体験を書いている箇所と、使わないと決めた言葉を指摘します。",
      schema: z.object({
        personaId: z.string().min(1),
        body: z.string().min(1),
      }),
      readOnly: true,
      useCase: createCheckFactBoundaryUseCase(personas),
    }),
    defineTool({
      name: "read_writing_method",
      description:
        "記事の型ごとの節の並び、段落の並べ方、文体の決まり、事実の種類ごとの書き分け、読者の知識量ごとの説明の深さ、会話の決まりを返します。人が書くときも AI に書かせるときも、この 1 つの決めごとを見ます。",
      schema: z.object({
        articleType: z.enum(ARTICLE_TYPES as unknown as [string, ...string[]]).optional(),
      }),
      readOnly: true,
      useCase: createReadWritingMethodUseCase(),
    }),
  ];
}
