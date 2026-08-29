import type { Metadata } from "next";
import { ArticlePage } from "@/presentation/site/article-page";
import { ReadFailureBody, SiteFrame } from "@/presentation/site/page-frame";
import { ReaderToolSection } from "@/presentation/site/reader-tool-section";
import { articleMetadata, siteMetadataUrl } from "@/presentation/site/site-metadata";
import { siteHref } from "@/presentation/site/view-model";
import { readerActor, readerUseCases } from "@/presentation/composition";
import { SitePage } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 道具のページの題名と要約。
 *
 * **記事があるならそちらを正本にする。** 道具の定義にある名前は入力欄の見出しで、
 * 記事の題名は読者に読ませるために書いた言葉である。検索結果と SNS に出るのは
 * 後者でなければならない。記事がまだ無いときだけ定義の名前へ落ちる。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string; tool: string }>;
}): Promise<Metadata> {
  const { site, tool } = await params;
  const fromArticle = await articleMetadata(site, tool);
  if (fromArticle.title !== undefined) return fromArticle;

  const definition = await (await readerUseCases()).getReaderTool.execute(readerActor(), {
    siteSlug: site,
    slug: tool,
  });
  if (!definition.ok) return {};
  const canonical = await siteMetadataUrl(site, `/tools/${tool}`);
  return {
    title: definition.value.name,
    description: definition.value.purpose,
    ...(canonical === null ? {} : { alternates: { canonical } }),
  };
}

/**
 * 診断・計算の道具。
 *
 * --- ここが 1 つの住所であることの意味 ---
 * `/tools/{slug}` には**別々に作られた 2 つのもの**が集まる。
 *   1. 道具の定義（入力欄・計算式・結果の読み方）
 *   2. `tool` 型の公開記事（できること・計算の根拠・出典・書いた人・更新履歴）
 * どちらも `(ブログ, slug)` で識別される。つまり**正本は住所であって、
 * どちらか一方のモデルではない**。
 *
 * 2026-08-26 まで、この画面は 1 だけを読んでいた。`tool` 型で記事を公開すると
 * `articleHref` は `/tools/{slug}` を指すのに、その住所は記事を読まないので、
 * 一覧から踏んだ読者は 404 に落ちた。**書いた記事が誰にも読まれない**状態が、
 * 公開の手続きの側からは成功に見えていた。
 *
 * いまは両方を読む。
 *   - 両方ある  → 道具の下に記事の本文（根拠・出典・著者）が続く
 *   - 定義だけ  → 今まで通り道具だけ（記事はまだ書いていない、で正しい）
 *   - 記事だけ  → 記事だけ（計算は付かないが、書いたものは読める）
 *   - どちらも無い → 404
 *
 * 計算そのものは `domain/authoring/reader-tool-formula.ts` が行う。
 * 入力が足りない・数字でない・0 で割る、のどれも失敗として返り、
 * 「とりあえず 0 として計算した数字」は出さない。読者はそれを信じて物を買う。
 */
export default async function ReaderToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ site: string; tool: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { site, tool } = await params;
  const raw = await searchParams;
  const path = `/tools/${tool}`;

  const definition = await (await readerUseCases()).getReaderTool.execute(readerActor(), {
    siteSlug: site,
    slug: tool,
  });

  /*
    定義が無いときは、記事の側に賭ける。`ArticlePage` は記事も無ければ
    そこで 404 を出す（`whenArticleMissing` を渡さないため）。
    ここで先に打ち切ると、記事だけ書かれている道具が永久に読めない。
  */
  if (!definition.ok && definition.error.code === "NOT_FOUND") {
    return <ArticlePage siteSlug={site} slug={tool} pathPrefix="/tools" routeLabel="診断・計算" />;
  }
  if (!definition.ok) {
    return (
      <SiteFrame siteSlug={site} currentPath={siteHref(site, path)}>
        {() => <ReadFailureBody what="この道具" siteSlug={site} />}
      </SiteFrame>
    );
  }

  const submitted = definition.value.inputs.some((input) =>
    Object.prototype.hasOwnProperty.call(raw, input.key),
  );
  const values: Record<string, string> = {};
  for (const input of definition.value.inputs) {
    const v = raw[input.key];
    const single = Array.isArray(v) ? v[0] : v;
    if (single !== undefined && single !== "") values[input.key] = single;
  }

  const run = submitted
    ? await (await readerUseCases()).runReaderTool.execute(readerActor(), {
        siteSlug: site,
        slug: tool,
        values,
      })
    : null;

  const section = (
    <ReaderToolSection
      action={siteHref(site, path)}
      definition={definition.value}
      values={values}
      run={run}
    />
  );

  return (
    <ArticlePage
      siteSlug={site}
      slug={tool}
      pathPrefix="/tools"
      routeLabel="診断・計算"
      fallbackTitle={definition.value.name}
      interactiveSlot={section}
      whenArticleMissing={
        // 記事がまだでも道具は使える。ここで 404 にすると、
        // 書き手が記事を書くまで、動く道具が誰にも使われない。
        <SitePage title={definition.value.name} lead={definition.value.purpose}>
          {section}
        </SitePage>
      }
    />
  );
}
