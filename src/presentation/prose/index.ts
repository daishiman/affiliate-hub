/**
 * 記事本文の描き方と書き方。**共通UI (`@/presentation/ui`) ではない。**
 *
 * ここに在るものは `@/domain/blogops` の本文の断片 (`ProseNode`) を知っている。
 * 共通UIは「渡されたものを出すだけ」で、業務のきまりを持ち込まない決まりになっていて
 * （`tests/ui/ui-layers.test.ts`）、本文の断片はその決まりに当たる。
 *
 * かといって `presentation/site` にも `presentation/admin` にも置けない。
 * **同じ断片を同じ規則で描くのは、公開面と管理画面の両方だからである。**
 * どちらか一方に置くと、もう一方が相手を読むことになり、
 * 「読者向け」と「運営者向け」の境目が消える。
 *
 * だから両者から読まれる場所を 1 つ作った。ここは共通UIを**読む**側で、
 * 共通UIから読まれることはない。
 */

export { ProseBody, type ProductCardRenderer } from "./prose-body";
export { blockAnchor, ProseOutline } from "./prose-outline";
export { ProseEditor, PROSE_NODE_ICON, type ProseEditorProps } from "./prose-editor";
export { ProseSection } from "./prose-section";
