import { AdminShell } from "@/presentation/admin/admin-shell";
import { UpdateContentForm } from "@/presentation/admin/content-form";
import { contentUseCases, currentActor } from "@/presentation/composition";
import { ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事の文章を直す画面 (§15.3)。
 *
 * 直す前の値を入れて開く。空の欄から始めると、直したい 1 か所のために
 * **消えていないはずの文章を全部打ち直す**ことになる。
 */
export default async function EditContentPage({
  params,
}: {
  readonly params: Promise<{ readonly variant: string }>;
}) {
  const { variant: variantId } = await params;
  const result = await (await contentUseCases()).getContent.execute(await currentActor(), {
    variantId,
  });

  const path = `/admin/content/${encodeURIComponent(variantId)}`;
  const title = result.ok ? (result.value.variant.title ?? "名前のない記事") : "記事";

  return (
    <AdminShell
      routeId="content/[variant]/edit"
      routeParams={{ variant: variantId }}
      breadcrumbLabels={{ "content/[variant]": title }}
      title="文章を直す"
      lead="題・要約・本文を書き換えます。"
      actions={<TextLink href={path}>この記事へ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="この記事を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/content">記事へ戻る</TextLink>}
        />
      ) : (
        <Section title={title}>
          <Prose>
            出し先と切り口はここでは変えられません。変えたいときは新しく作ります。
          </Prose>
          <UpdateContentForm
            defaults={{
              variantId,
              title: result.value.variant.title ?? "",
              summary: result.value.variant.summary,
              body: result.value.variant.body,
            }}
          />
        </Section>
      )}
    </AdminShell>
  );
}
