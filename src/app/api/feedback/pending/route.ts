import { UNFINISHED_STATUSES } from "@/domain/feedback/status";
import { errorResponse } from "@/presentation/http/error-response";
import { feedbackUseCases, resolveIntegrationAccess } from "@/presentation/composition";

export const dynamic = "force-dynamic";

/**
 * 未対応の改善要望を取りに来るための口（払い出しの 2 つ目の経路）。
 *
 * --- なぜ GET なのに記録が増えるのか ---
 *
 * 取りに来た時点で「渡した」ことにする。読むだけにして記録を残さないと、
 * **同じ要望を 2 つの手元が同時に持ち帰る**ことが起こり、どちらが直したのか
 * 後から分からなくなる。渡した中身そのものは何度取っても同じ（冪等）で、
 * 増えるのは回数と履歴だけである。
 *
 * --- 何を返して、何を返さないか ---
 *
 * 返すのは指示文と、その版・指紋・要望の番号だけ。氏名・メールアドレス・
 * 画面の写し・秘密情報は入らない。**入らないことは、この関数ではなく
 * 指示文を組み立てる側（封筒の検査）が保証している。** ここで足し算をすると、
 * 検査を通らない経路を 1 本作ることになる。
 *
 * --- 利用者の文章を命令として扱わない ---
 *
 * 指示文の中で利用者の文章は「資料」として囲まれている。この口は本文を
 * 読まないし、解釈もしない。受け取った側も同じ扱いをする前提である。
 */
export async function GET(request: Request) {
  const access = await resolveIntegrationAccess(request, "read");
  if (!access.ok) {
    return Response.json({ error: access.message }, { status: access.status });
  }

  const useCases = await feedbackUseCases();

  const listed = await useCases.list.execute(access.actor, {
    statuses: UNFINISHED_STATUSES,
    handedOff: false,
  });
  if (!listed.ok) return errorResponse(listed.error);

  const ids = listed.value.rows.map((r) => r.id);
  if (ids.length === 0) {
    // 0 件も取得の 1 回として数える。数えないと、上限だけを避けて
    // 空振りを繰り返す呼び出しが記録に残らない。
    await access.recordUsage(0);
    return Response.json({
      reports: [],
      skipped: [],
      message: "いま渡せる改善要望はありません。",
    });
  }

  const handed = await useCases.handOff.execute(access.actor, {
    ids,
    route: "pulled_by_agent",
    keyId: access.keyId,
    keyLabel: access.keyLabel,
  });
  if (!handed.ok) return errorResponse(handed.error);

  await access.recordUsage(handed.value.prompts.length);

  return Response.json({
    reports: handed.value.prompts.map((p) => ({
      id: p.reportId,
      prompt: p.text,
      templateVersion: p.templateVersion,
      fingerprint: p.fingerprint,
    })),
    skipped: handed.value.skipped,
    message: handed.value.idempotencyText,
  });
}
