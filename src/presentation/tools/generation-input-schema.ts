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
  /**
   * どのモデルで書くか。**入口では既定を入れない。**
   *
   * `optional()` にしてあるのは、選ばれていないことをユースケースまで
   * そのまま届けるためである。ここで「とりあえず先頭のモデル」を入れると、
   * 呼び出し側は選んだつもりが無いのに、記録にはモデル名が残る。
   * 欠けている理由を返すのはユースケースの仕事。
   */
  model: z
    .object({
      providerId: z.string().min(1),
      modelId: z.string().min(1),
    })
    .optional(),
  // 「部分的に渡す」を受け付ける。欠けていることを検出して理由を返すのは
  // ユースケース側の仕事で、入口で弾くと「何が足りないか」を返せなくなる。
  provided: generationInputSchema.partial(),
  materials: z.array(material).max(20).optional(),
  promptVersion: z.string().regex(/^v[1-9][0-9]*$/).optional(),
  budgetMinor: z.number().int().min(0).nullable().optional(),
});

/**
 * **宣言する形**（配る JSON Schema の元）。受け付ける形より狭い。
 *
 * 上の `draftContentVariantSchema` は、`model` が無くても・`provided` が欠けていても
 * 受け取る。そうしてあるのは、欠けているものを数えて「何を先に決めればよいか」を
 * 返すためで、画面の「まだそろっていない」の試しはこの道を通っている
 * （`src/app/admin/generation/page.tsx` が `provided: {}` を渡す）。
 *
 * だが**受け取ることと、作れることは違う**。`model` が無ければ必ず断られ、
 * 18 項目のどれかが欠けても必ず断られる。それを `optional` のまま宣言すると、
 * AI から見て「無くても呼べる」と読める。説明文には書いてあるが、
 * **説明文は形ではない**——AI は入力を `required` から組み立てる。
 *
 * ここで狭めているのは 2 つだけ:
 *   - `model` を必須にする（既定は入れない。入れないまま「要る」と言う）
 *   - `provided` を部分ではなく 18 項目そろった形にする
 */
export const draftContentVariantDeclaredSchema = draftContentVariantSchema.extend({
  model: z.object({ providerId: z.string().min(1), modelId: z.string().min(1) }),
  provided: generationInputSchema,
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
