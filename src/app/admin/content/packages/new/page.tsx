import {
  CONTENT_ANGLE_LABELS,
  DOMAIN_SCOPE_LABELS,
  FUNNEL_STAGE_LABELS,
} from "@/application/usecases/authoring/manage-content-packages";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateContentPackageForm } from "@/presentation/admin/write/content-package-form";
import { CONTENT_ANGLES, FUNNEL_STAGES } from "@/domain/authoring";
import { POLICY_DOMAIN_SCOPES } from "@/domain/compliance";
import {
  currentActor,
  personaUseCases,
  productUseCases,
  settingsUseCases,
} from "@/presentation/composition";
import { ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 企画を 1 つ立てる画面。
 *
 * 選択肢（書き手・読者像・商品・ブランド）をここで集めて部品へ渡す。
 * **部品側で取りに行かない。** 取りに行く形にすると、同じ一覧を出す場所が
 * 増えたときに取り方が枝分かれし、画面によって選べる相手が変わる。
 *
 * 分野・購買段階・切り口の選択肢は domain の定義から作る。
 * 画面に書き写すと、切り口を 1 つ足したときに**画面だけ古くなる**。
 */
export default async function NewContentPackagePage() {
  const actor = await currentActor();
  const personas = await personaUseCases();
  const [authors, audiences, products, brands] = await Promise.all([
    personas.listAuthors.execute(actor, {}),
    personas.listAudiences.execute(actor, {}),
    (await productUseCases()).filterProducts.execute(actor, { limit: 100 }),
    (await settingsUseCases()).listBrands.execute(actor, {}),
  ]);

  // どれが欠けても企画は立てられない。片方だけ出して「あとで足せる」に
  // 見せると、選べない欄が並んだ画面の前で手が止まる。
  const failure = !authors.ok
    ? authors.error
    : !audiences.ok
      ? audiences.error
      : !products.ok
        ? products.error
        : !brands.ok
          ? brands.error
          : null;

  return (
    <AdminShell
      routeId="content/packages/new"
      title="企画を立てる"
      lead="どの商品を誰に向けて書くかを決めます。"
      actions={<TextLink href="/admin/content/packages">企画へ戻る</TextLink>}
    >
      {failure !== null || !authors.ok || !audiences.ok || !products.ok || !brands.ok ? (
        <ErrorView
          title="企画を立てる画面を開けませんでした"
          body={failure?.message ?? "選ぶための一覧を読めませんでした。"}
          suggestedAction={failure?.suggestedAction ?? null}
          action={<TextLink href="/admin/content/packages">企画へ戻る</TextLink>}
        />
      ) : (
        <Section title="この企画の決めごと">
          <Prose>
            主張と根拠はここでは選びません。企画を立てる時点ではまだ調べ終わっていないのが
            普通で、必須にすると「とりあえず何か入れる」が起きます。足りないものは一覧に出ます。
          </Prose>
          <CreateContentPackageForm
            authors={authors.value.items.map((a) => ({
              value: a.personaId,
              label: `${a.displayName}（${a.role}）`,
            }))}
            audiences={audiences.value.items.map((a) => ({
              value: a.personaId,
              label: `${a.name}（${a.primaryJob}）`,
            }))}
            products={products.value.items.map((p) => ({
              value: p.productId,
              label: `${p.brand} ${p.name}`,
            }))}
            brands={brands.value.rows.map((b) => ({
              value: b.brandId,
              label: b.displayName,
            }))}
            domainScopes={POLICY_DOMAIN_SCOPES.map((scope) => ({
              value: scope,
              label: DOMAIN_SCOPE_LABELS[scope],
            }))}
            funnelStages={FUNNEL_STAGES.map((stage) => ({
              value: stage,
              label: FUNNEL_STAGE_LABELS[stage],
            }))}
            angles={CONTENT_ANGLES.map((angle) => ({
              value: angle,
              label: CONTENT_ANGLE_LABELS[angle],
            }))}
          />
        </Section>
      )}
    </AdminShell>
  );
}
