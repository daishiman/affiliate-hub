import type { ArticleType } from "@/domain/authoring";
import { UNKNOWN_ARTICLE_AUTHOR } from "@/domain/blogops";
import { trackingPathForCode } from "@/domain/monetization";

/**
 * 読者に見せる記事の形（読み取り専用）。
 *
 * 書き込み側の集約（`ContentPackage`）とは別に置く。
 * 読者向けの画面は「編集中の状態」や「承認の履歴」を必要としない。
 * 同じ型を使い回すと、読者向け API に編集中の内容が漏れる事故が起きる。
 *
 * ここに**報酬に関わる欄は無い**。
 * 読者向けの読み取り経路に報酬額が現れないことを、型で保証している。
 */

export type FactKind = "fact" | "inference" | "opinion";

/** 記事の中の 1 つの言い切りと、その根拠。 */
export type PublishedClaim = {
  readonly id: string;
  readonly statement: string;
  readonly kind: FactKind;
  readonly evidence: readonly PublishedEvidence[];
};

export type PublishedEvidence = {
  readonly id: string;
  readonly sourceLabel: string;
  readonly url?: string;
  /** いつ確認したか（YYYY-MM-DD）。 */
  readonly checkedAt: string;
  readonly expired?: boolean;
};

/**
 * よくある質問 1 件（`EXPRESSION_BLOCK_KINDS` の `faq`）。
 *
 * 節（`PublishedSection`）と分けて持つ。節に混ぜると、問いと答えの対が
 * 「見出しと段落」に崩れ、`FAQPage` の構造化データを作れなくなる
 * （どの見出しが問いなのかを後から言い当てられない）。
 */
export type PublishedFaqItem = {
  readonly question: string;
  readonly answer: string;
};

/** 記事の 1 節。見出しと本文。 */
export type PublishedSection = {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  /** この節で述べている主張。無い節（導入など）もある。 */
  readonly claims?: readonly PublishedClaim[];
};

/** 会話ブロック（ブログ層 §11）。話者は 4 種類。 */
export type ConversationSpeaker = "reader" | "writer" | "expert" | "assistant";

export type PublishedConversationLine = {
  readonly speaker: ConversationSpeaker;
  /** 40〜120 字。仕様の制約は生成側で守る。 */
  readonly text: string;
};

export type PublishedRankingEntry = {
  readonly productId: string;
  readonly rank: number;
  readonly productName: string;
  readonly totalScore: number;
  readonly criterionScores: readonly number[];
  /** 成果リンク。無い商品もある（提携していない場合）。 */
  readonly affiliateUrl?: string;
  /**
   * 転送の入口の合言葉。あるときは読者を `/go/<合言葉>` へ送り、
   * サーバー側でクリックを数える（画面の JavaScript が動かなくても数えられる）。
   *
   * **無いときは `affiliateUrl` をそのまま出す。** 出さない選択にすると、
   * 計測の準備ができていないだけで読者の買う導線が消える。
   */
  readonly trackingCode?: string;
  /**
   * 個別レビュー記事の名前。まだレビューを書いていない商品もあるので任意。
   * 無いときは商品名をリンクにしない（存在しないページへ送らない）。
   */
  readonly reviewSlug?: string;
  readonly oneLine: string;
};

export type PublishedCriterion = {
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly measurement: string;
};

export type PublishedComparisonColumn = {
  readonly key: string;
  readonly label: string;
  readonly unit?: string;
  readonly numeric?: boolean;
};

export type PublishedComparisonRow = {
  readonly id: string;
  readonly label: string;
  readonly cells: Readonly<
    Record<string, { readonly value: string; readonly kind?: FactKind; readonly checkedAt?: string }>
  >;
};

/**
 * 商品カード 1 枚ぶん（記事構成 `product_cards`）。
 *
 * 値が無い項目は**省略せず `null` で渡す**。省略できるようにすると、
 * 商品ごとに項目の並びが変わり、読者が横に見比べられなくなる。
 */
