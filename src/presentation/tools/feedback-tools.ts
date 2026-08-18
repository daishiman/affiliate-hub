import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import { createHandOffFeedbackUseCase } from "@/application/usecases/feedback/hand-off-feedback";
import { createListFeedbackUseCase } from "@/application/usecases/feedback/list-feedback";
import { createManageIntegrationKeysUseCase } from "@/application/usecases/feedback/manage-integration-keys";
import { createReadFeedbackUseCase } from "@/application/usecases/feedback/read-feedback";
import {
  type SubmitFeedbackInput,
  createSubmitFeedbackUseCase,
} from "@/application/usecases/feedback/submit-feedback";
import { createUpdateFeedbackStatusUseCase } from "@/application/usecases/feedback/update-feedback-status";
import { FEEDBACK_DISPOSITIONS, FEEDBACK_KINDS, FEEDBACK_STATUSES } from "@/domain/feedback";
import { domainError, err, ok } from "@/domain/shared";
import { defineTool, parseWith, toJsonSchema } from "./define-tool";
import type { AnyToolDefinition, ToolDefinition } from "./tool-definition";

/**
 * 改善要望の道具。
 *
 * ここに置くと、画面（REST）・ページ内 AI（WebMCP）・作業する側（バックエンド MCP）の
 * 3 つに同じものが同時に現れる。**入口ごとに書き分けない。**
 * 書き分けると、画面からは廃棄できるのに取りに来た側からもできる、
 * のような「片方だけ緩い」状態が必ずどこかにできる。
 *
 * 誰が何をできるかは、ここではなくユースケースの先頭（`requireCapability`）で決まる。
 * ページ内 AI へ実際に渡す道具は `webmcp-policy.ts` の一覧が決めるので、
 * 読み取り専用にしただけで自動的に読者ページへ出るわけではない。
 */

const kindSchema = z.enum(FEEDBACK_KINDS);
const statusSchema = z.enum(FEEDBACK_STATUSES);

const originSchema = z.object({
  screenName: z.string().min(1),
  url: z.string().min(1),
  route: z.string().min(1),
  viewportWidth: z.number().int().nonnegative(),
  viewportHeight: z.number().int().nonnegative(),
});

const technicalSchema = z.object({
  jsErrors: z.array(z.string()).max(50).default([]),
  failedRequests: z.array(z.string()).max(50).default([]),
  userAgent: z.string().default(""),
  recentActions: z.array(z.string()).max(50).default([]),
  redactedCount: z.number().int().nonnegative().default(0),
});

/**
 * 画面の写しは base64 で受け取る。
 *
 * **焼き込み済みの 1 枚しか受け取らない。** 元画像と塗りを別々に受け取る形にすると、
 * いつか「あとで重ねればよい」で使われ、黒塗りが隠したことにならなくなる。
 * `redactionsBurnedIn` は送り側の申告だが、ここが false のものは domain が弾く。
 */
const captureSchema = z.object({
  imageBase64: z.string().min(1),
  redactionsBurnedIn: z.boolean(),
  retainsOriginal: z.boolean(),
  redactionCount: z.number().int().nonnegative(),
  maskedElementCount: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
});

const submitSchema = z.object({
  kind: kindSchema,
  body: z.string().min(1),
  wish: z.string().nullable().optional(),
  origin: originSchema,
  technical: technicalSchema,
  brandId: z.string().nullable().optional(),
  siteId: z.string().nullable().optional(),
  capture: captureSchema.nullable().optional(),
});

function decodeBase64(value: string): ArrayBuffer | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return null;
  }
}

/**
 * 送る道具。
 *
 * 画像を運ぶため、入力の変換だけここで行う（base64 → バイト列）。
 * 判断はしない。大きさ・形式・焼き込みの可否は domain が決める。
 */
