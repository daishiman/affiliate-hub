import type { ReactNode } from "react";
import { ProseBody } from "@/presentation/prose/prose-body";
import { ProductCard, type SectionView } from "@/presentation/ui";
import type { ProductCardView } from "@/presentation/ui/templates/article-view";

/**
 * 公開記事の節本文を合成する、副作用のない共通境界。
 *
 * 形式と版が明示された BlogOps 本文だけを Prose として描く。旧記事や未知の版は
 * 渡された既存DOMへ戻し、記法に見える文字列を推測で変換しない。
 */
export function renderCanonicalSectionBody(
  section: SectionView,
  plainFallback: ReactNode,
  productCards: readonly ProductCardView[] = [],
): ReactNode {
  const formatted = section.formattedBody;
  if (
    formatted?.format !== "prose-v1" ||
    formatted.version !== 1 ||
    typeof formatted.source !== "string"
  ) {
    return plainFallback;
  }

  return (
    <ProseBody
      body={formatted.source}
      keyPrefix={section.id}
      renderProductCard={(id) => {
        const card = productCards.find((candidate) => candidate.productId === id);
        return card === undefined
          ? <p>この位置の商品情報は現在表示できません。</p>
          : <ProductCard {...card} />;
      }}
    />
  );
}
