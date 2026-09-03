import { cookies } from "next/headers";

/**
 * 読者の合言葉。
 *
 * 「気になる商品」を読者ごとに分けるために要る。ログインを求めない代わりに、
 * ブラウザごとに 1 度だけ発行する**意味の無い文字列**を持たせる。
 * 秘密の値ではない。持ち出されても、それだけでは誰のものか分からない。
 *
 * --- ここで守ること ---
 * 1. **個人を特定できる値を入れない。** 中身は乱数だけ。名前も連絡先も
 *    IP も混ぜない。混ぜられる形にしておくと、いつか混ざる。
 * 2. **読むだけの画面で発行しない。** 発行は cookie を書く操作なので、
 *    サーバ動作（保存・取り外し）の中でだけ行う。読むだけの画面で書くと、
 *    記事を 1 枚見ただけの人にも合言葉が配られる。
 * 3. **他サイトへ送らない・script から読ませない。** `sameSite: "lax"` と
 *    `httpOnly` を付ける。記事に紛れ込んだ第三者の script が
 *    合言葉を持ち出す経路を、型ではなくブラウザの側で塞ぐ。
 *
 * 合言葉が無いときの一覧は「まだ 1 件も無い」。これは失敗ではない。
 */
export const READER_COOKIE_NAME = "ah_reader";

/** 1 年。押した「気になる」が季節をまたいで残る長さ。 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * すでに配ってある合言葉を読む。**無ければ null。**
 *
 * 読むだけの画面はこちらを使う。null のときに新しく作って返すと、
 * 一覧を開くたびに別人になり、保存したものが毎回消えたように見える。
 */
export async function readerIdentityOrNull(): Promise<string | null> {
  const value = (await cookies()).get(READER_COOKIE_NAME)?.value;
  return value === undefined || value === "" ? null : value;
}

/**
 * 合言葉を確かめ、無ければ発行する。**サーバ動作の中だけで呼ぶ。**
 *
 * `cookies().set` は読み取り専用の画面から呼ぶと例外になる。
 * これは Next.js の都合ではなく、配った合言葉を応答へ載せる必要があるため。
 */
export async function ensureReaderIdentity(): Promise<string> {
  const store = await cookies();
  const found = store.get(READER_COOKIE_NAME)?.value;
  if (found !== undefined && found !== "") return found;

  // 乱数だけ。読者について何も言わない値にする。
  const issued = crypto.randomUUID();
  store.set(READER_COOKIE_NAME, issued, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return issued;
}
