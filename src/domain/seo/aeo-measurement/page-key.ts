/**
 * 3 つのデータ源の結果を**同じページとして突き合わせる鍵**（受入 A5）。
 *
 * ==========================================================================
 * なぜ URL をそのまま鍵にできないのか
 * ==========================================================================
 *
 * 3 系統は、同じページを別々の文字列で指してくる。
 *
 *   系統① 静的解析      … 自分が組み立てた `https://例/s/blog/best/laptops`
 *   系統② Search Console … 正規化済み URL。ただし末尾スラッシュの有無は
 *                          プロパティの設定で変わり、`?utm_source=...` が
 *                          付いた行も混ざる
 *   系統③ AI 検索の被引用 … 引用元として返ってくる URL。追跡用のクエリや
 *                          フラグメント（`#section-2`）が付くことがある
 *
 * これを文字列のまま突き合わせると、**同じページが 3 行に分かれる。**
 * 分かれたことは画面上「どのページにも所見が少ない」という形にしか見えず、
 * 壊れているとは分からない。だから鍵を作る規則を 1 箇所に置く。
 *
 * ==========================================================================
 * 何を捨てるか
 * ==========================================================================
 *
 * 追跡用クエリとフラグメントは捨てる。公開一覧の `?page=2` 以降だけは
 * 内容と canonical が変わるため、ページ番号を鍵へ残す。`page=1` は
 * クエリ無しの最初のページと同じものとして落とす。
 * 末尾スラッシュも捨てる。ホストは捨てない —— 同じ道でもホストが違えば
 * 別のブログである。
 *
 * 検索結果ページ（`/search?q=...`）は鍵を作らない。問い合わせごとに
 * 中身が変わるページを 1 つのページとして数えると、所見も実績も混ざる。
 */

/**
 * ページの識別子。**文字列 1 本で持つ。**
 *
 * 組にして持つと、片方だけ入れ替えた値が作れてしまう。
 * 作る口を `pageKeyOf` だけにして、途中で組み替えられない形にする。
 */
export type PageKey = string & { readonly __brand: "PageKey" };

/** 鍵を作れなかった理由。捨てた理由を「null」の一言に潰さない。 */
export type PageKeyRejection =
  | "unparsable"
  | "unsupported_scheme"
  | "query_dependent_page"
  | "credentials_in_url";

export type PageKeyResult =
  | { readonly ok: true; readonly key: PageKey }
  | { readonly ok: false; readonly reason: PageKeyRejection };

/**
 * 問い合わせの中身で表示が変わる道。鍵を作らない。
 *
 * 前方一致ではなく完全一致で見るのは、`/searchable-things` のような
 * 普通の記事を巻き込まないため。
 */
const QUERY_DEPENDENT_PATHS = new Set(["/search"]);

export function pageKeyOf(rawUrl: string): PageKeyResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "unparsable" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "unsupported_scheme" };
  }
  /*
    利用者名とパスワードを URL に埋めた形（`https://user:pw@例/…`）は
    突き合わせの前に捨てる。鍵に混ぜると、所見の一覧や通知に
    合言葉がそのまま出る。
  */
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "credentials_in_url" };
  }

  // 末尾スラッシュを落とす。ただし根（"/"）は落とすと空になるので残す。
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";

  if (QUERY_DEPENDENT_PATHS.has(path) || pathEndsWithQueryDependentSegment(path)) {
    return { ok: false, reason: "query_dependent_page" };
  }

  /*
    ホストは小文字へ揃える。パスは揃えない。
    ホスト名は大小を区別しない決まり（RFC 3986）だが、パスは区別する。
    ここで揃えると、大文字を含む slug が別ページと衝突する。
  */
  const canonicalQuery = canonicalPageQuery(path, url.searchParams);
  return {
    ok: true,
    key: `${url.host.toLowerCase()}${path === "/" ? "/" : path}${canonicalQuery}` as PageKey,
  };
}

/** 表示内容を変える公開一覧のページ番号だけを残し、追跡queryは混ぜない。 */
const PAGINATED_LISTING_PATH = /^\/s\/[^/]+\/(?:blog|best|reviews|compare|guides|tools)$/;

function canonicalPageQuery(path: string, params: URLSearchParams): string {
  // 末尾名だけで決めると、`/guides/blog`のように記事slugが
  // 一覧名と同じページまでpaginationとして分割される。
  if (!PAGINATED_LISTING_PATH.test(path)) return "";
  const raw = params.get("page");
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return "";
  const page = Number(raw);
  if (!Number.isSafeInteger(page) || page <= 1) return "";
  return `?page=${page}`;
}

/** `/s/<site>/search` のように、ブログ基底パスの下に来る検索の道も弾く。 */
function pathEndsWithQueryDependentSegment(path: string): boolean {
  for (const dependent of QUERY_DEPENDENT_PATHS) {
    if (path.endsWith(dependent)) return true;
  }
  return false;
}

/** 画面に出す形。鍵はホスト付きなので、そのまま見せて読める。 */
export function pageKeyLabel(key: PageKey): string {
  return key;
}
