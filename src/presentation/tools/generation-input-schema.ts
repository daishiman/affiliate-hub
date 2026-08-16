import { z } from "zod";

/**
 * 下書きを作らせるときの入力の形。
 *
 * 正本は 1 つ。ここから REST・バックエンド MCP・画面の入力欄が同じ形を受け取る。
 * 入口ごとに検証を書くと、「宣言している形」と「実際に受け付ける形」がずれる。
 *
 * **報酬に関する欄はここに無い。**
 * 足そうとしても、受け取る側（`GenerationInput`）に置き場所が無いため型検査で止まる。
 * 「うっかり足せてしまう」状態を作らないための並びである。
 */

const material = z.object({
  label: z.string().min(1).max(200),
  sourceUrl: z.string().url().nullable(),
  text: z.string().min(1).max(20_000),
});

const editorialMaterial = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  // 素材が Editorial 区分であることの印。商業区分の素材はここへ入れられない。
  classification: z.literal("editorial").default("editorial"),
});

export const generationInputSchema = z.object({
  subject: z.string().min(1).max(200),
  products: z.array(editorialMaterial).max(50),
  claims: z.array(z.object({ id: z.string().min(1), statement: z.string().min(1) })).max(200),
  evidence: z
    .array(z.object({ id: z.string().min(1), sourceUrl: z.string().url().nullable() }))
    .max(200),
  testRuns: z.array(z.object({ id: z.string().min(1) })).max(200),
  authorPersona: z.object({ id: z.string().min(1), role: z.string().min(1) }),
  audiencePersona: z.object({ id: z.string().min(1), knowledgeLevel: z.string().min(1) }),
  channel: z.string().min(1),
  contentPurpose: z.string().min(1),
  purchaseStage: z.string().min(1),
  angle: z.string().min(1),
  length: z.object({
    kind: z.string().min(1),
    minChars: z.number().int().min(0),
    maxChars: z.number().int().min(1).max(50_000),
  }),
  cta: z.object({ kind: z.string().min(1), phrase: z.string().min(1) }).nullable(),
  disclosure: z.string().min(1),
  forbiddenExpressions: z.array(z.string().min(1)).max(200),
  articleTemplate: z.object({
    type: z.string().min(1),
    sectionIds: z.array(z.string().min(1)).min(1).max(50),
  }),
  siteBlueprint: z.object({ id: z.string().min(1), slug: z.string().min(1) }),
  rankingModel: z.object({ id: z.string().min(1) }).nullable(),
});

export const draftContentVariantSchema = z.object({
  // 「部分的に渡す」を受け付ける。欠けていることを検出して理由を返すのは
  // ユースケース側の仕事で、入口で弾くと「何が足りないか」を返せなくなる。
  provided: generationInputSchema.partial(),
  materials: z.array(material).max(20).optional(),
  promptVersion: z.string().regex(/^v[1-9][0-9]*$/).optional(),
  budgetMinor: z.number().int().min(0).nullable().optional(),
});

/**
 * 入口が受け取った生の形。
 *
 * この形のままではユースケースへ渡らない。
 * `products` に Editorial の印が付いていないためで、印を付けるのは入口の仕事
 * （`generation-tools.ts`）。JSON で運ばれてきた値に区分の印は乗せられないので、
 * 「この素材は編集用である」と宣言する行が必ずどこかに要る。
 * その行を入口 1 箇所に集め、ユースケースから見えなくしてある。
 */
export type DraftContentVariantRaw = z.infer<typeof draftContentVariantSchema>;
