/**
 * 記事の骨格 — 目次の階層・記事型ごとの部品列・商品カードの再掲場所。
 *
 * 正本は `docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md` §3.3 / §4。
 *
 * ==========================================================================
 * なぜ画面ではなくここに置くのか
 * ==========================================================================
 *
 * この 3 つは、どれも**「読者に見えるものと、運営者が入れたものの対応」**である。
 * 画面側に書くと、記事の画面が増えた日 (印刷用・AMP 相当・要約表示) に
 * 対応が枝分かれし、**どの枝が正しいのかを誰も言えなくなる。**
 * 対応そのものをここに 1 つ置き、画面は結果を描くだけにする。
 */

import type { ArticleBlockKind } from "./blueprint-parts";
import type { ArticleTemplate } from "./blog-article";

/**
 * 部品が目次の何段目に載るか。`null` は目次に載せない。
 *
 * **飾りの部品 (パンくず・題名・広告表記) を目次に載せない。**
 * 載せると、読者が「読みたい中身」を探す前に、必ず読み飛ばす行を通る。
 *
 * `criterion-section` だけが 3 段目である (§3.3 の 10)。判断軸は
 * 「必要な条件の節」の下にぶら下がる小見出しで、独立した章ではない。
 * 2 段目に上げると、目次の上で軸が章と同じ重さに見え、
 * **記事の主張 (軸は条件の内訳である) と目次の形が食い違う。**
 */
export const ARTICLE_BLOCK_TOC_LEVEL: Readonly<Record<ArticleBlockKind, 2 | 3 | null>> = {
  breadcrumb: null,
  "article-title": null,
  "article-meta": null,
  "featured-image": null,
  "disclosure-notice": null,
  "intro-box": null,
  "hierarchical-toc": null,
  "editor-credential-box": null,
  "spec-section": 2,
  "criterion-section": 3,
  "pick-section": 2,
  "product-card": null,
  "summary-section": 2,
  "comment-form": null,
  "prev-next": null,
};

/** 目次の 1 行。`children` は 3 段目。 */
export type OutlineNode<T> = {
  readonly block: T;
  /** 「1」「2」など。3 段目は「2-1」の形。 */
  readonly label: string;
  readonly children: readonly OutlineNode<T>[];
};

/**
 * 位置の順に並んだ部品列から、2 階層の目次を組む。
 *
 * **番号は数え上げで作る。**運営者に番号を打たせると、途中に節を 1 つ足した日に
 * 以降の番号を全部打ち直すことになり、打ち忘れた番号が読者に見える。
 *
 * 3 段目が 2 段目より先に来た場合 (運営者が判断軸を条件の節より上に置いた場合)、
 * **その 3 段目は捨てずに 2 段目として扱う。**捨てると目次から節が消え、
 * 「目次に無い見出し」が本文にだけ在る状態になる。読者は目次を信用できなくなる。
 * 順番の誤りは運営側の画面で言い、読者側では**必ず全部の見出しを出す**。
 */
export function buildOutline<T extends { readonly kind: ArticleBlockKind; readonly heading: string }>(
  ordered: readonly T[],
): readonly OutlineNode<T>[] {
  const roots: { block: T; label: string; children: OutlineNode<T>[] }[] = [];

  for (const block of ordered) {
    const level = ARTICLE_BLOCK_TOC_LEVEL[block.kind];
    if (level === null || block.heading.trim() === "") continue;

    const parent = roots[roots.length - 1];
    if (level === 3 && parent !== undefined) {
      parent.children.push({
        block,
        label: `${parent.label}-${parent.children.length + 1}`,
        children: [],
      });
      continue;
    }
    // 2 段目、または親を持たない 3 段目。
    roots.push({ block, label: String(roots.length + 1), children: [] });
  }

  return roots;
}

/**
 * 記事型ごとの部品列 (§4)。**順序そのものが値である。**
 *
 * `REQUIRED_BLOCKS` (`blog-article.ts`) は「欠けてはいけないもの」の集合で、
 * こちらは「どの順に並ぶか」。分けてあるのは、**欠落と順序違いは直し方が違う**ため。
 * 欠落は足せば済むが、順序違いは既にある部品を並べ替える話で、
 * 同じ言葉で報せると運営者はどちらの操作をすればよいか分からない。
 *
 * `criterion-section` は n 回、`product-card` は 3 箇所に出るので、
 * ここでは**種類の初出の順**だけを持つ。回数はここでは決めない。
 */