export type PublishedProductCardSpec = {
  readonly label: string;
  readonly value: string | null;
  /** 実測値か、公表仕様からの推測か。 */
  readonly kind: Extract<FactKind, "fact" | "inference">;
};

export type PublishedProductCard = {
  readonly productId: string;
  readonly name: string;
  readonly brand: string;
  readonly oneLine: string;
  readonly specs: readonly PublishedProductCardSpec[];
  /** 価格の扱い方。金額そのものは載せない（書き写した価格は必ず古くなる）。 */
  readonly priceNote?: string;
  /** ASP が発行した URL。加工せずそのまま渡す。 */
  readonly affiliateUrl?: string;
  /** 転送の入口の合言葉。詳しくは [[PublishedRankingEntry]] の同名の欄。 */
  readonly trackingCode?: string;
  /** 買う導線を出せない理由。黙って消さない。 */
  readonly blockedReason?: string;
  readonly reviewSlug?: string;
};

export type PublishedPerson = {
  readonly slug: string;
  readonly name: string;
  /** 何をしてきた人か。1 段落。 */
  readonly bio: string;
  /** 資格・経歴。無ければ空配列（「無い」ことを隠さない）。 */
  readonly credentials: readonly string[];
};

/**
 * 記事 1 本。
 *
 * `disclosureRequired` は記事側が持つ。画面側で判断させない。
 * 画面ごとに条件式を書くと、どこかの画面で表示が抜ける。
 */
export type PublishedArticle = {
  readonly slug: string;
  readonly siteSlug: string;
  readonly type: ArticleType;
  readonly title: string;
  /** 検索結果と一覧に出す 1 文。 */
  readonly summary: string;
  readonly categorySlug: string;
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly author: PublishedPerson;
  /** 監修者。付いていない記事もある。 */
  readonly reviewedBy?: PublishedPerson;
  readonly disclosureRequired: boolean;
  /**
   * 記事の要点（`EXPRESSION_BLOCK_KINDS` の `key_points`）。
   *
   * 10 種の表現ブロックのうち、**置き場が他に無いのはこれだけ**である。
   * 結論は `summary`、出典は `sections[].claims[].evidence`、更新日は
   * `updatedAt`、質問は `faq` に既に住んでいるので、それらを別欄で
   * 二重に持たない（`docs/product/design-decisions.md` §6）。
   *
   * **空配列では入れない**（`faq` と同じ扱い）。
   */
  readonly keyPoints?: readonly string[];
  readonly sections: readonly PublishedSection[];
  readonly conversation?: readonly PublishedConversationLine[];
  /**
   * よくある質問。無い記事もあるので任意。
   *
   * **空配列では入れない。** 空で入れると画面の「あるか」の判定が真になり、
   * 見出しだけの空欄が読者に出る（商品カードと同じ扱い）。
   */
  readonly faq?: readonly PublishedFaqItem[];
  /** 商品カード。順位・レビュー・比較のどの型でも使う。 */
  readonly productCards?: readonly PublishedProductCard[];
  /** 順位記事のときだけ入る。 */
  readonly ranking?: {
    readonly caption: string;
    readonly updatedAt: string;
    readonly criteria: readonly PublishedCriterion[];
    readonly entries: readonly PublishedRankingEntry[];
    readonly excluded: readonly { readonly productId: string; readonly productName: string; readonly reason: string }[];
  };
  /** 比較記事のときだけ入る。 */
  readonly comparison?: {
    readonly caption: string;
    readonly columns: readonly PublishedComparisonColumn[];
    readonly rows: readonly PublishedComparisonRow[];
  };
  /** 「まだ中身が無い」記事であることの明示。見本を本物に見せない。 */
  readonly stub?: { readonly label: string; readonly blockedBy: string };
};

