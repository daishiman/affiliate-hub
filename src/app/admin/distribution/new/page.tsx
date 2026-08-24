import { AdminShell } from "@/presentation/admin/admin-shell";
import { SchedulePublicationForm } from "@/presentation/admin/schedule-publication-form";
import { contentUseCases, currentActor } from "@/presentation/composition";
import { EmptyView, ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 配信を 1 件作る画面 (§17)。
 *
 * **選べるのは承認済みの記事だけ。** 承認前の記事も並べて「出せません」と
 * 断ると、断られるためだけの選択肢を毎回読むことになる。
 * 並べないことが、そのまま「まだ出せない」の答えになる。
 */
export default async function NewPublicationPage() {
  const board = await (await contentUseCases()).listBoard.execute(await currentActor(), {});

  const approved = board.ok
    ? board.value.columns
        .filter((column) => column.state === "APPROVED")
        .flatMap((column) => column.items)
    : [];

  return (
    <AdminShell
      routeId="distribution/new"
      title="配信を作る"
      lead="承認済みの記事を、出し先へ登録します。"
      actions={<TextLink href="/admin/distribution">配信へ戻る</TextLink>}
    >
      {!board.ok ? (
        <ErrorView
          title="出せる記事を読めませんでした"
          body={board.error.message}
          suggestedAction={board.error.suggestedAction ?? null}
          action={<TextLink href="/admin/content">記事へ</TextLink>}
        />
      ) : (
        <Section title="出す記事と出し先">
          <Prose>
            日時を空にすると、承認され次第すぐに出ます。過ぎた日時は指定できません。
          </Prose>
          {approved.length === 0 ? (
            <EmptyView
              title="出せる記事がまだありません"
              body="配信を作れるのは承認まで進んだ記事だけです。いまはその段階の記事がありません。"
              action={<TextLink href="/admin/content">記事の進み具合を見る</TextLink>}
            />
          ) : (
            <SchedulePublicationForm
              variants={approved.map((item) => ({
                value: item.variantId,
                label: `${item.title}（${item.channel}）`,
              }))}
            />
          )}
        </Section>
      )}
    </AdminShell>
  );
}
