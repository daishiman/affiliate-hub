"use server";

import { personaUseCases, signedInActor } from "@/presentation/composition";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";
import type { FactBoundaryCheckState } from "./fact-boundary-state";

/**
 * 文章が書き手の書ける範囲に収まっているかの確認。
 *
 * 画面から呼ぶのはこの関数だけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 判定そのものは domain の純関数にあり、ここでは何も判断しない。
 */

// 状態の型と初期値は `fact-boundary-state.ts` にある。

/**
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先の砦は**役の一覧**で、あれは人が編集する表である。
 *
 * ここは何も書き換えないが、通ると**書き手の記録（何を試したか）が外から引ける**。
 * 誰の体験が記録済みかは、記事を書いた人の行動そのものである。
 * 2026-08-19 の実測では、ログインしていない状態で判定が本当に通った（`ah-dao`）。
 */
export async function checkFactBoundaryAction(
  _prev: FactBoundaryCheckState,
  formData: FormData,
): Promise<FactBoundaryCheckState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「文章を入れてください」に化けて、押した人は文章を変えて何度も試す。
    return { status: "failed", message: notSignedInText("書ける範囲の確認"), findings: [] };
  }

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

  const result = await personaUseCases().checkFactBoundary.execute(actor, {
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
