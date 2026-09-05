import type { RawReaderInteraction } from "@/application/usecases/blog-ops/record-reader-interactions";
import {
  readerActorForKnownSite,
  readerInteractionIntakeEntry,
} from "@/presentation/composition";
import { readConsentSignals } from "@/presentation/telemetry/consent-server";

/**
 * 読者の行動（表示・読み進み・滞在・押下・離脱）の受け口。観測層。
 *
 * 形は `/api/telemetry` と同じ 3 つの決まりに従う:
 *   1. **同意の判定はサーバー側でやり直す。** 端末が「同意済み」と名乗れる
 *      形にしない。
 *   2. **必ず 204 を返す。** 記録できたかは読者に関係が無く、失敗を返すと
 *      送信側が再送を始めて、壊れているときほど負荷が上がる。
 *   3. **大きすぎる本文は読まない。** 読んでから捨てるのでは遅い。
 *
 * `/api/telemetry` と別にしてあるのは、あちらが画面の使われ方（管理画面を
 * 含む）の記録で、こちらは**公開されたブログの読者の行動**だけを扱うため。
 * 保存先も読み口も違い、90 日で消えるのはこちらだけである (AD-4)。
 */

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS = 50;

/**
 * 記録できてもできなくても、読者へ返すのはこれ 1 つ。
 *
 * 使い回しの 1 個を持たず毎回作るのは、`Response` が 1 回しか返せない
 * 器だからである。中身が空でも、同じ実行が複数の要求を捌く Worker では
 * 使い回した瞬間に 2 件目以降が壊れる。
 */
function accepted(): Response {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return accepted();

    const parsed = JSON.parse(raw) as { siteSlug?: unknown; events?: unknown };
    const siteSlug = typeof parsed.siteSlug === "string" ? parsed.siteSlug.trim() : "";
    if (siteSlug === "") return accepted();

    const events = Array.isArray(parsed.events)
      ? (parsed.events.slice(0, MAX_EVENTS) as readonly RawReaderInteraction[])
      : [];
    if (events.length === 0) return accepted();

    /*
     * 作業場所はブログ名から引く。本文から作業場所を直接受け取らないのは、
     * 誰でも叩ける口だからで、本文で作業場所を名乗れると他人のブログの
     * 数字へ書き込めるため。既知のブログへ解決できない要求は、所属なしの
     * `ws_public` へ落とさず何も記録しない。
     */
    const actor = await readerActorForKnownSite(siteSlug);
    if (actor === null) return accepted();

    const useCase = await readerInteractionIntakeEntry();
    if (useCase === null) return accepted();

    await useCase.execute(actor, {
      siteSlug,
      events,
      signals: await readConsentSignals(),
    });
  } catch {
    // 記録できなくても読者の画面は動く。ここで失敗を返さない。
  }
  return accepted();
}
