import type { Metadata } from "next";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { articleHref } from "@/application/read-models/published-article";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { resolveThumbnail, thumbnailAltText } from "@/domain/blogops";
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

/** OGP に載せる 1 枚。載せないときは null。 */
type OgImage = { readonly url: string; readonly alt: string };

/**
 * SNS と AI 検索へ渡す絵を決める。
 *
 * ==========================================================================
 * 生成した代替図版は OGP に載せない
 * ==========================================================================
 *
 * 一覧のサムネイルは、画像を持たない記事にも `resolveThumbnail` が
 * **必ず 16:9 の何か**を返す。その「何か」は外部へ接続せずに組み立てる SVG で、
 * `data:` URI として `<img>` に直接入る。画面の中ではこれで正しい。
 *
 * **OGP では正しくない。** og:image を読むのは他所のサーバーで、
 * `data:` URI は取りに行けず、SVG は主要な SNS が画像として扱わない。
 * 載せれば「画像を宣言したのに何も出ない」という、宣言しないより悪い状態になる。
 *
 * だから **実在の画像がある記事だけ** 絵を宣言する。
 * 無い記事は絵の宣言を持たず、題と説明文だけのカードとして共有される。
 * 生成図版を OGP でも配るには、外から取れる住所で PNG を返す口が要る
 * （SVG のままでは足りない）。その口はまだ無い。
 *
 * @param origin 絶対 URL の土台。相対 URL の画像はこれが無いと外から取れない。
 */
export function articleOgImage(
  origin: string | null,
  article: PublishedArticle,
): OgImage | null {
  /*
    代替図版の材料（配色・カテゴリー名）は渡さない。**使わないから**である。
    ここが見るのは「実在の画像候補があるか」だけで、無ければ絵を宣言しない。
    材料を渡すと、使われない値を揃えるために設計図の読み取りが要ることになり、
    サイトが読めない事故で記事の題まで配れなくなる。
  */
  const resolved = resolveThumbnail(
    {
      siteSlug: article.siteSlug,
      slug: article.slug,
      title: article.title,
      categorySlug: article.categorySlug,
      categoryName: "",
      brandTheme: "",
    },
    {
      uploadedUrl: article.uploadedImageUrl,
      eyecatchUrl: article.eyecatchImageUrl,
      bodyFirstImageUrl: article.bodyFirstImageUrl,
    },
  );
  if (resolved.kind !== "image") return null;

  const url = absoluteImageUrl(origin, resolved.url);
  if (url === null) return null;
  return { url, alt: thumbnailAltText(resolved, article.title) };
}

/**
 * 画像の住所を、外から取れる形にする。**推測しない。**
 *
 * すでに絶対 URL ならそのまま。`/` で始まるなら origin を足す。
 * それ以外（`./img.png` のような相対）は、どの画面から見た相対かが
 * ここでは決まらないので **null にして宣言ごと落とす**。
 * 当てずっぽうの住所を配ると、他所のサーバーが 404 を引いて終わる。
 */
function absoluteImageUrl(origin: string | null, url: string): string | null {
  if (/^https?:\/\//i.test(url)) return url;
  if (origin === null) return null;
  return url.startsWith("/") ? `${origin}${url}` : null;
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
  const origin = await requestOriginFromNextHeaders();
  const canonical =
    origin === null ? null : `${origin}${siteCanonicalPath(siteSlug, articleHref(article))}`;
  /*
    絵はサイトの設計図（配色・カテゴリー名）が要る。サイトが読めなかったときは
    絵の宣言だけを落とす。記事の metadata まで空にすると、読めている題も配れない。
  */
  const image = articleOgImage(origin, article);
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
      ...(image === null ? {} : { images: [{ url: image.url, alt: image.alt }] }),
    },
    twitter: {
      /*
        絵があるときだけ大きいカードにする。絵の無いまま
        `summary_large_image` を宣言すると、SNS 側は大きい枠を作ってから
        中身が無いことに気づき、題だけが間延びした共有カードになる。
      */
      card: image === null ? "summary" : "summary_large_image",
      title: article.title,
      description: article.summary,
      ...(image === null ? {} : { images: [image.url] }),
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


/** 一覧のタイトル・正規URL・共有URLを同じ入力から作る。 */
export async function siteListingMetadata(siteSlug: string, path: string, label: string): Promise<Metadata> {
  const [base, canonical] = await Promise.all([siteHomeMetadata(siteSlug), siteMetadataUrl(siteSlug, path)]);
  if (base.title === undefined) return {};
  const title = `${label} | ${base.title}`;
  return {
    ...base, title,
    ...(canonical === null ? {} : { alternates: { canonical } }),
    openGraph: { ...base.openGraph, title, ...(canonical === null ? {} : { url: canonical }) },
    twitter: { ...base.twitter, title },
  };
}
