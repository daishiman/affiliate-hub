import type { ReadSiteDeps } from "./read-site";
import type {
  FactKind,
  PublishedArticle,
  PublishedComparisonColumn,
  PublishedComparisonRow,
  PublishedCriterion,
  PublishedEvidence,
  PublishedProductCard,
  PublishedRankingEntry,
} from "@/application/read-models/published-article";
import { READER_DISCLOSURE_TEXT } from "@/domain/compliance/disclosure";
import { domainError, err, ok, type Result, type DomainError } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 読者ページに載せる AI 向けの道具が読む、記事の中身。
 *
 * --- なぜ商品テーブルではなく記事から切り出すのか ---
 * 読者ページは `/best`（順位）も `/reviews`（レビュー）も `/compare`（比較）も、
 * すべて `createGetArticleUseCase` **1 つ**を呼んでいる
 * （`src/presentation/site/article-page.tsx`）。読者が見ているのは記事であって、
 * 商品台帳ではない。
 *
 * だから道具も同じ記事から切り出す。こうすると
 * **「画面に出していない項目が道具から出る」ことが原理的に起きない。**
 * 商品台帳へ公開の読み取りを新設する道もあるが、そちらは
 * 「画面に出す範囲」と「道具が返す範囲」を人が二重に管理することになり、
 * ずれた瞬間にそこが漏れ口になる。ここでは入口を 1 つに保つ。
 *
 * --- 権限について ---
 * `read-site.ts` と同じで、ここにも権限判定を置かない。
 * 未公開のものが流れてこないことは `EditorialPublishedContentPort`
 * （公開済みのものしか返さない宣言）が担保する。
 * 管理用の読み取り（`read-product.ts`）は `product.read` を要求したままで、
 * 読者の身元では引き続き断られる。**そちらは緩めない。**
 *
 * --- 記事にその面が無いとき ---
 * 失敗にせず、空の結果と**理由**を返す。
 * 比較記事で順位を尋ねられるのは誤りではなく、
 * 「この記事には順位が無い」が答えである。失敗として返すと、
 * AI も画面も「読み込めませんでした」と嘘をつく。
 */

export type ArticleFacetInput = {
  readonly siteSlug: string;
  readonly slug: string;
};

/** 記事にその面が無いときに添える 1 行。空の結果を黙って返さない。 */
type Notice = string | null;

function notFound(): DomainError {
  return domainError("NOT_FOUND", "記事が見つかりません。", {
    suggestedAction: "URL が正しいかご確認ください。トップから探し直すこともできます。",
  });
}

/** 記事を 1 本引く。どの道具も必ずここを通る。 */
async function loadArticle(
  deps: ReadSiteDeps,
  input: ArticleFacetInput,
): Promise<Result<PublishedArticle, DomainError>> {
  const found = await deps.content.findArticle(input.siteSlug, input.slug);
  if (!found.ok) return found;
  if (found.value === null) return err(notFound());
  return ok(found.value);
}

/** 記事 1 本を読んで、その一面だけを取り出す道具を作る。 */
function facetUseCase<TInput extends ArticleFacetInput, TOutput>(
  deps: ReadSiteDeps,
  pick: (article: PublishedArticle, input: TInput) => Result<TOutput, DomainError>,
): UseCase<TInput, TOutput> {
  return {
    async execute(_actor, input) {
      const article = await loadArticle(deps, input);
      if (!article.ok) return article;
      return pick(article.value, input);
    },
  };
}

// ---------------------------------------------------------------------------
// 順位
// ---------------------------------------------------------------------------

export type ArticleRankingOutput = {
  readonly caption: string | null;
  readonly updatedAt: string | null;
  readonly entries: readonly PublishedRankingEntry[];
  readonly notice: Notice;
};

/**
 * この記事が載せている順位。
 *
 * 順位が無い記事（比較・レビュー・選び方）では空を返し、理由を添える。
 */
