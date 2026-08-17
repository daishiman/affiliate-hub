import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * 生成物の受け取りの形（生成基盤設計 §1-5）。
 *
 * 決めた形に一致しない返答は受け取らない。
 * 自由文をそのまま記事にすると、何が書かれるか事前に確かめられない。
 *
 * もう 1 つ大事なこと:
 * **点数（factuality_score など）は合否に使わない。**
 * これは書いた側の自己申告であり、自分の答案に自分で点をつけたものと同じ。
 * 合否は品質検査と検証役の出した結果で決める。
 */

export const OUTPUT_REQUIRED_FIELDS = [
  "body",
  "summary",
  "channel",
  "format",
  "author_persona_id",
  "audience_persona_id",
  "angle",
  "claims_used",
  "evidence_used",
  "assumptions",
  "affiliate_link_ids",
  "disclosure",
  "cta",
  "platform_warnings",
  "factuality_score",
  "persona_fit_score",
  "channel_fit_score",
  "compliance_status",
  "generation_prompt_version",
  "fact_fingerprint",
] as const;
export type OutputField = (typeof OUTPUT_REQUIRED_FIELDS)[number];

/** 自己申告のため、合否の判断に使ってはならない欄。 */
export const SELF_REPORTED_FIELDS: readonly OutputField[] = [
  "factuality_score",
  "persona_fit_score",
  "channel_fit_score",
];

/** 決めきれなかったことの置き場所。AI に確定させないための欄（GC-2）。 */
export type Assumption = {
  readonly statement: string;
  readonly whyUncertain: string;
  readonly whoDecides: "editor" | "supervisor" | "owner";
};

export const ASSUMPTION_DECIDERS = ["editor", "supervisor", "owner"] as const;

/**
 * 受け取りの形を JSON Schema として出す。
 * 生成の呼び出しと、道具の説明の両方でこれを使う。1 箇所で持つ。
 */
export function generatedVariantJsonSchema(): Readonly<Record<string, unknown>> {
  const stringArray = { type: "array", items: { type: "string" } };
  const unitScore = { type: "number", minimum: 0, maximum: 1 };
  return {
    type: "object",
    required: [...OUTPUT_REQUIRED_FIELDS],
    additionalProperties: false,
    properties: {
      title: { type: ["string", "null"] },
      body: { type: "string" },
      summary: { type: "string" },
      channel: { type: "string" },
      format: { type: "string" },
      author_persona_id: { type: "string" },
      audience_persona_id: { type: "string" },
      angle: { type: "string" },
      claims_used: stringArray,
      evidence_used: stringArray,
      assumptions: {
        type: "array",
        items: {
          type: "object",
          required: ["statement", "why_uncertain", "who_decides"],
          additionalProperties: false,
          properties: {
            statement: { type: "string" },
            why_uncertain: { type: "string" },
            who_decides: { enum: [...ASSUMPTION_DECIDERS] },
          },
        },
      },
      affiliate_link_ids: stringArray,
      disclosure: { type: "string" },
      cta: { type: "string" },
      platform_warnings: stringArray,
      factuality_score: unitScore,
      persona_fit_score: unitScore,
      channel_fit_score: unitScore,
      compliance_status: { enum: ["pass", "warning", "fail"] },
      generation_prompt_version: { type: "string" },
      fact_fingerprint: { type: "string" },
    },
  };
}

/**
 * 受け取った値が形に合っているかを確かめる。
 * 欠けた欄を並べて返す。「不正な出力です」だけでは何を直すか分からない。
 */
export function checkOutputShape(
  raw: unknown,
): Result<Readonly<Record<string, unknown>>, DomainError> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return err(
      domainError("VALIDATION_FAILED", "生成物が決めた形で返っていません。", {
        suggestedAction: "散文ではなく、決めた形で返すよう指示し直してください。",
      }),
    );
  }
  const value = raw as Record<string, unknown>;
  const missing = OUTPUT_REQUIRED_FIELDS.filter((f) => value[f] === undefined);
  if (missing.length > 0) {
    return err(
      domainError(
        "VALIDATION_FAILED",
        `生成物に必要な欄が ${missing.length} 件ありません: ${missing.join("・")}`,
        {
          suggestedAction: "欠けた欄を埋めてやり直してください。埋まらないまま先へ進めません。",
          details: { missing: missing.join(",") },
        },
      ),
    );
  }
  const extra = Object.keys(value).filter(
    (k) => k !== "title" && !(OUTPUT_REQUIRED_FIELDS as readonly string[]).includes(k),
  );
  if (extra.length > 0) {
    return err(
      domainError("VALIDATION_FAILED", `決めていない欄が入っています: ${extra.join("・")}`, {
        suggestedAction: "決めた欄だけで返すよう指示し直してください。",
      }),
    );
  }
  return ok(value);
}

/**
 * 合否の判断に自己申告の点数を使っていないことを確かめる。
 * 「点数が高いから通す」を仕組みとして起こせないようにする（GC-6）。
 */
export function verdictMayUse(field: string): boolean {
  return !(SELF_REPORTED_FIELDS as readonly string[]).includes(field);
}