/** 一覧に出すときの短い形。本文を積まない（一覧で全文を読み込ませない）。 */
export type ArticleSummary = {
  readonly slug: string;
  readonly siteSlug: string;
  readonly type: ArticleType;
  readonly title: string;
  readonly summary: string;
  readonly categorySlug: string;
  readonly updatedAt: string;
  readonly authorName: string;
};

/**
 * 記事の URL。
 *
 * 記事タイプからルートを決める。**画面側で組み立てさせない。**
 * 組み立てさせると、一覧・検索・記事内リンクで違う URL ができ、
 * 同じ記事に 2 つの入口ができてしまう。
 */
const PATH_PREFIX: Readonly<Record<ArticleType, string>> = {
  ranking: "/best",
  review: "/reviews",
  comparison: "/compare",
  guide: "/guides",
  tool: "/tools",
};

export function articleHref(article: Pick<ArticleSummary, "type" | "slug">): string {
  return `${PATH_PREFIX[article.type]}/${article.slug}`;
}

/**
 * BlogOps の編集 aggregate を、公開時点の rich projection へ決定的に写す。
 *
 * この変換を D1 adapter に書くと migration と公開操作で本文の形が分かれる。
 * 入力に無い経歴・根拠・カテゴリは作り話で補わない。
 */
export function projectBlogArticle(input: {
  readonly id: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly type: ArticleType;
  readonly title: string;
  readonly lead: string;
  readonly authorName: string;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
  readonly categorySlug: string;
  readonly blocks: readonly {
    readonly id: string;
    readonly kind: string;
    readonly heading: string;
    readonly body: string;
  }[];
}): PublishedArticle {
  const author =
    input.authorName.trim() === ""
      ? UNKNOWN_ARTICLE_AUTHOR
      : { slug: `source-${input.id}`, name: input.authorName.trim() };
  const summary = input.lead.trim() === "" ? input.title : input.lead.trim();
  const sections =
    input.blocks.length === 0
      ? [{ id: `${input.id}-body`, heading: "本文", paragraphs: [summary] }]
      : input.blocks.map((block) => ({
          id: block.id,
          heading: block.heading.trim() === "" ? "本文" : block.heading.trim(),
          paragraphs: [block.body],
        }));
  return {
    slug: input.slug,
    siteSlug: input.siteSlug,
    type: input.type,
    title: input.title,
    summary,
    categorySlug: input.categorySlug,
    publishedAt: input.publishedAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    author: {
      ...author,
      bio: "",
      credentials: [],
    },
    disclosureRequired: input.blocks.some((block) => block.kind === "disclosure-notice"),
    sections,
  };
}

/**
 * 読者を送り出す先を決める。
 *
 * 合言葉があるときは転送の入口（`/go/<合言葉>`）へ、無いときは ASP の URL へ。
 * **どちらの場合も URL を組み立て直さない。** ASP の URL に何かを足すと
 * 多くの ASP で規約違反になり、成果そのものが計上されなくなる。
 *
 * --- なぜ読者の画面側に置かないのか ---
 * 読者の画面は提携・報酬のドメインを読まない決まりになっている
 * （tests/architecture/dependency-direction.test.ts）。入口の道の形は
 * domain（`trackingPathForCode`）が持つので、読み替えはこの境界の型を
 * 預かっているここで済ませ、画面には出来上がった道だけを渡す。
 */
export function outboundHref(
  trackingCode: string | undefined,
  affiliateUrl: string | undefined,
): string | undefined {
  if (trackingCode !== undefined) return trackingPathForCode(trackingCode);
  return affiliateUrl;
}

export function toSummary(article: PublishedArticle): ArticleSummary {
  return {
    slug: article.slug,
    siteSlug: article.siteSlug,
    type: article.type,
    title: article.title,
    summary: article.summary,
    categorySlug: article.categorySlug,
    updatedAt: article.updatedAt,
    authorName: article.author.name,
  };
}
