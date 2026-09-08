import type { SectionId } from "./article-structure";
import type { SitePattern } from "./site-blueprint";

/**
 * ブログの型ごとに、書き方のどこを強く見るか。
 *
 * **決めごと本体は 1 つのまま**にして、ブログごとに変わるのは「重み」だけにする。
 * 決めごとをブログごとに丸ごと複製すると、10 本のブログで 10 通りの
 * 「文体の決まり」ができる。そうなると公開前の検査がどれを見ればよいか決まらない。
 *
 * ここが持つのは次の 2 つだけである。
 *
 * - `emphasized` — その型で特に外せない節 (`SectionId`)
 * - `note` — なぜその節を強く見るのか
 *
 * `required` を書き換えないのは意図である。欠かせない節を型ごとに変えると、
 * 「この型では省いてよい」がブログ側の設定で作れてしまう。
 * 強調は**足すだけ**で、決めごとを緩めない。
 *
 * 検査: tests/domain/pattern-writing-emphasis.test.ts
 */
export type WritingEmphasis = {
  readonly emphasized: readonly SectionId[];
  readonly note: string;
};

export const PATTERN_WRITING_EMPHASIS: Readonly<Record<SitePattern, WritingEmphasis>> = {
  specialist_review: {
    emphasized: ["methodology", "test_conditions", "measurements"],
    note: "専門レビュー型は「どう調べたか」が信用の土台です。手順と条件と実測値を先に出します。",
  },
  comparison_lab: {
    emphasized: ["quick_comparison", "how_to_choose", "use_case_best"],
    note: "比較研究所型は、並べる前に「何で比べるか」を示さないと、順位が好みに見えます。",
  },
  beginner_guide: {
    emphasized: ["target_audience", "how_to_choose", "toc"],
    note: "初心者案内型は、読者が自分向けかを最初に判断できることを最優先にします。",
  },
  personal_brand: {
    emphasized: ["byline", "experience", "conversation"],
    note: "個人ブランド型は、誰が何を実際にやったかが読む理由そのものです。",
  },
  product_discovery: {
    emphasized: ["product_cards", "alternatives", "excluded_products"],
    note: "商品発見型は、選ばなかったものを出さないと「都合のよい候補だけ」に見えます。",
  },
  service_signup: {
    emphasized: ["disclosure", "not_suitable_for", "cons"],
    note: "サービス申込み型は、申し込みに近いぶん、向いていない人と欠点を強く出します。",
  },
  tool: {
    emphasized: ["one_sentence_conclusion", "measurements", "body"],
    note: "ツール型は、結論と数字が先に出ないと、道具として使えません。",
  },
  editorial_media: {
    emphasized: ["dates", "byline", "methodology"],
    note: "メディア編集部型は、いつ誰がどう確かめたかが記事の署名です。",
  },
  story: {
    emphasized: ["experience", "body", "conversation"],
    note: "ストーリー型は体験が本体です。ただし体験だけを根拠にはしません。",
  },
  database: {
    emphasized: ["quick_comparison", "product_cards", "dates"],
    note: "データベース型は、件数より「いつ時点の値か」が読者の判断を決めます。",
  },
};
