import type { ActorContext } from "@/domain/shared";

/**
 * **一回の要求を指す名前**を、入ってきた見出しから取り出す。
 *
 * --- なぜ自分で作らないのか ---
 * ここで毎回新しく作ると、同じ 1 回の要求の中で作った名前どうしが結べない。
 * 断りの記録は 1 件では読めない。「同じ要求の中で何件断られたか」が
 * 役の付け忘れ（1 件で終わる）と総当たり（何十件も続く）を分ける。
 *
 * だから外から来た名前を優先する。`x-request-id` は入口で付ける決まりで、
 * `cf-ray` は Cloudflare が必ず付けるもの（つまり本番では必ず片方がある）。
 *
 * 見出しが 1 つも無いときは `null` を返す。ここで作らない理由は、
 * **作った名前が「外と結べる名前」に見えてしまう**ため。
 * 記録する側（`recordAccessDenial`）がその場かぎりの糸を作り、
 * その 1 件しか結べないことを承知で残す。
 */
export const REQUEST_ID_HEADER = "x-request-id";

/** Cloudflare が全ての要求に付ける印。入口で `x-request-id` を付け損ねても、これは在る。 */
const FALLBACK_HEADER = "cf-ray";

export function requestIdOf(headers: Headers): string | null {
  for (const name of [REQUEST_ID_HEADER, FALLBACK_HEADER]) {
    const value = headers.get(name)?.trim() ?? "";
    // 長すぎるものは切る。見出しは外から来るので、長さを信じない。
    if (value !== "") return value.slice(0, 128);
  }
  return null;
}

/**
 * 身元へ糸を結ぶ。
 *
 * 身元の側に持たせるのは、記録を書く場所（ユースケースの外側）まで
 * **入力とは別の道で**届ける必要があるため。入力に混ぜると、
 * ユースケースごとに受け取る形を決めることになり、受け取り忘れが起きる。
 */
export function withRequestId(actor: ActorContext, requestId: string | null): ActorContext {
  return requestId === null ? actor : { ...actor, requestId };
}
