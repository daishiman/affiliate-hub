import type { ReactNode } from "react";
import type { SiteBlueprint } from "@/domain/authoring";
import { readerActor, readerWebMcpDescriptors, siteUseCases } from "@/presentation/composition";
import { ErrorView, SiteShell, WebMcpProvider, type SiteChrome } from "@/presentation/ui";
import { breadcrumbsFor, siteBasePath, toChrome } from "./view-model";

/**
 * ブログ画面の共通の入り口。
 *
 * 18 本のルートすべてがこれを通る。**画面ごとに設計図の読み込みを書かない。**
 * 書くと、ヘッダーの作り方やブログが見つからないときの表示が画面ごとにずれる。
 *
 * 画面側がやるのは「本文を返す関数」を渡すことだけ。
 */

export type SiteContext = {
  readonly siteSlug: string;
  readonly blueprint: SiteBlueprint;
  readonly chrome: SiteChrome;
};

/**
 * 設計図を読み、共通の骨格で包む。
 *
 * ブログが見つからないときは、黙って空を出さずに理由と戻り先を出す。
 * 空白の画面は、読者からは故障と区別がつかない。
 */
export async function SiteFrame({
  siteSlug,
  currentPath,
  trail = [],
  children,
}: {
  readonly siteSlug: string;
  /** 現在地。ヘッダーの現在地表示に使う。 */
  readonly currentPath: string;
  /** パンくずの続き。ブログ名は自動で先頭に付く。 */
  readonly trail?: readonly { readonly label: string; readonly path?: string }[];
  readonly children: (ctx: SiteContext) => ReactNode;
}) {
  const result = await siteUseCases().getSite.execute(readerActor(), { siteSlug });

  if (!result.ok) {
    return (
      <ErrorView
        title="このブログは見つかりませんでした"
        body={result.error.suggestedAction ?? result.error.message}
      />
    );
  }

  const blueprint = result.value.blueprint;
  const chrome = toChrome(siteSlug, blueprint);

  return (
    <SiteShell
      chrome={chrome}
      currentPath={currentPath}
      breadcrumbs={breadcrumbsFor(siteSlug, blueprint, trail)}
    >
      {children({ siteSlug, blueprint, chrome })}
      {/*
        ページを開いている AI に、この画面でできることを知らせる（WebMCP）。
        読み取りだけ・6 件までで、すべて通常の画面操作でも同じことができる。
      */}
      <WebMcpProvider descriptors={readerWebMcpDescriptors()} />
    </SiteShell>
  );
}

/** 記事や人が見つからないときの表示。ここも 1 箇所にまとめる。 */
export function NotFoundBody({
  what,
  siteSlug,
}: {
  readonly what: string;
  readonly siteSlug: string;
}) {
  return (
    <ErrorView
      title={`${what}が見つかりませんでした`}
      body="URL が変わったか、公開が取り下げられた可能性があります。"
      action={<a href={siteBasePath(siteSlug)}>トップへ戻る</a>}
    />
  );
}
