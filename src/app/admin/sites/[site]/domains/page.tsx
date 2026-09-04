import { siteBasePathBySlug } from "@/domain/authoring/site";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  BlogDomainRow,
  RegisterBlogDomainForm,
} from "@/presentation/admin/publish/blog-domain-form";
import { blogDomainsEntry, currentActor } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログの住所（独自ドメイン）を管理する画面。
 *
 * **「いま読者へ見せている住所」を一番上に、文で出す。** 一覧の中の印で
 * 表すと、行が増えたときに見落とす。ここを読み違えると、切り替えたつもりで
 * 切り替わっていない住所を配り歩くことになる。
 */
export default async function SiteDomainsPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const entry = await blogDomainsEntry();
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;

  if (!entry.ready) {
    return (
      <AdminShell
        routeId="sites/[site]/domains"
        routeParams={{ site: siteSlug }}
        breadcrumbLabels={{ "sites/[site]": "ブログ" }}
        title="住所（独自ドメイン）"
        lead="このブログを読者に見せる住所を決めます。"
      >
        <ErrorView
          title="住所を開けませんでした"
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
  const defaultPath = siteBasePathBySlug(siteSlug);

  return (
    <AdminShell
      routeId="sites/[site]/domains"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": "ブログ" }}
      title="住所（独自ドメイン）"
      lead="読者がこのブログを開く住所を登録し、そのうち 1 つを正規の住所にします。"
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="住所を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : (
        <>
          {result.value.canonical?.kind === "custom" ? null : (
            <Callout
              tone="info"
              title="いまは既定の住所で読まれています"
              reason={`独自ドメインが配信中になるまで、読者は ${defaultPath} で開きます。既定の住所は取り上げられないので、独自ドメインが止まってもブログが読めなくなることはありません。`}
            />
          )}

          <Section title="いま読者へ見せている住所">
            <Prose>
              {result.value.canonical === null
                ? `まだ定まっていません。読者は ${defaultPath} で開きます。`
                : result.value.canonical.kind === "custom"
                  ? `https://${result.value.canonical.hostname}`
                  : result.value.canonical.path}
            </Prose>
          </Section>

          {result.value.instructions.length === 0 ? null : (
            <Section title="DNS に置く設定">
              <Prose>
                ここに書かれた行をドメインの DNS に置くと、所有権の確認が始まります。
                置くまでは、登録した住所で読者が開くことはできません。
              </Prose>
              <DataTable
                caption="所有権の確認に必要な DNS レコード"
                columns={[
                  { key: "recordType", label: "種類" },
                  { key: "name", label: "名前" },
                  { key: "value", label: "値" },
                  { key: "why", label: "何のためか" },
                ]}
                rows={result.value.instructions.map((instruction, index) => ({
                  key: `${instruction.recordType}-${instruction.name}-${index}`,
                  cells: [
                    instruction.recordType,
                    instruction.name,
                    instruction.value,
                    instruction.why,
                  ],
                }))}
              />
            </Section>
          )}

          <Section title="登録済みの住所">
            {result.value.domains.length === 0 ? (
              <EmptyView
                title="まだ独自ドメインを登録していません"
                body={`読者は ${defaultPath} で読めています。独自ドメインは、この下から登録できます。`}
                action={null}
              />
            ) : (
              result.value.domains.map((domain) => (
                <BlogDomainRow
                  key={domain.id}
                  siteSlug={siteSlug}
                  domain={domain}
                  canonical={
                    result.value.canonical?.kind === "custom" &&
                    result.value.canonical.hostname === domain.hostname
                  }
                />
              ))
            )}
          </Section>

          <Section title="住所を追加する">
            <RegisterBlogDomainForm siteSlug={siteSlug} />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
