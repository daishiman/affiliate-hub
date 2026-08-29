import { AdminShell } from "@/presentation/admin/admin-shell";
import { SiteDocumentForm } from "@/presentation/admin/site-document-form";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { currentActor, siteDocumentUseCases } from "@/presentation/composition";
import { Callout, ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログの固定ページ（運営者情報・各方針・規約・特商法表記）を書く画面。
 *
 * **未整備のものも 1 行として出す。** 保存済みだけを並べると、
 * 「無い」ことが画面から消える。無い固定ページはフッターのリンクから
 * 404 として読者に出ており、いちばん気付かれたくない相手にだけ見えている。
 */
export default async function SiteDocumentsPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const result = await (await siteDocumentUseCases()).list.execute(await currentActor(), {
    siteSlug,
  });

  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;
  const label = result.ok ? result.value.siteName : "ブログ";
  const basePath = siteBasePathBySlug(siteSlug);

  return (
    <AdminShell
      routeId="sites/[site]/documents"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": label }}
      title="固定ページ"
      lead="読者と取引先が見る、記事ではないページです。"
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="固定ページを開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/sites">ブログへ戻る</TextLink>}
        />
      ) : (
        <>
          {result.value.missingCount === 0 ? null : (
            <Callout
              tone="warn"
              title={`${result.value.missingCount} 枚がまだ空です`}
              reason="空のままの固定ページは、フッターのリンクを踏んだ読者に 404 として出ています。特定商取引法に基づく表記は、商品を売る形で運用する前に必ず埋めてください。"
            />
          )}
          {result.value.rows.map((row) => (
            <Section key={row.key} title={row.missing ? `${row.label}（未記入）` : row.label}>
              <Prose>
                読者に出る場所:{" "}
                <TextLink href={`${basePath}${row.readerPath}`}>
                  {basePath}
                  {row.readerPath}
                </TextLink>
              </Prose>
              <SiteDocumentForm
                siteSlug={siteSlug}
                documentKey={row.key}
                label={row.label}
                title={row.title}
                body={row.body}
              />
            </Section>
          ))}
        </>
      )}
    </AdminShell>
  );
}
