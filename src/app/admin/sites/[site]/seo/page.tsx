import { SEO_SEVERITY_LABEL } from "@/domain/seo";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  SeoAssessForm,
  SeoFindingRow,
} from "@/presentation/admin/publish/blog-improvement-form";
import { blogSeoEntry, currentActor } from "@/presentation/composition";
import { EmptyView, ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * SEO 診断の画面。
 *
 * **ここで押しても、読者に出ているものは変わらない (AD-3)。** 診断は
 * 指摘を作るだけ、「直しに行く」は編集画面への道を作るだけである。
 * 公開まで進むのは編集画面を通したときだけで、その線は使い分けの
 * 気分ではなく、機械の判断で公開面が変わらないようにするための線。
 */
export default async function SiteSeoPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;

  const entry = await blogSeoEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="sites/[site]/seo"
        routeParams={{ site: siteSlug }}
        breadcrumbLabels={{ "sites/[site]": "ブログ" }}
        title="SEO 診断"
        lead="検索から届かない原因を探します。"
      >
        <ErrorView
          title="SEO 診断を開けませんでした"
          body={entry.reason}
          suggestedAction={null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const result = await entry.manage.execute(await currentActor(), {
    action: "read",
    siteSlug,
  });

  return (
    <AdminShell
      routeId="sites/[site]/seo"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": "ブログ" }}
      title="SEO 診断"
      lead="検索から届かない原因を 1 つ選び、直しに行きます。診断を回しても、読者に出ているものは変わりません。"
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="SEO 診断を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : (
        <>
          <Section title="診断を回す">
            <SeoAssessForm siteSlug={siteSlug} />
          </Section>

          <Section title="未対応の指摘">
            {result.value.openFindings.length === 0 ? (
              <EmptyView
                title="未対応の指摘はありません"
                body="まだ一度も診断していない場合も、ここは空になります。上から診断を回すと、現状の指摘が出ます。"
                action={null}
              />
            ) : (
              <>
                {/*
                  出す順は保存側（重さ × 件数）が決めている。画面で
                  並べ替え直さないのは、「重いが 1 件だけの指摘」が
                  「毎日効いてくる中くらいの指摘」を押しのけないため。
                */}
                <Prose>
                  上から順に、直した効果が大きいものです。重さだけでなく、
                  何本の記事に効くかを合わせて並べてあります。全 {result.value.openFindings.length} 件。
                  もっとも重い指摘は「
                  {SEO_SEVERITY_LABEL[result.value.openFindings[0].severity]}」です。
                </Prose>
                {result.value.openFindings.map((finding) => (
                  <SeoFindingRow key={finding.id} siteSlug={siteSlug} finding={finding} />
                ))}
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
