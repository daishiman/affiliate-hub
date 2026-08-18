"use server";

import { currentActor, personaUseCases } from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";
import type { FactBoundaryCheckState } from "./fact-boundary-state";

/**
 * 文章が書き手の書ける範囲に収まっているかの確認。
 *
 * 画面から呼ぶのはこの関数だけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 判定そのものは domain の純関数にあり、ここでは何も判断しない。
 */

// 状態の型と初期値は `fact-boundary-state.ts` にある。

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
      message: refusalText(result.error),
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
