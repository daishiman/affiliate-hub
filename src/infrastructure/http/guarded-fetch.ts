import { isInternalHost, normalizeAffiliateUrl } from "@/domain/monetization";

/**
 * 外部の URL を取りに行く唯一の入口。
 *
 * 受け取った URL を後で取得しに行く仕組みでは、入口で 1 回検査しても足りない。
 * 外から見える URL が、社内アドレスへ転送していることがあるため
 * （転送先を見ずに追いかけると、社内やクラウドの設定情報を取りに行かされる）。
 *
 * ここでやること:
 *   1. 転送を自動で追わない (`redirect: "manual"`)
 *   2. 1 ホップごとに、行き先を同じ判定へ通す
 *   3. 追う回数に上限を置く (転送のループで止まらなくなるのを防ぐ)
 *   4. 取得できる大きさに上限を置く
 *
 * `fetch` を直接呼ぶ実装をインフラ層の他の場所に書かない。
 * 書いてしまうと、この検査を通らない経路ができる。
 */

/** 追ってよい転送の回数。 */
export const MAX_REDIRECTS = 5;

/** 受け取ってよい本文の大きさ。取り込む資料としては十分な量。 */
export const MAX_RESPONSE_BYTES = 2_000_000;

/** 待つ時間の上限。応答しない相手に張り付かない。 */
export const FETCH_TIMEOUT_MS = 10_000;

export type FetchRejection = {
  readonly kind: "rejected";
  /** 利用者にそのまま見せる説明。 */
  readonly reason: string;
  /** どの行き先で止めたか。転送の途中なら転送先。 */
  readonly url: string;
};

export type FetchFailure = {
  readonly kind: "failed";
  readonly reason: string;
};

export type FetchSuccess = {
  readonly kind: "ok";
  /** 実際に取得できた最終的な行き先。転送があれば元の URL と違う。 */
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly body: string;
  /** 追った転送の一覧。何を経由したか後から確認できるようにする。 */
  readonly hops: readonly string[];
};

export type GuardedFetchResult = FetchSuccess | FetchRejection | FetchFailure;

/**
 * 1 つの行き先が安全かを判定する。転送先にも同じ判定を当てる。
 *
 * 判定は domain 側の `isInternalHost` を使う。
 * 同じ判定をここに書き直すと、片方だけ直したときに穴があく。
 */
export function checkHop(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL として読み取れませんでした。" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `この形式の URL は取得できません（${url.protocol}）。` };
  }
  if (isInternalHost(url.hostname)) {
    return { ok: false, reason: "内部ネットワーク宛のため取得しません。" };
  }
  return { ok: true, url };
}

export async function guardedFetch(
  rawUrl: string,
  options: { readonly fetchImpl?: typeof fetch; readonly maxRedirects?: number } = {},
): Promise<GuardedFetchResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const limit = options.maxRedirects ?? MAX_REDIRECTS;

  // 入口の検査。ここは受信箱と同じ判定を使う。
  const normalized = normalizeAffiliateUrl(rawUrl);
  if (!normalized.ok) {
    return { kind: "rejected", reason: normalized.error.message, url: rawUrl };
  }

  const hops: string[] = [];
  let current = rawUrl;

  for (let i = 0; i <= limit; i += 1) {
    const hop = checkHop(current);
    if (!hop.ok) return { kind: "rejected", reason: hop.reason, url: current };
    hops.push(hop.url.toString());

    let response: Response;
    try {
      response = await doFetch(hop.url.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
      });
    } catch (e) {
      return { kind: "failed", reason: `取得できませんでした: ${String(e)}` };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location === null) {
        return { kind: "failed", reason: "転送の指示がありましたが、転送先が書かれていません。" };
      }
      // 相対的な転送先も、いまの行き先を基準に絶対の形へ直してから検査する。
      current = new URL(location, hop.url).toString();
      continue;
    }

    const body = await readCapped(response);
    if (body === null) {
      return {
        kind: "failed",
        reason: `本文が大きすぎます（${MAX_RESPONSE_BYTES} バイトまで）。`,
      };
    }

    return {
      kind: "ok",
      finalUrl: hop.url.toString(),
      status: response.status,
      contentType: response.headers.get("content-type"),
      body,
      hops,
    };
  }

  return {
    kind: "failed",
    reason: `転送が ${limit} 回を超えました。転送先が回り続けている可能性があります。`,
  };
}

/** 上限を超えたら null を返す。全部読んでから長さを見ると、その時点で読み込んでしまう。 */
async function readCapped(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (reader === undefined) return await response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value === undefined) continue;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}
