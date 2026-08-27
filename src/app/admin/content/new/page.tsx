import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateContentForm } from "@/presentation/admin/content-form";
import {
  contentPackageUseCases,
  currentActor,
  personaUseCases,
} from "@/presentation/composition";
import { EmptyView, ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

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
  const personas = await personaUseCases();
  const [authors, audiences, packages] = await Promise.all([
    personas.listAuthors.execute(actor, {}),
    personas.listAudiences.execute(actor, {}),
    (await contentPackageUseCases()).listPackages.execute(actor, {}),
  ]);

  // 書き手と読者像は片方だけでは足りない。どちらが欠けても同じ案内を出す。
  const failure = !authors.ok
    ? authors.error
    : !audiences.ok
      ? audiences.error
      : !packages.ok
        ? packages.error
        : null;

  return (
    <AdminShell
      routeId="content/new"
      title="記事を作る"
      lead="出し先と切り口を決めて 1 本作ります。"
      actions={<TextLink href="/admin/content">記事へ戻る</TextLink>}
    >
      {failure !== null || !authors.ok || !audiences.ok || !packages.ok ? (
        <ErrorView
          title="記事を作る画面を開けませんでした"
          body={failure?.message ?? "書き手と読者像を読めませんでした。"}
          suggestedAction={failure?.suggestedAction ?? null}
          action={<TextLink href="/admin/personas">書き手と読者像へ</TextLink>}
        />
      ) : packages.value.items.length === 0 ? (
        // 企画が 0 件のときに欄を出さない。出すと、選べない欄を空のまま送って
        // 断られる——という遠回りを全員がすることになる。
        <Section title="この記事の決めごと">
          <EmptyView
            title="先に企画を立てます"
            body="記事は企画にぶら下がります。何のために書くかが決まっていないと、この記事が誰に何を伝えるものなのかを後から誰も辿れません。"
            action={<TextLink href="/admin/content/packages/new">企画を立てる</TextLink>}
          />
        </Section>
      ) : (
        <Section title="この記事の決めごと">
          <Prose>
            広告の表記は決まった文言が自動で入ります。ここで書く必要はありません。
          </Prose>
          <CreateContentForm
            packages={packages.value.items.map((p) => ({
              value: p.packageId,
              label: p.objective,
            }))}
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