export function createReadArticleRankingUseCase(
  deps: ReadSiteDeps,
): UseCase<ArticleFacetInput, ArticleRankingOutput> {
  return facetUseCase<ArticleFacetInput, ArticleRankingOutput>(deps, (article) => {
    if (article.ranking === undefined) {
      return ok({
        caption: null,
        updatedAt: null,
        entries: [],
        notice: "この記事は順位を載せていません。順位は「おすすめ」の記事にあります。",
      });
    }
    return ok({
      caption: article.ranking.caption,
      updatedAt: article.ranking.updatedAt,
      entries: article.ranking.entries,
      notice: null,
    });
  });
}

export type ExplainArticleRankingInput = ArticleFacetInput & {
  /** 1 商品だけの内訳を見たいとき。省略すると全体の決め方を返す。 */
  readonly productId?: string;
};

export type ExplainArticleRankingOutput = {
  readonly criteria: readonly PublishedCriterion[];
  /** 選外にした商品と、その理由。順位に出ていないものを黙って消さない。 */
  readonly excluded: readonly {
    readonly productId: string;
    readonly productName: string;
    readonly reason: string;
  }[];
  /** `productId` を指定したときだけ入る、その 1 件の内訳。 */
  readonly entry: PublishedRankingEntry | null;
  readonly notice: Notice;
};

/**
 * なぜこの順位なのか。
 *
 * 評価基準（重みと測り方）と選外の理由を返す。
 * **重みを隠さない。** 順位だけ見せて決め方を見せないのは、
 * 読者がその順位を自分で検算できない状態を作る。
 */
export function createExplainArticleRankingUseCase(
  deps: ReadSiteDeps,
): UseCase<ExplainArticleRankingInput, ExplainArticleRankingOutput> {
  return facetUseCase<ExplainArticleRankingInput, ExplainArticleRankingOutput>(deps, (article, input) => {
    if (article.ranking === undefined) {
      return ok({
        criteria: [],
        excluded: [],
        entry: null,
        notice: "この記事は順位を載せていないため、順位の決め方もありません。",
      });
    }
    const { criteria, entries, excluded } = article.ranking;
    if (input.productId === undefined) {
      return ok({ criteria, excluded, entry: null, notice: null });
    }
    const entry = entries.find((e) => e.productId === input.productId) ?? null;
    if (entry === null) {
      const droppedReason = excluded.find((e) => e.productId === input.productId)?.reason ?? null;
      return ok({
        criteria,
        excluded,
        entry: null,
        notice:
          droppedReason === null
            ? "その商品はこの記事の順位に出てきません。"
            : `その商品は順位から外しています。理由: ${droppedReason}`,
      });
    }
    return ok({ criteria, excluded, entry, notice: null });
  });
}

// ---------------------------------------------------------------------------
// 商品
// ---------------------------------------------------------------------------

export type GetArticleProductInput = ArticleFacetInput & { readonly productId: string };

export type GetArticleProductOutput = {
  readonly card: PublishedProductCard | null;
  readonly notice: Notice;
};

/**
 * この記事が出している商品カード 1 枚。
 *
 * 画面に出しているカードそのものを返す。**台帳の商品を引き直さない。**
 * 引き直すと、記事が公開時点で確定させた内容と、いま台帳にある内容がずれる。
 */
export function createGetArticleProductUseCase(
  deps: ReadSiteDeps,
): UseCase<GetArticleProductInput, GetArticleProductOutput> {
  return facetUseCase<GetArticleProductInput, GetArticleProductOutput>(deps, (article, input) => {
    const card = (article.productCards ?? []).find((c) => c.productId === input.productId) ?? null;
    if (card === null) {
      return ok({
        card: null,
        notice: "この記事はその商品を扱っていません。この記事に出ている商品からお選びください。",
      });
    }
    return ok({ card, notice: null });
  });
}

export type FilterArticleProductsInput = ArticleFacetInput & {
  /** 商品名・ブランド・1 文説明・仕様の値に含まれる言葉。 */
  readonly text?: string;
  readonly limit?: number;
};

export type FilterArticleProductsOutput = {
  readonly cards: readonly PublishedProductCard[];
  /** 絞り込む前の件数。0 件になったときに「元は何件あったか」が分かる。 */
  readonly totalBeforeFilter: number;
  readonly notice: Notice;
};

const DEFAULT_CARD_LIMIT = 20;

