import { AdminShell } from "@/presentation/admin/admin-shell";
import { BlogPlacementForm } from "@/presentation/admin/publish/blog-placement-form";
import { AffiliatePlacementLookup } from "@/presentation/admin/affiliate-placement-lookup";
import { blogPlacementEntry, currentActor } from "@/presentation/composition";
import { Callout, ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事のどこに成果リンクを出しているかの台帳（受入 A6・A7）。
 *
 * **掲載 0 件の記事も 1 行として出す。** 載っているものだけを並べると、
 * この画面がいちばん答えたい問い——「どこに出していないか」——が
 * 画面から消える。載っていない記事は、稼ぐ導線が 1 本も無いまま
 * 読者に読まれ続けている記事である。
 *
 * ここは運営が見る記録であって、読者に出る中身ではない（不変条件 I4）。
 */
export default async function SitePlacementsPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly site: string }>;
  readonly searchParams: Promise<{
    readonly trackingCode?: string | readonly string[];
  }>;
}) {
  const { site: siteSlug } = await params;
  const query = await searchParams;
  const rawTrackingCode = Array.isArray(query.trackingCode)
    ? query.trackingCode[0]
    : query.trackingCode;
  const trackingCode = rawTrackingCode?.trim() ?? "";
  const entry = await blogPlacementEntry();
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;

  if (!entry.ready) {
    return (
      <AdminShell
        routeId="sites/[site]/placements"
        routeParams={{ site: siteSlug }}
        breadcrumbLabels={{ "sites/[site]": "ブログ" }}
        title="成果リンクの掲載"
        lead="記事のどこに成果リンクを出しているかの記録です。"
      >
        <ErrorView
          title="掲載の記録を開けませんでした"
          body={entry.reason}
          suggestedAction={null}
          action={<TextLink href="/admin/sites">ブログへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const result = await entry.review.execute(await currentActor(), {
    action: "by_site",
    siteSlug,
  });
  const reverse = await entry.review.execute(await currentActor(), {
    action: "by_affiliate",
    ...(trackingCode === "" ? {} : { trackingCode }),
  });

  return (
    <AdminShell
      routeId="sites/[site]/placements"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": "ブログ" }}
      title="成果リンクの掲載"
      lead="記事の掲載漏れを埋め、成果リンクから掲載先も逆引きできます。保存したリンクは読者の記事にも同時に反映されます。"
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="掲載の記録を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/sites">ブログへ戻る</TextLink>}
        />
      ) : result.value.kind !== "by_site" ? null : (
        <>
          {result.value.missingCount === 0 ? null : (
            <Callout
              tone="warn"
              title={`${result.value.missingCount} 本の記事に掲載がありません`}
              reason="成果リンクが 1 本も記録されていない記事です。読者は読んでいるのに、次に進む先がありません。"
            />
          )}

          <Section title="記事ごとの掲載">
            {result.value.articles.length === 0 ? (
              <Prose>このブログにはまだ記事がありません。</Prose>
            ) : (
              result.value.articles.map((article) => (
                <Prose key={article.articleSlug}>
                  {article.articleSlug}:{" "}
                  {article.placements.length === 0
                    ? "掲載なし"
                    : article.placements
                        .map((p) => `${p.placement}${p.trackingCode ? `（${p.trackingCode}）` : ""}`)
                        .join("、")}
                </Prose>
              ))
            )}
          </Section>

          <Section title="成果リンクから掲載先を探す">
            {!reverse.ok ? (
              <ErrorView
                title="掲載先を逆引きできませんでした"
                body={reverse.error.message}
                suggestedAction={reverse.error.suggestedAction ?? null}
                action={null}
              />
            ) : reverse.value.kind !== "by_affiliate" ? null : (
              <AffiliatePlacementLookup
                trackingCode={trackingCode}
                placements={reverse.value.placements}
              />
            )}
          </Section>

          <Section title="掲載を記録する / 外す">
            <BlogPlacementForm
              siteSlug={siteSlug}
              articleSlugs={result.value.articles.map((a) => a.articleSlug)}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
