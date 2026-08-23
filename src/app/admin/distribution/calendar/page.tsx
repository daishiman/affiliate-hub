import { AdminShell } from "@/presentation/admin/admin-shell";
import { RescheduleForm } from "@/presentation/admin/reschedule-form";
import {
  currentActor,
  distributionNotice,
  publicationCalendarUseCases,
} from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  EmptyView,
  ErrorView,
  ListView,
  Note,
  Prose,
  Row,
  ScheduleCalendar,
  Section,
  StorageNotice,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 投稿カレンダー (§22.7)。
 *
 * 配信の一覧では気づけないことを 1 つだけ拾う画面 ——
 * **出す前に、日付の偏りと承認漏れに気づくこと。**
 *
 * 表示の中身（媒体・アカウント・投稿予定・承認状態・キャンペーン・
 * コンテンツパッケージ・エラー）は application 層が組み立てる。
 * 同じ答えが AI からも `get_publication_calendar` で返る。
 */
export default async function PublicationCalendarPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly month?: string }>;
}) {
  const { month } = await searchParams;
  const actor = await currentActor();
  const result = await (await publicationCalendarUseCases()).getCalendar.execute(actor, { month });

  return (
    <AdminShell
      routeId="distribution/calendar"
      title="投稿カレンダー"
      lead="いつ・どこへ出す予定かを日付で並べます。"
      actions={<TextLink href="/admin/distribution">配信の一覧へ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="投稿カレンダーを出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? "配信の一覧からもう一度お試しください。"}
          action={<TextLink href="/admin/distribution">配信の一覧へ戻る</TextLink>}
        />
      ) : (
        <CalendarBody view={result.value} notice={await distributionNotice()} />
      )}
    </AdminShell>
  );
}

type CalendarView = Extract<
  Awaited<ReturnType<Awaited<ReturnType<typeof publicationCalendarUseCases>>["getCalendar"]["execute"]>>,
  { readonly ok: true }
>["value"];

/**
 * カレンダー本体。
 *
 * 骨格から切り出しているのは、読み出しに失敗しても
 * パンくずと「配信の一覧へ戻る」は残したいから。
 */
function CalendarBody({
  view,
  notice,
}: {
  readonly view: CalendarView;
  readonly notice: Awaited<ReturnType<typeof distributionNotice>>;
}) {
  const reschedulable = [...view.days.flatMap((d) => d.entries), ...view.undated];

  return (
    <>
      <StorageNotice status={notice} />

      <Section
        title={`${view.monthLabel}の投稿予定`}
        lead="同じ日に寄っているもの、承認前のもの、失敗したまま止まっているものは、その日の枠に理由を出します。"
      >
        <Row>
          <TextLink href={`/admin/distribution/calendar?month=${view.previousMonth}`}>
            前の月（{view.previousMonth}）
          </TextLink>
          <TextLink href={`/admin/distribution/calendar?month=${view.nextMonth}`}>
            次の月（{view.nextMonth}）
          </TextLink>
        </Row>

        {view.awaitingApprovalCount === 0 ? null : (
          <Callout
            tone="warn"
            title={`${view.awaitingApprovalCount}件が、承認されないまま予約されています`}
            reason="このまま予定日を迎えても出ません。記事の進行から承認してください。"
            action={<TextLink href="/admin/content">記事の進行を見る</TextLink>}
          />
        )}

        {view.errorCount === 0 ? null : (
          <Callout
            tone="warn"
            title={`${view.errorCount}件が失敗したまま止まっています`}
            reason="送信に失敗した配信は、そのままでは再送されません。1 件ずつ原因を確認してください。"
            action={<TextLink href="/admin/distribution">配信の一覧を見る</TextLink>}
          />
        )}

        {view.emptyReason !== null ? (
          <EmptyView
            title="この月に予定されている投稿はありません"
            body={view.emptyReason}
            action={<TextLink href="/admin/content">記事の進行を見る</TextLink>}
          />
        ) : (
          <ScheduleCalendar
            caption={`${view.monthLabel}の投稿予定（${view.totalEntries}件）`}
            days={view.days.map((d) => ({
              date: d.date,
              dayOfMonth: d.dayOfMonth,
              weekday: d.weekday,
              isToday: d.isToday,
              warnings: d.warnings,
              entries: d.entries.map((e) => ({
                id: e.publicationId,
                headline: `${e.channelLabel}：${e.title}`,
                detail: `${e.accountLabel} / ${e.approvalLabel}`,
                attentionReason: e.errorMessage,
                href: e.href,
              })),
            }))}
            renderLink={(href, label) => <TextLink href={href}>{label}</TextLink>}
          />
        )}
      </Section>

      {view.undated.length === 0 ? null : (
        <Section
          title={`日時の決まっていない配信（${view.undated.length}件）`}
          lead="カレンダーに置く日付がないため、ここにまとめています。"
        >
          <Prose>
            承認され次第すぐに出るので、出す日を決めたい場合は予定日を入れてください。
          </Prose>
          <ListView
            rows={view.undated.map((e) => ({
              key: e.publicationId,
              label: `${e.channelLabel}：${e.title}`,
              href: e.href,
              note: `${e.accountLabel} / ${e.approvalLabel} / ${e.stateLabel}`,
            }))}
          />
        </Section>
      )}

      <Section title="予定日を変える" lead="日時を選んで変えます。">
        <Prose>
          掴んで動かす操作にしていないのは、キーボードだけを使う方が予定を動かせなくなるためです。
        </Prose>
        {!view.canReschedule ? (
          <ActionNote>
            いまの権限では予定日を変えられません。{view.cannotRescheduleReason ?? ""}{" "}
            <TextLink href="/admin/settings">担当者の権限を見る</TextLink>
          </ActionNote>
        ) : reschedulable.length === 0 ? (
          <EmptyView
            title="変えられる配信がありません"
            body="この月に予定されている配信がないためです。"
          />
        ) : (
          reschedulable.map((e) => (
            <SubSection key={e.publicationId} title={`${e.channelLabel}：${e.title}`}>
              <Note>
                いまの予定：{e.scheduledLabel} ／ 状態：{e.stateLabel}
              </Note>
              <RescheduleForm
                publicationId={e.publicationId}
                currentValue={toInputValue(e.scheduledAt)}
                disabledReason={e.notReschedulableReason}
                label={`${e.channelLabel}の${e.title}`}
              />
            </SubSection>
          ))
        )}
      </Section>
    </>
  );
}

/** `datetime-local` が読める形（YYYY-MM-DDTHH:mm）へ直す。 */
function toInputValue(at: Date | null): string {
  if (at === null) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(
    at.getHours(),
  )}:${pad(at.getMinutes())}`;
}
