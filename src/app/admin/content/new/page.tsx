import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateContentForm } from "@/presentation/admin/content-form";
import {
  currentActor,
  personaUseCases,
  sampleContentPackageId,
} from "@/presentation/composition";
import { ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事の枠を 1 本作る画面 (§15.3)。
 *
 * この画面がするのは 1 本作ることだけ。複数のブログへ書き分けるのは
 * 生成マトリクスの画面が持つ。同じ操作を 2 か所に置くと、
 * 「何を既定にするか」の決め方が 2 通りになる。
 */
export default async function NewContentPage() {
  const actor = await currentActor();
  const personas = personaUseCases();
  const [authors, audiences] = await Promise.all([
    personas.listAuthors.execute(actor, {}),
    personas.listAudiences.execute(actor, {}),
  ]);

  // 書き手と読者像は片方だけでは足りない。どちらが欠けても同じ案内を出す。
  const failure = !authors.ok ? authors.error : !audiences.ok ? audiences.error : null;

  return (
    <AdminShell
      routeId="content/new"
      title="記事を作る"
      lead="出し先と切り口を決めて 1 本作ります。"
      actions={<TextLink href="/admin/content">記事へ戻る</TextLink>}
    >
      {failure !== null || !authors.ok || !audiences.ok ? (
        <ErrorView
          title="記事を作る画面を開けませんでした"
          body={failure?.message ?? "書き手と読者像を読めませんでした。"}
          suggestedAction={failure?.suggestedAction ?? null}
          action={<TextLink href="/admin/personas">書き手と読者像へ</TextLink>}
        />
      ) : (
        <Section title="この記事の決めごと">
          <Prose>
            広告の表記は決まった文言が自動で入ります。ここで書く必要はありません。
          </Prose>
          <CreateContentForm
            contentPackageId={sampleContentPackageId()}
            authors={authors.value.items.map((a) => ({
              value: a.personaId,
              label: `${a.displayName}（${a.role}）`,
            }))}
            audiences={audiences.value.items.map((a) => ({
              value: a.personaId,
              label: `${a.name}（${a.primaryJob}）`,
            }))}
          />
        </Section>
      )}
    </AdminShell>
  );
}