export const TEMPLATE_BLOCK_ORDER: Readonly<Record<ArticleTemplate, readonly ArticleBlockKind[]>> =
  {
    T1: [
      "disclosure-notice",
      "intro-box",
      "hierarchical-toc",
      "editor-credential-box",
      "spec-section",
      "criterion-section",
      "pick-section",
      "product-card",
      "summary-section",
      "comment-form",
      "prev-next",
    ],
    T2: [
      "disclosure-notice",
      "intro-box",
      "hierarchical-toc",
      "editor-credential-box",
      "product-card",
      "summary-section",
      "comment-form",
      "prev-next",
    ],
    T3: ["intro-box", "hierarchical-toc", "criterion-section", "comment-form"],
    T4: ["intro-box"],
  };

/**
 * 商品カードを再掲する場所 (§3.3 の 12 / §4)。
 *
 * **運営者はカードを 1 回だけ入れる。**再掲は画面が作る。
 * 3 回入れさせると、価格を直した日に 1 枚だけ古い値が残り、
 * **同じ記事の中で違う価格が読者に見える。**それは表示の崩れではなく、
 * 買う前の人が見る数字の食い違いである。
 *
 * 空配列は「その型では再掲しない」。T4 (ハブ) に商品は出ない。
 */
export const PRODUCT_CARD_PLACEMENTS: Readonly<
  Record<ArticleTemplate, readonly ArticleBlockKind[]>
> = {
  T1: ["pick-section", "spec-section", "summary-section"],
  T2: ["intro-box", "summary-section"],
  T3: [],
  T4: [],
};

/**
 * 部品列が記事型の順序どおりか。**動かすべき部品の種類**を返す。空なら順序どおり。
 *
 * ==========================================================================
 * 3 つの決めどころ
 * ==========================================================================
 *
 * 1. **同じ種類が複数回出るときは、初出だけを見る。**
 *    `criterion-section` は n 回、`product-card` は 3 箇所に出る。2 回目以降を
 *    順序の判定に入れると「2 回目の判断軸が条件の節より後」は当たり前なので、
 *    正しく作った記事が必ず赤くなる。**必ず赤くなる検査は、読まれなくなる。**
 *    `TEMPLATE_BLOCK_ORDER` が種類の初出の順だけを持つのはこのため。
 *
 * 2. **表に無い種類は、判定から外す。**`featured-image` のように記事型の列に
 *    載っていない部品を 1 つ足しただけで全体が「順序違い」になると、運営者は
 *    「この部品を足すと怒られる」と学習して、足すのをやめる。
 *    **検査が、入れてよいものを入れさせなくする**のは本末転倒である。
 *
 * 3. **返すのは「動かす手数が最小になる集合」。**
 *    いちばん長い「正しく並んでいる連なり」を残し、そこから外れたものを返す。
 *    たとえば `[まとめ, 導入, 目次, …]` は、まとめを末尾へ 1 つ動かせば直る。
 *    素直に前から見て「前より後ろの番号が来たら以降は全部ずれ」と数えると
 *    導入・目次…が全部ずれ扱いになり、**運営者は 1 手で済む直しを
 *    10 手だと思わされる。**直せる気がしなくなるのが一番まずい。
 *
 * 返す並びは記事の並び順。運営者は画面を上から見て、名前の出たものだけを動かす。
 */
export function blocksOutOfTemplateOrder(
  template: ArticleTemplate,
  ordered: readonly { readonly kind: ArticleBlockKind }[],
): readonly ArticleBlockKind[] {
  const expected = TEMPLATE_BLOCK_ORDER[template];

  // 1 と 2: 初出だけ・表に在るものだけを、記事の並び順で拾う。
  const seen = new Set<ArticleBlockKind>();
  const points: { kind: ArticleBlockKind; rank: number }[] = [];
  for (const block of ordered) {
    if (seen.has(block.kind)) continue;
    seen.add(block.kind);
    const rank = expected.indexOf(block.kind);
    if (rank === -1) continue;
    points.push({ kind: block.kind, rank });
  }
  if (points.length <= 1) return [];

  // 3: いちばん長い「番号が増えていく連なり」を探す (O(n^2)。部品は高々十数個)。
  //    同じ長さの連なりが複数あるときは**先に出てくる方**を残す。
  //    残す側が実行のたびに変わると、同じ記事で違う名前が出て運営者が混乱する。
  const length = points.map(() => 1);
  const previous = points.map(() => -1);
  for (let i = 1; i < points.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (points[j].rank < points[i].rank && length[j] + 1 > length[i]) {
        length[i] = length[j] + 1;
        previous[i] = j;
      }
    }
  }

  let end = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (length[i] > length[end]) end = i;
  }

  const keep = new Set<number>();
  for (let i = end; i !== -1; i = previous[i]) keep.add(i);

  return points.filter((_, index) => !keep.has(index)).map((point) => point.kind);
}