/** 商品カードの中に、その言葉があるか。仕様の値まで見る（「防水」を仕様欄から拾う）。 */
function cardMatches(card: PublishedProductCard, needle: string): boolean {
  const haystack = [
    card.name,
    card.brand,
    card.oneLine,
    ...card.specs.flatMap((s) => [s.label, s.value ?? ""]),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

/**
 * この記事の商品を言葉で絞る。
 *
 * 0 件を失敗にしない。0 件は「そういう結果」なので、
 * 元の件数と一緒に返して、探し直せるようにする。
 */
export function createFilterArticleProductsUseCase(
  deps: ReadSiteDeps,
): UseCase<FilterArticleProductsInput, FilterArticleProductsOutput> {
  return facetUseCase<FilterArticleProductsInput, FilterArticleProductsOutput>(deps, (article, input) => {
    const all = article.productCards ?? [];
    const limit = input.limit ?? DEFAULT_CARD_LIMIT;
    const needle = (input.text ?? "").trim().toLowerCase();
    const hits = needle === "" ? all : all.filter((c) => cardMatches(c, needle));
    const notice =
      all.length === 0
        ? "この記事は商品カードを載せていません。"
        : hits.length === 0
          ? `「${input.text ?? ""}」に当てはまる商品は、この記事の ${all.length} 件の中にありませんでした。`
          : null;
    return ok({ cards: hits.slice(0, limit), totalBeforeFilter: all.length, notice });
  });
}

export type FindArticleAlternativesInput = ArticleFacetInput & { readonly productId: string };

export type FindArticleAlternativesOutput = {
  readonly alternatives: readonly PublishedProductCard[];
  readonly notice: Notice;
};

/**
 * この記事の中の、ほかの選択肢。
 *
 * 記事の外から商品を持って来ない。持って来ると、
 * その商品について読者が読んでいる根拠が 1 つも無い状態で名前だけが出る。
 */
export function createFindArticleAlternativesUseCase(
  deps: ReadSiteDeps,
): UseCase<FindArticleAlternativesInput, FindArticleAlternativesOutput> {
  return facetUseCase<FindArticleAlternativesInput, FindArticleAlternativesOutput>(deps, (article, input) => {
    const all = article.productCards ?? [];
    if (!all.some((c) => c.productId === input.productId)) {
      return ok({
        alternatives: [],
        notice: "この記事はその商品を扱っていないため、ほかの選択肢も出せません。",
      });
    }
    const others = all.filter((c) => c.productId !== input.productId);
    return ok({
      alternatives: others,
      notice: others.length === 0 ? "この記事はその商品 1 件だけを扱っています。" : null,
    });
  });
}

// ---------------------------------------------------------------------------
// 比較
// ---------------------------------------------------------------------------

export type CompareArticleProductsOutput = {
  readonly caption: string | null;
  readonly columns: readonly PublishedComparisonColumn[];
  readonly rows: readonly PublishedComparisonRow[];
  readonly notice: Notice;
};

/**
 * この記事が出している比較表。
 *
 * 画面の表をそのまま返す。ここで並べ替えや列の作り直しをしない。
 * すると「画面の答え」と「AI の答え」が別のものになる。
 */
export function createCompareArticleProductsUseCase(
  deps: ReadSiteDeps,
): UseCase<ArticleFacetInput, CompareArticleProductsOutput> {
  return facetUseCase<ArticleFacetInput, CompareArticleProductsOutput>(deps, (article) => {
    if (article.comparison === undefined) {
      return ok({
        caption: null,
        columns: [],
        rows: [],
        notice: "この記事は比較表を載せていません。比較表は「比較」の記事にあります。",
      });
    }
    return ok({ ...article.comparison, notice: null });
  });
}

// ---------------------------------------------------------------------------
// 広告であることの表示
// ---------------------------------------------------------------------------

export type ArticleDisclosureOutput = {
  /** この記事に広告表示を出しているか。画面の判断と同じ値を使う。 */
  readonly disclosureRequired: boolean;
  /**
   * 記事の冒頭に出している文そのもの。**画面と 1 文字も違わない。**
   *
   * 真偽値だけ返すと、AI は広告である旨を**自分の言葉で言い直す**。
   * 言い直された断りは、こちらが法令に照らして決めた文ではなくなる
   * （§20.2 は `article_top` と `ai_answer` / `webmcp_response` の
   * 両方で表示を求めている）。だから文を渡す。
   * 出していない記事では `null`（出していない事実を、空文字と混同させない）。
   */
  readonly visibleMessage: string | null;
  /** 順位のある記事では「報酬を順位に使っていない」も併せて出している。 */
  readonly showsRankingNote: boolean;
  /** 上の一文。順位が無い記事では `null`。 */
  readonly rankingNote: string | null;
  /** 広告方針の文書。画面の表示から辿れるものと同じ。 */
  readonly policy: { readonly title: string; readonly body: readonly string[] } | null;
  readonly notice: Notice;
};

const ADVERTISING_POLICY_KEY = "advertising-policy";

/**
 * この記事の広告表示。
 *
 * 設定台帳（`list_disclosures`）を読みに行かない。あちらは `content.read` を要求する
 * 運営側の読み取りで、読者の身元では断られる。**そこを緩めない。**
 * 読者に必要なのは「この記事は広告か」と「方針はどこに書いてあるか」で、
 * どちらも記事と公開文書から出せる。
 */
export function createGetArticleDisclosureUseCase(
  deps: ReadSiteDeps,
): UseCase<ArticleFacetInput, ArticleDisclosureOutput> {
  return {
    async execute(_actor, input) {
      const article = await loadArticle(deps, input);
      if (!article.ok) return article;
      const policy = await deps.content.findPolicyDocument(input.siteSlug, ADVERTISING_POLICY_KEY);
      if (!policy.ok) return policy;
      const required = article.value.disclosureRequired;
      const hasRanking = article.value.ranking !== undefined;
      return ok({
        disclosureRequired: required,
        visibleMessage: required ? READER_DISCLOSURE_TEXT.body : null,
        // 画面は広告表示の枠の中にこの一文を置く。枠ごと出ない記事では出ない。
        showsRankingNote: required && hasRanking,
        rankingNote: required && hasRanking ? READER_DISCLOSURE_TEXT.rankingNote : null,
        policy: policy.value,
        notice:
          policy.value === null
            ? "このブログはまだ広告方針の文書を出していません。"
            : null,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// 根拠
// ---------------------------------------------------------------------------

export type GetArticleEvidenceInput = ArticleFacetInput & {
  /** 1 つの言い切りの根拠だけを見たいとき。 */
  readonly claimId?: string;
};

export type ArticleClaimEvidence = {
  readonly claimId: string;
  readonly statement: string;
  /** 事実か、推測か、意見か。根拠の強さの前に、種類を先に出す。 */
  readonly kind: FactKind;
  readonly sectionHeading: string;
  readonly evidence: readonly PublishedEvidence[];
};

export type GetArticleEvidenceOutput = {
  readonly claims: readonly ArticleClaimEvidence[];
  readonly notice: Notice;
};

/**
 * この記事の言い切りと、その根拠。
 *
 * **根拠の無い言い切りも隠さずに返す**（`evidence` が空配列として出る）。
 * 根拠のあるものだけ返すと、AI からは「この記事の主張はすべて裏付けがある」
 * ように見えてしまう。確認日が切れているものも `expired` を付けたまま返す。
 */
export function createGetArticleEvidenceUseCase(
  deps: ReadSiteDeps,
): UseCase<GetArticleEvidenceInput, GetArticleEvidenceOutput> {
  return facetUseCase<GetArticleEvidenceInput, GetArticleEvidenceOutput>(deps, (article, input) => {
    const all: ArticleClaimEvidence[] = [];
    for (const section of article.sections) {
      for (const claim of section.claims ?? []) {
        all.push({
          claimId: claim.id,
          statement: claim.statement,
          kind: claim.kind,
          sectionHeading: section.heading,
          evidence: claim.evidence,
        });
      }
    }
    if (input.claimId !== undefined) {
      const one = all.find((c) => c.claimId === input.claimId);
      return ok(
        one === undefined
          ? { claims: [], notice: "その言い切りはこの記事にありません。" }
          : { claims: [one], notice: null },
      );
    }
    return ok({
      claims: all,
      notice: all.length === 0 ? "この記事には根拠を付けた言い切りがありません。" : null,
    });
  });
}
