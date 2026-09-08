import { validateHostname } from "@/domain/domains";

/**
 * 独自ドメインの Host ヘッダから、どのブログかを入口 (`src/middleware.ts`) が
 * 引くための経路。**写しを短い間だけ持つ。**
 *
 * --- なぜ写しを持つのか ---
 * 入口は要求のたびに必ず 1 回走る。素で D1 を引くと、管理画面を開くだけで
 * 往復が 1 つ増える。しかも独自ドメインを 1 件も登録していない環境では、
 * その往復は毎回「見つからない」を返すだけで何も生まない。
 *
 * --- 写しを持つ代償 ---
 * **取り下げが効くまで最大 `TTL_MS` 遅れる。** 取り下げた住所を踏んだ読者が、
 * その間はまだブログに着く。これは意図して引き受けている代償で、
 * `docs/spec/feat-blog-custom-domain/host-resolution-design.md` に書いてある。
 * 短くするほど D1 への往復が増え、長くするほど取り下げが遅れる。
 * 60 秒にしているのは、取り下げの理由が「間違えて繋いだ」であることが
 * ほとんどで、1 分の遅れが許容できる一方、1 分あれば同じホストへの連続した
 * 要求はまとめて 1 回の照会で済むためである。
 *
 * **見つからなかったことも写す。** 写さないと、独自ドメインを使っていない
 * 環境で毎要求 D1 を引くことになり、写しを持つ意味が消える。
 *
 * --- 写しはワーカーの寿命でしか消えない ---
 * module 直下の `Map` なので、ワーカーの隔離が入れ替われば空になる。
 * これは弱点ではなく、写しが古いまま延々と残らないことの保証でもある。
 * 逆に、この写しを「正本」として当てにしてはいけない。配信してよいかの
 * 判断は `status = 'active'` を述語に持つ照会そのものが決める。
 */

/** 写しの寿命。取り下げが効くまでの上限でもある。 */
const TTL_MS = 60_000;

/**
 * 写しの上限件数。
 *
 * 上限を置かないと、存在しないホスト名で叩き続けるだけで写しを
 * 際限なく太らせられる（Host ヘッダは要求側が自由に付けられる）。
 * 溢れたら古いものから捨てる。
 */
const MAX_ENTRIES = 512;

/** 写した値。`null` は「引いたが無かった」で、これも写す。 */
type Entry = { readonly value: string | null; readonly expiresAt: number };

const cache = new Map<string, Entry>();

/**
 * 逆向きの写し。ブログの URL 名 → 読者へ見せる正本の住所。
 *
 * 別の `Map` にしているのは、鍵の意味が違うためである。片方はホスト名、
 * もう片方は URL 名で、同じ入れ物に混ぜると「`example.com` という名前の
 * ブログ」が住所表を汚せる。寿命と上限の規則は同じものを使う。
 */
const canonicalCache = new Map<string, Entry>();

/** 試験から写しを空にする。実行時には使わない。 */
export function clearCustomHostCache(): void {
  cache.clear();
  canonicalCache.clear();
}

/** 寿命付きの写しを 1 つ引く。見つからなければ `lookup` して写す。 */
async function throughCache(
  store: Map<string, Entry>,
  key: string,
  lookup: (key: string) => Promise<string | null>,
  now: number,
): Promise<string | null> {
  const cached = store.get(key);
  if (cached !== undefined && cached.expiresAt > now) return cached.value;

  let value: string | null;
  try {
    value = await lookup(key);
  } catch {
    // 引けなかったことを写さない。写すと、D1 が一瞬落ちただけで
    // 生きている住所が TTL のあいだ「見つからない」に固定される。
    return null;
  }

  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { value, expiresAt: now + TTL_MS });
  return value;
}

/**
 * ブログの正本の住所を引く。立っていなければ `null`。
 *
 * 公開ページの `<link rel="canonical">` を組むのに使う。要求ごとに走るので
 * 入口と同じ寿命の写しを通す。**取り下げ後、最大 `TTL_MS` は古い canonical を
 * 配り続ける**。読者への転送ではなく宣言なので、この遅れは害にならない。
 */
export async function resolveCanonicalHostForSite(
  siteSlug: string,
  lookup: (slug: string) => Promise<string | null>,
  now: number = Date.now(),
): Promise<string | null> {
  if (siteSlug === "") return null;
  return throughCache(canonicalCache, siteSlug, lookup, now);
}

/** 公開ページが使う既定の引き方。D1 が取れなければ `null`。 */
export async function lookupCanonicalHostInD1(siteSlug: string): Promise<string | null> {
  const { tryGetDb } = await import("@/infrastructure/persistence/d1/connection");
  const db = await tryGetDb();
  if (db === null) return null;
  const { resolveCanonicalHostBySiteSlug } = await import(
    "@/infrastructure/persistence/d1/custom-domain-repository"
  );
  return resolveCanonicalHostBySiteSlug(db, siteSlug);
}

/**
 * Host ヘッダを、住所表を引く形へ正規化する。
 *
 * ポート番号を落とすのは、`localhost:3000` のような手元の値がそのまま
 * ホスト名として照会に流れると、必ず「見つからない」に倒れるためである。
 * 大文字小文字は `validateHostname` が倒す。
 */
export function normalizeRequestHost(host: string | null): string | null {
  if (host === null) return null;
  const withoutPort = host.trim().replace(/:\d+$/, "");
  const validated = validateHostname(withoutPort);
  return validated.ok ? validated.value : null;
}

/**
 * 独自ドメインからブログの URL 名を引く。見つからなければ `null`。
 *
 * `lookup` を引数で受け取るのは、写しの規則 (この関数) と保存先の引き方
 * (`resolveSiteSlugByHost`) を別々に確かめられるようにするためである。
 * 中で D1 を直に触ると、写しの寿命を試験するのに workerd が要る。
 */
export async function resolveCustomHostSlug(
  host: string | null,
  lookup: (hostname: string) => Promise<string | null>,
  now: number = Date.now(),
): Promise<string | null> {
  const hostname = normalizeRequestHost(host);
  if (hostname === null) return null;
  return throughCache(cache, hostname, lookup, now);
}

/**
 * 入口が使う既定の引き方。D1 が取れなければ `null`。
 *
 * `@opennextjs/cloudflare` を呼ばれた時に取り込むのは
 * `readSiteBaseDomain` と同じ理由で、冒頭で取り込むとこの module を
 * 読むだけの自動テストが Workers 実行時を要求しはじめる。
 */
export async function lookupCustomHostInD1(hostname: string): Promise<string | null> {
  const { tryGetDb } = await import("@/infrastructure/persistence/d1/connection");
  const db = await tryGetDb();
  if (db === null) return null;
  const { resolveSiteSlugByHost } = await import(
    "@/infrastructure/persistence/d1/custom-domain-repository"
  );
  return resolveSiteSlugByHost(db, hostname);
}
