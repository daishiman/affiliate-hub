import { AdminShell } from "@/presentation/admin/admin-shell";
import { UpdateSiteForm } from "@/presentation/admin/site-form";
import { currentActor, platformUseCases } from "@/presentation/composition";
import { ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログの設計図を直す画面 (§16.2)。
 *
 * いまの値を入れて開く。空欄から始めると、1 軸を直すために
 * **残すはずの 9 軸を打ち直す**ことになる。
 */
export default async function EditSitePage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const result = await (await platformUseCases()).getSite.execute(await currentActor(), {
    siteSlug,
  });

  const path = `/admin/sites/${encodeURIComponent(siteSlug)}`;
  const label = result.ok ? result.value.blueprint.name : "ブログ";

  return (
    <AdminShell
      routeId="sites/[site]/edit"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": label }}
      title="設計図を直す"
      lead="他のブログと違う点を書き換えます。"
      actions={<TextLink href={path}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="このブログを開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/sites">ブログへ戻る</TextLink>}
        />
      ) : (
        <Section title={label}>
          <Prose>
            URL 名と画面の形は変えられません。変えると読者へ配った住所が消えます。
          </Prose>
          <UpdateSiteForm
            defaults={{
              siteSlug,
              name: result.value.blueprint.name,
              purpose: result.value.blueprint.purpose,
              genre: result.value.blueprint.genre,
              emitLlmsTxt: result.value.blueprint.emitLlmsTxt,
              axes: result.value.axes,
            }}
          />
        </Section>
      )}
    </AdminShell>
  );
}
