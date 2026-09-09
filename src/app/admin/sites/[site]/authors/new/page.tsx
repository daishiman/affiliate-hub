import { AdminShell } from "@/presentation/admin/admin-shell";
import { resolveSiteOrNotFound } from "@/presentation/admin/resolve-site";
import { CreateAuthorPersonaForm } from "@/presentation/admin/write/persona-form";
import { SharedPersonaScopeNotice } from "@/presentation/admin/write/shared-persona-scope-notice";
import { Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 書き手を 1 人作る画面。
 *
 * **一覧と分けている。** 一覧は「誰がいるか」を見返す画面で、ここは
 * 「誰の立場で書かせるか」を決める画面である。決める作業は項目が多く、
 * 一覧に混ぜると見返しに来た人の前に長い入力欄が常に開く。
 *
 * 実URLと脇の現在地は route metadata から別々に解決する。
 */
export default async function NewSiteAuthorPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site } = await params;
  const { siteSlug, siteName } = await resolveSiteOrNotFound(site);
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;
  return (
    <AdminShell
      routeId="sites/[site]/authors/new"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": siteName }}
      title="書き手を作る"
      lead="どの立場で、どこまでを事実として書けるかを決めます。"
      actions={<TextLink href={`${sitePath}/authors`}>書き手の一覧へ戻る</TextLink>}
    >
      <SharedPersonaScopeNotice resourceLabel="書き手" siteName={siteName} />
      <Section title="決める">
        <Prose>
          ここで決めた「事実として書いてよい範囲」を越えた文章は、公開前の確認で止まります。
          範囲を空のままにすると、実際に試した書き方が一切できない書き手になります。
        </Prose>
        <CreateAuthorPersonaForm siteSlug={siteSlug} />
      </Section>
    </AdminShell>
  );
}
