import { BLOG_TAG_KIND_LABEL } from "@/domain/blogops";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { blogSiteOptions, pickSiteSlug } from "@/presentation/admin/publish/blog-site-options";
import { BlogSiteSwitch } from "@/presentation/admin/publish/blog-site-switch";
import { BlogTagForm } from "@/presentation/admin/publish/blog-tag-form";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import {
  EmptyView,
  ErrorView,
  Prose,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * タグ。
 *
 * 足す欄を一覧の一番上に置いてある。**タグは思い付いたときに足す**もので、
 * 一覧を眺めて「これが足りない」と気付いた直後に手が届く場所が要る。
 * 別画面へ移すと、戻ってきたときに一覧のどこを見ていたか忘れる。
 */
export default async function BlogTagsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell routeId="blog/tags" title="タグ" lead="記事をまとめるタグを整えます。">
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
      <AdminShell routeId="blog/tags" title="タグ" lead="記事をまとめるタグを整えます。">
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
  const list = await entry.listTags.execute(actor, { siteSlug });

  return (
    <AdminShell
      routeId="blog/tags"
      title="タグ"
      lead="記事をまとめるタグを整えます。"
      actions={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
    >
      <BlogSiteSwitch basePath="/admin/blog/tags" current={siteSlug} options={sites.options} />

      <Section title="タグを足す">
        <Prose>
          同じ意味のタグが 2 つあると、読者は片方しか辿れません。足す前に一覧を見てください。
        </Prose>
        <BlogTagForm
          siteSlug={siteSlug}
          tagId=""
          slug=""
          name=""
          description=""
          kind=""
        />
      </Section>

      {!list.ok ? (
        <ErrorView
          title="タグを読めませんでした"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
        />
      ) : list.value.total === 0 ? (
        <Section title="いまあるタグ">
          <EmptyView
            title="タグがありません"
            body={list.value.emptyReason ?? "まだ 1 件もありません。"}
          />
        </Section>
      ) : (
        <Section title="いまあるタグ">
          {/*
            **ブランドの数を、総数と別に出す。**
            総数だけだと「タグは 20 件あるのにサイドバーのブランド一覧は空」という
            状態を、運営者は読者の画面を実際に開くまで気づけない。
          */}
          <Prose>
            {list.value.brandCount === 0
              ? `タグは ${list.value.total} 件ありますが、ブランドは 0 件です。サイドバーのブランド一覧は空のままです。`
              : `タグ ${list.value.total} 件のうち、ブランドは ${list.value.brandCount} 件です。サイドバーのブランド一覧に出るのはこの ${list.value.brandCount} 件だけです。`}
          </Prose>
          {list.value.tags.map((tag) => (
            <SubSection
              key={tag.tagId}
              title={tag.name}
              lead={`/${tag.slug}・${BLOG_TAG_KIND_LABEL[tag.kind]}`}
            >
              <BlogTagForm
                siteSlug={siteSlug}
                tagId={tag.tagId}
                slug={tag.slug}
                name={tag.name}
                description={tag.description}
                kind={tag.kind}
              />
            </SubSection>
          ))}
        </Section>
      )}
    </AdminShell>
  );
}
