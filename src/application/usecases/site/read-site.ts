import type {
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "@/application/ports/site";
import type {
  ArticleSummary,
  PublishedArticle,
  PublishedPerson,
} from "@/application/read-models/published-article";
import { type SiteBlueprint, routesFor } from "@/domain/authoring";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 読者向けブログの読み取りユースケース。
 *
 * ここに**権限判定は入れない**。理由:
 * 公開してよいかの判定は「公開するとき」に済んでいる (compliance の公開ゲート)。
 * 読むときにもう一度権限を要求すると、ログインしていない読者が記事を読めなくなる。
 * 未公開の記事がここへ流れてこないことは、受け取るポートが
 * `PublishedContentPort`（公開済みのものしか返さない宣言）であることで担保する。
 *
 * 一方で `ActorContext` は引数に残す。画面・REST・WebMCP・MCP の 4 経路が
 * 同じ関数を呼ぶという約束を、読者向けだけ崩さないため。
 *
 * 依存は Editorial 印のポートだけ。報酬に関わるポートは型でも実行時でも入らない。
 * 入れられると「報酬の高い商品を上に出す一覧」が書けてしまう。
 */

export type ReadSiteDeps = {
  readonly sites: EditorialSiteRepositoryPort;
  readonly content: EditorialPublishedContentPort;
};

/** 依存の受け取り口。全ユースケースで同じ確認を通す。 */
function guardEditorial(deps: ReadSiteDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `読者向けの読み取りに商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を読者向けの並び順や表示の入力にすることはできません。",
    );
  }
}

function notFound(what: string): DomainError {
  return domainError("NOT_FOUND", `${what}が見つかりません。`, {
    suggestedAction: "URL が正しいかご確認ください。トップから探し直すこともできます。",
  });
}

// ---------------------------------------------------------------------------
// サイトそのもの
// ---------------------------------------------------------------------------

export type GetSiteInput = { readonly siteSlug: string };
export type GetSiteOutput = {
  readonly blueprint: SiteBlueprint;
  /** このブログで出す画面の一覧。ヘッダー・フッターの導線はここから作る。 */
  readonly routes: ReturnType<typeof routesFor>;
};

/**
 * ブログ 1 本の設計図を引く。
 *
 * すべてのブログ画面がまずこれを呼ぶ。ブログを増やしてもこの関数は変わらない。
 * 変わるのは保存されている設定値だけ（変更容易性シナリオ③の実測対象）。
 */
export function createGetSiteUseCase(deps: ReadSiteDeps): UseCase<GetSiteInput, GetSiteOutput> {
  guardEditorial(deps);
  return {
    async execute(
      _actor: ActorContext,
      input: GetSiteInput,
    ): Promise<Result<GetSiteOutput, DomainError>> {
      const found = await deps.sites.findBySlug(input.siteSlug);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ"));
      return ok({ blueprint: found.value, routes: routesFor(found.value) });
    },
  };
}

export type ListSitesOutput = readonly {
  readonly slug: string;
  readonly blueprint: SiteBlueprint;
}[];

/**
 * 引数の無いユースケースの入力。
 *
 * `void` にすると、入力の形を JSON Schema にできず
 * REST / WebMCP / MCP の 3 入口へ配れない。空の物として扱う。
 */
export type NoInput = Record<string, never>;

/** 運用中のブログ一覧。プラットフォーム側の一覧画面と、ブログ間の相互リンクで使う。 */
export function createListSitesUseCase(deps: ReadSiteDeps): UseCase<NoInput, ListSitesOutput> {
  guardEditorial(deps);
  return {
    async execute(): Promise<Result<ListSitesOutput, DomainError>> {
      return deps.sites.list();
    },
  };
}

// ---------------------------------------------------------------------------
// 記事の一覧
// ---------------------------------------------------------------------------

export const DEFAULT_LIST_LIMIT = 20;

export type ListRecentInput = { readonly siteSlug: string; readonly limit?: number };

/** トップに出す新着。0 件は失敗ではない（画面側で「まだありません」を出す）。 */
export function createListRecentArticlesUseCase(
  deps: ReadSiteDeps,
): UseCase<ListRecentInput, readonly ArticleSummary[]> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      return deps.content.listRecent(input.siteSlug, input.limit ?? DEFAULT_LIST_LIMIT);
    },
  };
}

export type ListByCategoryInput = {
  readonly siteSlug: string;
  readonly categorySlug: string;
};

export type ListByCategoryOutput = {
  readonly category: { readonly slug: string; readonly name: string; readonly oneLine: string };
  readonly articles: readonly ArticleSummary[];
};

/**
 * カテゴリーの記事一覧。
 *
 * カテゴリー名と 1 文説明も一緒に返す。画面側で設計図を引き直させない。
 * 引き直させると、カテゴリー名の出どころが画面ごとにばらける。
 */
export function createListByCategoryUseCase(
  deps: ReadSiteDeps,
): UseCase<ListByCategoryInput, ListByCategoryOutput> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      const site = await deps.sites.findBySlug(input.siteSlug);
      if (!site.ok) return site;
      if (site.value === null) return err(notFound("ブログ"));

      const category = site.value.categories.find((c) => c.slug === input.categorySlug);
      if (category === undefined) return err(notFound("カテゴリー"));

      const articles = await deps.content.listByCategory(input.siteSlug, input.categorySlug);
      if (!articles.ok) return articles;

      return ok({
        category: { slug: category.slug, name: category.name, oneLine: category.oneLine },
        articles: articles.value,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// 記事 1 本
// ---------------------------------------------------------------------------

export type GetArticleInput = { readonly siteSlug: string; readonly slug: string };

export function createGetArticleUseCase(
  deps: ReadSiteDeps,
): UseCase<GetArticleInput, PublishedArticle> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      const found = await deps.content.findArticle(input.siteSlug, input.slug);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("記事"));
      return ok(found.value);
    },
  };
}

// ---------------------------------------------------------------------------
// 探す
// ---------------------------------------------------------------------------

export type SearchArticlesInput = {
  readonly siteSlug: string;
  readonly query: string;
  readonly limit?: number;
};

export type SearchArticlesOutput = {
  readonly query: string;
  readonly hits: readonly ArticleSummary[];
};

/**
 * 記事を探す。
 *
 * 0 件を失敗にしない。0 件は「そういう結果」であり、
 * 失敗として返すと画面が「読み込めませんでした」と嘘をつく。
 */
export function createSearchArticlesUseCase(
  deps: ReadSiteDeps,
): UseCase<SearchArticlesInput, SearchArticlesOutput> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      const query = input.query.trim();
      if (query === "") {
        return err(
          domainError("VALIDATION_FAILED", "探したい言葉を入力してください。", {
            field: "query",
          }),
        );
      }
      const hits = await deps.content.search(input.siteSlug, query, input.limit ?? DEFAULT_LIST_LIMIT);
      if (!hits.ok) return hits;
      return ok({ query, hits: hits.value });
    },
  };
}

// ---------------------------------------------------------------------------
// 人
// ---------------------------------------------------------------------------

export type GetPersonInput = {
  readonly siteSlug: string;
  readonly kind: "author" | "expert";
  readonly slug: string;
};

export type GetPersonOutput = {
  readonly person: PublishedPerson;
  readonly kind: "author" | "expert";
  readonly articles: readonly ArticleSummary[];
};

/**
 * 書き手・監修者の紹介。
 *
 * 書いた記事も一緒に返す。誰が書いたかを名前だけ出しても、
 * 読者はその人を信頼してよいか判断できない。
 */
export function createGetPersonUseCase(deps: ReadSiteDeps): UseCase<GetPersonInput, GetPersonOutput> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      const person = await deps.content.findPerson(input.siteSlug, input.kind, input.slug);
      if (!person.ok) return person;
      if (person.value === null) {
        return err(notFound(input.kind === "author" ? "書き手" : "監修者"));
      }
      const articles = await deps.content.listByPerson(input.siteSlug, input.slug);
      if (!articles.ok) return articles;
      return ok({ person: person.value, kind: input.kind, articles: articles.value });
    },
  };
}

// ---------------------------------------------------------------------------
// 訂正と方針
// ---------------------------------------------------------------------------

export type ListCorrectionsInput = { readonly siteSlug: string };

/** 訂正の履歴。0 件でも画面を出す（「訂正はまだありません」と書く）。 */
export function createListCorrectionsUseCase(deps: ReadSiteDeps) {
  guardEditorial(deps);
  return {
    async execute(_actor: ActorContext, input: ListCorrectionsInput) {
      return deps.content.listCorrections(input.siteSlug);
    },
  };
}

export type GetPolicyDocumentInput = { readonly siteSlug: string; readonly key: string };
export type GetPolicyDocumentOutput = {
  readonly title: string;
  readonly body: readonly string[];
};

/**
 * 方針などの固定文書。
 *
 * 画面ごとに文章を直接書かない。書くと、広告方針の言い回しを変えたときに
 * 記事側の表示と食い違う（変更容易性シナリオ⑩の対象）。
 */
export function createGetPolicyDocumentUseCase(
  deps: ReadSiteDeps,
): UseCase<GetPolicyDocumentInput, GetPolicyDocumentOutput> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      const found = await deps.content.findPolicyDocument(input.siteSlug, input.key);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("この文書"));
      return ok(found.value);
    },
  };
}
