import { AdminShell } from "@/presentation/admin/admin-shell";
import { BlogPageForm, BlogPageRestoreForm } from "@/presentation/admin/blog-page-form";
import { blogSiteOptions, pickSiteSlug } from "@/presentation/admin/blog-site-options";
import { BlogSiteSwitch } from "@/presentation/admin/blog-site-switch";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import {
  Callout,
  EmptyView,
  ErrorView,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 固定ページ。
 *
 * 書いていないページも枠として並べる。**不足を見えるようにするのがこの画面の役**で、
 * 書いたものだけを並べると「無い」ことに気付けない。
 * 広告表記の説明先が無い記事は公開できないので、不足はそのまま公開の詰まりになる。
 */
export default async function BlogPagesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="blog/pages"
        title="固定ページ"
        lead="運営が示す固定ページの不足を埋めます。"
      >
        <ErrorView
          title="いまは編集できません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const [params, sites] = await Promise.all([searchParams, blogSiteOptions()]);
  const siteSlug = pickSiteSlug(params, sites.options);

  if (siteSlug === null) {
    return (
      <AdminShell
        routeId="blog/pages"
        title="固定ページ"
        lead="運営が示す固定ページの不足を埋めます。"
      >
        <Section title="ブログ">
          <EmptyView
            title="対象のブログがありません"
            body={sites.emptyReason ?? "先にブログのつながりを 1 本作ってください。"}
            action={<TextLink href="/admin/site-network/new">つながりに 1 本足す</TextLink>}
          />
        </Section>
      </AdminShell>
    );
  }

  const actor = await currentActor();
  const [list, deleted] = await Promise.all([
    entry.listFixedPages.execute(actor, { siteSlug }),
    entry.listDeletedFixedPages.execute(actor, { siteSlug }),
  ]);

  return (
    <AdminShell
      routeId="blog/pages"
      title="固定ページ"
      lead="運営が示す固定ページの不足を埋めます。"
      actions={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
    >
      <BlogSiteSwitch basePath="/admin/blog/pages" current={siteSlug} options={sites.options} />

      {!list.ok ? (
        <ErrorView
          title="固定ページを読めませんでした"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
        />
      ) : (
        <>
          <Callout
            tone={list.value.missingCount === 0 ? "info" : "warn"}
            title={
              list.value.missingCount === 0
                ? "必要な固定ページはそろっています"
                : `${list.value.missingCount} 枚が足りません`
            }
            reason={
              list.value.launchBlockedReason ??
              "広告表記や運営者情報の行き先があるので、記事を公開できます。"
            }
          />

          <Section title="ページ" lead="書いていない枠も並べています。">
            {list.value.pages.map((page) => (
              <SubSection
                key={page.kind}
                title={page.label}
                lead={page.missing ? "まだありません。" : `最終更新: ${page.updatedAt?.slice(0, 10) ?? "—"}`}
              >
                <BlogPageForm
                  siteSlug={siteSlug}
                  kind={page.kind}
                  title={page.title}
                  body={page.body}
                  status={page.status}
                  exists={!page.missing}
                />
              </SubSection>
            ))}
          </Section>

          <Section title="削除済み" lead="本文と公開状態を保ったまま、通常一覧から分けています。">
            {!deleted.ok ? (
              <ErrorView
                title="削除済み固定ページを読めませんでした"
                body={deleted.error.message}
                suggestedAction={deleted.error.suggestedAction ?? null}
              />
            ) : deleted.value.pages.length === 0 ? (
              <EmptyView title="削除済みはありません" body={deleted.value.emptyReason ?? ""} />
            ) : (
              deleted.value.pages.map((page) => (
                <SubSection
                  key={page.pageId}
                  title={page.label}
                  lead={`削除日時: ${page.deletedAt.slice(0, 10)} / ${page.status === "published" ? "公開" : "下書き"}`}
                >
                  <p>{page.title}</p>
                  <BlogPageRestoreForm
                    pageId={page.pageId}
                    siteSlug={siteSlug}
                    kind={page.kind}
                  />
                </SubSection>
              ))
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
