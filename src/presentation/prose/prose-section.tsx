import type { ReactNode } from "react";
import { SectionHeading } from "@/presentation/ui";
import { ProseBody, type ProductCardRenderer } from "./prose-body";

/**
 * 見出し 1 つと、続く本文の節。
 *
 * `<section>` → `<SectionHeading level={2}>` → `<p>` の並びは、
 * 読者側の画面（道具ページ・ブログ記事）で同じ形が 2 か所に写っていた。
 * 写しがあると、たとえば「見出しが空のときは `<section>` ごと出さない」を
 * 片方だけ直した日から、同じ見た目のはずの 2 か所が静かにずれる。
 *
 * **本文を文字列で受ける。** 呼ぶ側で `<p>` を並べる形にすると、
 * 段落の割り方がまた 2 か所に写る。
 *
 * 本文の中身は `ProseBody` が描く。素の文章はこれまでどおり段落として出て、
 * 記法（小見出し・箇条書き・注意書き・比較表・商品カード）が書かれていれば
 * その形で出る。**既存の本文は 1 件も直さなくてよい。**
 */

export function ProseSection({
  title,
  id,
  body,
  renderProductCard,
  children,
}: {
  /**
   * 節の見出し。空文字・未指定なら見出しを出さない。
   *
   * 「無題の節」のような当て字を入れない。読者にとって意味のない見出しは、
   * 目次にも読み上げにも入り込んで、本文へ辿り着くまでの段を 1 つ増やす。
   */
  readonly title?: string;
  /** ページ内アンカーの飛び先。見出しそのものに付く（目次から飛ぶため）。 */
  readonly id?: string;
  /** 本文。段落と、書かれていれば本文の断片。 */
  readonly body?: string;
  /**
   * 本文中の商品カードの描き方。
   *
   * 渡さないと商品カードは描かれない（`ProseBody` の判断）。
   * 商品を知らない画面に、空の枠を出させないため。
   */
  readonly renderProductCard?: ProductCardRenderer;
  /** 本文のあとに続けるもの（表・図・入力欄など）。 */
  readonly children?: ReactNode;
}) {
  const heading = title?.trim() ?? "";
  return (
    <section>
      {heading === "" ? null : (
        <SectionHeading level={2} id={id}>
          {heading}
        </SectionHeading>
      )}
      <ProseBody
        body={body ?? ""}
        keyPrefix={id ?? heading}
        renderProductCard={renderProductCard}
      />
      {children}
    </section>
  );
}
