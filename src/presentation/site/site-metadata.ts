import type { Metadata } from "next";
import { articleHref } from "@/application/read-models/published-article";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { readerActor, siteUseCases } from "@/presentation/composition";
import { requestOriginFromNextHeaders } from "@/presentation/http/request-origin";

/**
 * generateMetadata の中身（feat-blog-ui-builder §SEO/AI 検索）。
 *
 * title / description / canonical / OGP を画面と同じ読み取りモデルから作る。
 * ページごとに別の取り方をすると、画面の見出しと検索結果の見出しがずれる。
 * 読めなかったときは **空を返す**（誤った canonical を配るより無い方がよい）。
 */

/**
 * 検索エンジンへの表示の許し方。
 *
 * 既定（何も書かない）でも index はされるが、snippet や画像プレビューの
 * 長さは検索エンジン任せになる。Google の AI 最適化ガイドの条件は
 * 「index 可能・snippet 表示可能」なので、切り詰めない意思を明示する
 * （max-snippet -1 = 長さ制限を課さない、max-image-preview large）。
 */
const ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
  },
};

/** サイト直下と子ページのcanonical pathを同じ規則で組み立てる。 */
export function siteCanonicalPath(siteSlug: string, path = ""): string {
  return `${siteBasePathBySlug(siteSlug)}${path}`;
}

/**
 * 公開URLはリクエストごとのhostから作る。
 *
 * このアプリは同じ実装で複数ブログhostを扱うため、固定のmetadataBaseを
 * 置けない。Next.jsのmetadata URLへ相対pathを渡すこともできないので、
 * proxyが伝えた公開hostを優先して絶対URLへ変換する。hostが無い・壊れて
 * いる場合は、推測したcanonicalを配らずnullにする。
 */
export async function siteMetadataUrl(siteSlug: string, path = ""): Promise<string | null> {
  const origin = await requestOriginFromNextHeaders();
  return origin === null ? null : `${origin}${siteCanonicalPath(siteSlug, path)}`;
}

export async function siteHomeMetadata(siteSlug: string): Promise<Metadata> {
  const [found, canonical] = await Promise.all([
    (await siteUseCases()).getSite.execute(readerActor(), { siteSlug }),
    siteMetadataUrl(siteSlug),
  ]);
  if (!found.ok) return {};
  const blueprint = found.value.blueprint;
  return {
    title: blueprint.name,
    description: blueprint.purpose,
    ...(canonical === null ? {} : { alternates: { canonical } }),
    robots: ROBOTS,
    openGraph: {
      title: blueprint.name,
      description: blueprint.purpose,
      type: "website",
      ...(canonical === null ? {} : { url: canonical }),
      siteName: blueprint.name,
      locale: "ja_JP",
    },
    twitter: {
      card: "summary",
      title: blueprint.name,
      description: blueprint.purpose,
    },
  };
}

export async function articleMetadata(siteSlug: string, slug: string): Promise<Metadata> {
  const useCases = await siteUseCases();
  // 記事とサイトを同時に読む。siteName（og:site_name）はサイト設計図が正本で、
  // 記事側に写しを持たせない。サイトだけ読めなかったときは siteName を省く
  // （記事の metadata まで空にすると、読めている情報も配れなくなる）。
  const [result, found] = await Promise.all([
    useCases.getArticle.execute(readerActor(), { siteSlug, slug }),
    useCases.getSite.execute(readerActor(), { siteSlug }),
  ]);
  if (!result.ok) return {};
  const article = result.value;
  const canonical = await siteMetadataUrl(siteSlug, articleHref(article));
  return {
    title: article.title,
    description: article.summary,
    ...(canonical === null ? {} : { alternates: { canonical } }),
    robots: ROBOTS,
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      ...(canonical === null ? {} : { url: canonical }),
      ...(found.ok ? { siteName: found.value.blueprint.name } : {}),
      locale: "ja_JP",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author.name],
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.summary,
    },
  };
}

type ArticlePageMetadataProps<SlugKey extends string> = {
  readonly params: Promise<{ readonly site: string } & Readonly<Record<SlugKey, string>>>;
};

/**
 * 記事種別ごとに違う route param 名だけを渡す metadata adapter。
 * 読み取り・canonical・OGP は `articleMetadata` から分岐させない。
 */
export function createArticlePageMetadata<SlugKey extends string>(slugKey: SlugKey) {
  return async ({ params }: ArticlePageMetadataProps<SlugKey>): Promise<Metadata> => {
    const resolved = await params;
    return articleMetadata(resolved.site, resolved[slugKey]);
  };
}
