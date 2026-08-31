import { BLOG_TEMPLATES } from "@/domain/authoring/blog-template";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  BlogAppearanceForm,
  PageThemeOverrideForms,
} from "@/presentation/admin/blog-appearance-form";
import { blogAppearanceEntry, currentActor } from "@/presentation/composition";
import { Callout, ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログの見せ方（6 種）と配色（ブログ既定＋ページ単位の例外）を決める画面。
 *
 * **今どうなっているかを、選ぶ欄の前に文で出す。** 選択欄の初期値だけで
 * 現状を伝えると、「既定のまま」と「たまたま既定と同じ値を選んだ」が
 * 見分けられない。この 2 つは、上の層を変えた日に振る舞いが分かれる。
 */
export default async function SiteAppearancePage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const entry = await blogAppearanceEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="sites/[site]/appearance"
        routeParams={{ site: siteSlug }}
        breadcrumbLabels={{ "sites/[site]": "ブログ" }}
        title="見せ方と配色"
        lead="このブログの見た目を決めます。"
      >
        <ErrorView
          title="見せ方と配色を開けませんでした"
          body={entry.reason}
          suggestedAction={null}
          action={<TextLink href="/admin/sites">ブログへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const result = await entry.manage.execute(await currentActor(), {
    action: "read",
    siteSlug,
  });

  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;
  const basePath = siteBasePathBySlug(siteSlug);
  const chosen = result.ok
    ? (BLOG_TEMPLATES.find((t) => t.id === result.value.templateId) ?? null)
    : null;

  return (
    <AdminShell
      routeId="sites/[site]/appearance"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": "ブログ" }}
      title="見せ方と配色"
      lead="並び方と色を決めます。書いた記事の中身は 1 つも変わりません。"
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="見せ方と配色を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/sites">ブログへ戻る</TextLink>}
        />
      ) : (
        <>
          {chosen === null ? (
            <Callout
              tone="warn"
              title="見せ方をまだ選んでいません"
              reason="選ぶまでは既定の並びで読者に出ています。扱う題材に合う並びを選ぶと、読者が探しているものに早く届きます。"
            />
          ) : null}

          <Section title="今の見た目">
            <Prose>
              見せ方: {chosen === null ? "未選択（既定の並び）" : chosen.label}
              <br />
              ブログ全体の配色: {result.value.blogTheme.brandTheme} / 明暗{" "}
              {result.value.blogTheme.colorMode}
              <br />
              読者が見る場所: <TextLink href={basePath}>{basePath}</TextLink>
            </Prose>
          </Section>

          <Section title="見せ方と全体の配色">
            <BlogAppearanceForm
              siteSlug={siteSlug}
              templateId={result.value.templateId ?? ""}
              brandTheme={result.value.blogTheme.brandTheme}
              colorMode={result.value.blogTheme.colorMode}
            />
          </Section>

          <Section title="ページ単位の例外">
            <Prose>
              {result.value.overrides.length === 0
                ? "今は 1 ページも例外を置いていません。すべてのページが全体の配色で出ています。"
                : `例外を置いているページ: ${result.value.overrides.map((o) => o.pagePath).join("、")}`}
            </Prose>
            <PageThemeOverrideForms
              siteSlug={siteSlug}
              overrides={result.value.overrides}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
