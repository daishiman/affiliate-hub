"use server";

import { currentActor, personaUseCases } from "@/presentation/composition";

/**
 * 文章が書き手の書ける範囲に収まっているかの確認。
 *
 * 画面から呼ぶのはこの関数だけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 判定そのものは domain の純関数にあり、ここでは何も判断しない。
 */

export type FactBoundaryCheckState = {
  readonly status: "idle" | "passed" | "flagged" | "failed";
  readonly message: string;
  readonly field?: string;
  /** 指摘 1 件ずつ。どこが問題かを本文の抜粋つきで出す。 */
  readonly findings: readonly { readonly excerpt: string; readonly message: string }[];
};

export const INITIAL_FACT_BOUNDARY_STATE: FactBoundaryCheckState = {
  status: "idle",
  message: "",
  findings: [],
};

export async function checkFactBoundaryAction(
  _prev: FactBoundaryCheckState,
  formData: FormData,
): Promise<FactBoundaryCheckState> {
  const personaId = String(formData.get("personaId") ?? "");
  const body = String(formData.get("body") ?? "");

  if (body.trim() === "") {
    return {
      status: "failed",
      message: "調べる文章を入れてください。",
      field: "body",
      findings: [],
    };
  }

  const result = await personaUseCases().checkFactBoundary.execute(await currentActor(), {
    personaId,
    body,
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: result.error.suggestedAction ?? result.error.message,
      field: result.error.field,
      findings: [],
    };
  }

  const { passed, violations, prohibitedPhrasesFound, summary } = result.value;

  return {
    status: passed ? "passed" : "flagged",
    message: summary,
    findings: [
      ...violations.map((v) => ({ excerpt: v.excerpt, message: v.message })),
      ...prohibitedPhrasesFound.map((phrase) => ({
        excerpt: phrase,
        message: `「${phrase}」は、この書き手が使わないと決めた言葉です。`,
      })),
    ],
  };
}