function submitFeedbackTool(deps: AppDeps): ToolDefinition<SubmitFeedbackInput, unknown> {
  return {
    name: "submit_feedback",
    description:
      "改善要望を送ります。画面名・URL・エラーの記録は自動で付きます。画面の写しは付けても付けなくても送れます。",
    inputSchema: toJsonSchema(submitSchema),
    readOnly: false,
    requiresHumanApproval: false,
    parse: (raw) => {
      const parsed = parseWith(submitSchema)(raw);
      if (!parsed.ok) return parsed;
      const input = parsed.value;
      if (!input.capture) {
        return ok({ ...input, capture: null } as SubmitFeedbackInput);
      }
      const image = decodeBase64(input.capture.imageBase64);
      if (image === null) {
        return err(
          domainError("VALIDATION_FAILED", "画面の写しを読み取れませんでした。", {
            field: "capture",
            suggestedAction: "「画像を外す（文章だけで送る）」を選べば、そのまま送れます。",
          }),
        );
      }
      return ok({
        ...input,
        capture: {
          image,
          submission: {
            redactionsBurnedIn: input.capture.redactionsBurnedIn,
            retainsOriginal: input.capture.retainsOriginal,
            redactionCount: input.capture.redactionCount,
            maskedElementCount: input.capture.maskedElementCount,
            byteLength: image.byteLength,
            mimeType: input.capture.mimeType,
          },
        },
      } as SubmitFeedbackInput);
    },
    useCase: createSubmitFeedbackUseCase({
      repository: deps.feedback,
      captures: deps.feedbackCaptures,
      ids: deps.ids,
      auditLog: deps.auditLog,
      now: () => new Date(),
    }),
  };
}

export function feedbackTools(deps: AppDeps): readonly AnyToolDefinition[] {
  return [
    submitFeedbackTool(deps),

    defineTool({
      name: "list_feedback",
      description:
        "改善要望の一覧を新しい順に返します。状態ごとの件数と、0 件のときはその理由も一緒に返します。",
      schema: z.object({
        statuses: z.array(statusSchema).optional(),
        kinds: z.array(kindSchema).optional(),
        route: z.string().optional(),
        handedOff: z.boolean().optional(),
        includeDiscarded: z.boolean().optional(),
      }),
      readOnly: true,
      useCase: createListFeedbackUseCase({ repository: deps.feedback }),
    }),

    defineTool({
      name: "get_feedback",
      description:
        "改善要望を 1 件返します。「どうなってほしいか」が未記入のときは、その旨の文が入ります。画面の写しそのものは含みません。",
      schema: z.object({ id: z.string().min(1) }),
      readOnly: true,
      useCase: createReadFeedbackUseCase({
        repository: deps.feedback,
        captures: deps.feedbackCaptures,
      }),
    }),

    defineTool({
      name: "update_feedback_status",
      description:
        "改善要望の対応状況を変えます。扱いの決定（対応しない・重複・廃棄）と取り消しは、人だけが行えます。",
      schema: z.object({
        id: z.string().min(1),
        status: statusSchema.optional(),
        note: z.string().nullable().optional(),
        disposition: z
          .object({
            kind: z.enum(FEEDBACK_DISPOSITIONS),
            reason: z.string().min(1),
            duplicateOf: z.string().nullable().optional(),
          })
          .optional(),
        undoDisposition: z.boolean().optional(),
      }),
      readOnly: false,
      useCase: createUpdateFeedbackStatusUseCase({
        repository: deps.feedback,
        ids: deps.ids,
        auditLog: deps.auditLog,
        now: () => new Date(),
      }),
    }),

    defineTool({
      name: "hand_off_feedback",
      description:
        "選んだ改善要望から、作業する側へ渡す指示文を作ります。同じ要望からは何度でも同じ指示文が出ます。渡せなかったものは理由つきで返します。",
      schema: z.object({
        ids: z.array(z.string().min(1)).min(1).max(50),
        route: z.enum(["copied_by_human", "pulled_by_agent"]),
        keyId: z.string().nullable().optional(),
        keyLabel: z.string().nullable().optional(),
        previewOnly: z.boolean().optional(),
      }),
      readOnly: false,
      useCase: createHandOffFeedbackUseCase({
        repository: deps.feedback,
        templates: deps.handoffTemplates,
        ids: deps.ids,
        auditLog: deps.auditLog,
        now: () => new Date(),
      }),
    }),

    defineTool({
      name: "manage_integration_keys",
      description:
        "取りに来るときの鍵を一覧・発行・失効します。人だけが行えます。発行した値が返るのはその 1 回だけです。",
      schema: z.discriminatedUnion("action", [
        z.object({ action: z.literal("list") }),
        z.object({
          action: z.literal("issue"),
          label: z.string().min(1),
          scopes: z.array(z.enum(["read", "update_status"])).min(1),
          rateLimitPerMinute: z.number().int().positive().optional(),
        }),
        z.object({ action: z.literal("revoke"), id: z.string().min(1) }),
      ]),
      readOnly: false,
      // 人だけができる操作。AI のサービスアカウントは権限の側で弾かれる。
      requiresHumanApproval: true,
      useCase: createManageIntegrationKeysUseCase({
        keys: deps.integrationKeys,
        ids: deps.ids,
        mintSecret: deps.mintSecret,
        now: () => new Date(),
        auditLog: deps.auditLog,
      }),
    }),
  ];
}
