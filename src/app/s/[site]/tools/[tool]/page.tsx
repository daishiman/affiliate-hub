import type { Metadata } from "next";
import { readerActor, readerUseCases } from "@/presentation/composition";
import { ReadFailureBody, SiteFrame, stopIfMissing } from "@/presentation/site/page-frame";
import { ReaderToolForm } from "@/presentation/site/reader-tool-form";
import { siteMetadataUrl } from "@/presentation/site/site-metadata";
import { siteHref } from "@/presentation/site/view-model";
import { ErrorView, SectionHeading, SitePage, StubNotice } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 道具ページの題名と要約。これは記事ではないので、記事の読み取りモデルを
 * 通さず道具の定義（名前・目的）から作る。読めなければ空（嘘の canonical を配らない）。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string; tool: string }>;
}): Promise<Metadata> {
  const { site, tool } = await params;
  const definition = await readerUseCases().getReaderTool.execute(readerActor(), {
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
 * 入力欄と「結果の読み方」は保存されている定義から作る。
 * 計算式はまだ登録していないので、実行すると
 * 「まだ登録されていない」と正直に返る。数字をでっち上げない。
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

  const definition = await readerUseCases().getReaderTool.execute(readerActor(), {
    siteSlug: site,
    slug: tool,
  });

  if (!definition.ok) {
    // 無い道具は 404 として打ち切る。**JSX を組み立てる前に。**（項目 36）
    stopIfMissing(definition.error);
    return (
      <SiteFrame siteSlug={site} currentPath={siteHref(site, `/tools/${tool}`)}>
        {() => <ReadFailureBody what="この道具" siteSlug={site} />}
      </SiteFrame>
    );
  }

  const values: Record<string, string> = {};
  for (const input of definition.value.inputs) {
    const v = raw[input.key];
    const single = Array.isArray(v) ? v[0] : v;
    if (single !== undefined && single !== "") values[input.key] = single;
  }
  const submitted = Object.keys(values).length > 0;

  const run = submitted
    ? await readerUseCases().runReaderTool.execute(readerActor(), {
        siteSlug: site,
        slug: tool,
        values,
      })
    : null;

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, `/tools/${tool}`)}
      trail={[{ label: definition.value.name }]}
    >
      {() => (
        <SitePage title={definition.value.name} lead={definition.value.purpose}>
          <StubNotice
            what="この道具の計算式"
            blockedBy="商品データの取込と、道具ごとの計算式の登録"
            stubId="reader:tools-sample"
          />

          <ReaderToolForm
            action={siteHref(site, `/tools/${tool}`)}
            toolSlug={definition.value.slug}
            toolPurpose={definition.value.purpose}
            inputs={definition.value.inputs}
            initialValues={values}
          />

          <section>
            <SectionHeading level={2}>結果の読み方</SectionHeading>
            <p>{definition.value.howToRead}</p>
          </section>

          {run === null ? null : run.ok ? (
            <section>
              <SectionHeading level={2}>結果</SectionHeading>
              <p>{run.value.summary}</p>
              <dl>
                {run.value.rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <ErrorView
              title="まだ計算できません"
              body={run.error.suggestedAction ?? run.error.message}
            />
          )}
        </SitePage>
      )}
    </SiteFrame>
  );
}
