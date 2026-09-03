/**
 * 本文の文字列を段落に割る。空の段落は捨てる。
 *
 * **部品（`.tsx`）ではなくここに置く。**見本帳（`/admin/ui-catalog`）は
 * `.tsx` が出すものを全部並べる約束で、見た目を持たない関数は並べても
 * 何も確かめられない。置き場所を分けることで、その約束を曲げずに済む。
 *
 * `src/domain/authoring/quality-check.ts` の `paragraphsOf` と**別物である**。
 * あちらは改行 1 つでも割り、見出し行を落とす（文章の長さを測るため）。
 * こちらは空行 1 つ以上でだけ割り、見出しは呼ぶ側が `title` で持つ。
 * 同じ名前にすると、片方の規則をもう片方の画面へ持ち込む事故が起きる。
 */
export function proseParagraphs(body: string): readonly string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}
