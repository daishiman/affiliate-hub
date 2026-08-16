import Link from "next/link";
import type { ReactNode } from "react";
import { RescheduleForm } from "@/presentation/admin/reschedule-form";
import {
  currentActor,
  distributionNotice,
  publicationCalendarUseCases,
} from "@/presentation/composition";
import {
  AppShell,
  Callout,
  Card,
  EmptyView,
  ErrorView,
  Page,
  ScheduleCalendar,
  StubNotice,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

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
  const result = await publicationCalendarUseCases().getCalendar.execute(actor, { month });

  if (!result.ok) {
    return (
      <Shell>
        <ErrorView
          title="投稿カレンダーを出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? "配信の一覧からもう一度お試しください。"}
          action={<Link href="/admin/distribution">配信の一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const view = result.value;

  return (
    <Shell>
      <StubNotice
        what="配信先の接続と配信の記録の保存先"
        blockedBy="channel_connections / publications テーブルの追加と、各サービスの接続設定"
        stubId="persistence:distribution-sample"
      >
        <span>{distributionNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>{view.monthLabel}の投稿予定</h2>
        <p className={styles.sectionLead}>
          日付ごとに並べています。同じ日に同じ先へ寄っているもの、承認前のまま予約されているもの、
          失敗したまま止まっているものは、その日の枠に理由を出します。
        </p>

        <nav aria-label="月の切り替え" className={styles.linkList}>
          <Link href={`/admin/distribution/calendar?month=${view.previousMonth}`}>
            前の月（{view.previousMonth}）
          </Link>
          <Link href={`/admin/distribution/calendar?month=${view.nextMonth}`}>
            次の月（{view.nextMonth}）
          </Link>
        </nav>

        {view.awaitingApprovalCount === 0 ? null : (
          <Callout
            tone="warn"
            title={`${view.awaitingApprovalCount}件が、承認されないまま予約されています`}
            reason="このまま予定日を迎えても出ません。記事の進行から承認してください。"
            action={<Link href="/admin/content">記事の進行を見る</Link>}
          />
        )}

        {view.errorCount === 0 ? null : (
          <Callout
            tone="warn"
            title={`${view.errorCount}件が失敗したまま止まっています`}
            reason="送信に失敗した配信は、そのままでは再送されません。1 件ずつ原因を確認してください。"
            action={<Link href="/admin/distribution">配信の一覧を見る</Link>}
          />
        )}

        {view.emptyReason !== null ? (
          <EmptyView
            title="この月に予定されている投稿はありません"
            body={view.emptyReason}
            action={<Link href="/admin/content">記事の進行を見る</Link>}
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
            renderLink={(href, label) => <Link href={href}>{label}</Link>}
          />
        )}
      </Card>

      {view.undated.length === 0 ? null : (
        <Card>
          <h2 className={styles.sectionTitle}>日時の決まっていない配信（{view.undated.length}件）</h2>
          <p className={styles.sectionLead}>
            カレンダーに置く日付がないため、ここにまとめています。
            承認され次第すぐに出るので、出す日を決めたい場合は予定日を入れてください。
          </p>
          <ul className={styles.linkList}>
            {view.undated.map((e) => (
              <li key={e.publicationId}>
                <Link href={e.href}>
                  {e.channelLabel}：{e.title}
                </Link>
                <span className={styles.linkNote}>
                  {e.accountLabel} / {e.approvalLabel} / {e.stateLabel}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className={styles.sectionTitle}>予定日を変える</h2>
        <p className={styles.sectionLead}>
          日時を選んで変えます。掴んで動かす操作にしていないのは、
          キーボードだけを使う方が予定を動かせなくなるためです。
        </p>
        {!view.canReschedule ? (
          <Callout
            tone="info"
            title="いまの権限では予定日を変えられません"
            reason={view.cannotRescheduleReason ?? ""}
            action={<Link href="/admin/settings">担当者の権限を見る</Link>}
          />
        ) : view.days.flatMap((d) => d.entries).length === 0 && view.undated.length === 0 ? (
          <EmptyView
            title="変えられる配信がありません"
            body="この月に予定されている配信がないためです。"
          />
        ) : (
          [...view.days.flatMap((d) => d.entries), ...view.undated].map((e) => (
            <div key={e.publicationId}>
              <h3 className={styles.sectionTitle}>
                {e.channelLabel}：{e.title}
              </h3>
              <p className={styles.linkNote}>
                いまの予定：{e.scheduledLabel} ／ 状態：{e.stateLabel}
              </p>
              <RescheduleForm
                publicationId={e.publicationId}
                currentValue={toInputValue(e.scheduledAt)}
                disabledReason={e.notReschedulableReason}
                label={`${e.channelLabel}の${e.title}`}
              />
            </div>
          ))
        )}
      </Card>
    </Shell>
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

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AppShell
      currentPath="/admin/distribution"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "配信", href: "/admin/distribution" },
        { label: "投稿カレンダー" },
      ]}
      actions={<Link href="/admin/distribution">配信の一覧へ戻る</Link>}
    >
      <Page
        title="投稿カレンダー"
        lead="いつ・どこへ出す予定かを日付で並べます。同じ日に寄っていないか、承認が済んでいるかを出す前に確かめられます。"
      >
        {children}
      </Page>
    </AppShell>
  );
}
