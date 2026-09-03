import { AdminShell } from "@/presentation/admin/admin-shell";
import { UpdatePublicationForm } from "@/presentation/admin/publish/publication-form";
import { currentActor, distributionUseCases } from "@/presentation/composition";
import { ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 送信前の配信を直す画面 (§17)。
 *
 * 出し始めた後の配信は直せない。**直せるかどうかの判断は画面でしない**——
 * 状態を 1 つ足した日に、画面だけが古い条件のまま残る。
 * ここは断りをそのまま出す側に回る。
 */
export default async function EditPublicationPage({
  params,
}: {
  readonly params: Promise<{ readonly publication: string }>;
}) {
  const { publication: publicationId } = await params;
  const result = await (await distributionUseCases()).getPublication.execute(
    await currentActor(),
    { publicationId },
  );

  const path = `/admin/distribution/${encodeURIComponent(publicationId)}`;
  const label = result.ok ? result.value.card.channelLabel : "配信";

  return (
    <AdminShell
      routeId="distribution/[publication]/edit"
      routeParams={{ publication: publicationId }}
      breadcrumbLabels={{ "distribution/[publication]": label }}
      title="配信を直す"
      lead="出し先と出す日時を変えます。"
      actions={<TextLink href={path}>この配信へ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="この配信を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/distribution">配信へ戻る</TextLink>}
        />
      ) : (
        <Section title={`${label}（${result.value.card.stateLabel}）`}>
          <Prose>
            出す記事は変えられません。別の記事にするときは、この配信を取り消します。
          </Prose>
          <UpdatePublicationForm
            defaults={{
              publicationId,
              channelKind: result.value.card.channelKind,
              scheduledAt: toLocalInputValue(result.value.card.scheduledAt),
            }}
          />
        </Section>
      )}
    </AdminShell>
  );
}

/**
 * `datetime-local` が読める形へ。予約が無ければ空。
 *
 * 秒とタイムゾーンを落とす。落とさないと欄が値を拒み、
 * **入っているはずの予約が空欄で開く**（消したように見える）。
 */
function toLocalInputValue(at: Date | null): string {
  if (at === null) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
