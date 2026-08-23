import Link from "next/link";
import type { ReactNode } from "react";
import {
  FeedbackDispositionForm,
  FeedbackHandoffForm,
  FeedbackPullCommand,
  FeedbackStatusForm,
} from "@/presentation/admin/feedback-forms";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, feedbackCaptureNotice, feedbackUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
  DefinitionList,
  ErrorView,
  Note,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StorageNotice,
  UI_COPY,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 改善要望 1 件。
 *
 * --- 「無い」を空欄にしない ---
 *
 * 「どうなってほしいか」が書かれていないことは珍しくない。空欄で出すと、
 * 読む側は**まだ読み込み中なのか、そもそも書かれていないのか**を区別できない。
 * 文にして出す（文言はユースケースが持っている）。
 *
 * --- 技術情報を畳んである理由 ---
 *
 * エラーの記録は、読む人の 9 割にとって意味が無い。開いたまま置くと
 * 本文が下へ押し出され、一番読んでほしいものが読まれなくなる。
 * ただし**件数は畳んだまま見せる**。0 件と「畳まれていて分からない」は違う。
 *
 * --- 扱いの決定を取り消せる位置に置く ---
 *
 * 決める場所と戻す場所が離れていると、「戻せます」と書いてあっても
 * 戻し方が見つからず、結果として誰も決めなくなる。
 */
export default async function FeedbackDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly report: string }>;
}) {
  const { report: id } = await params;
  const actor = await currentActor();
  const read = await (await feedbackUseCases()).read.execute(actor, { id });

  if (!read.ok) {
    return (
      <Shell id={id}>
        <ErrorView
          title="この改善要望を出せませんでした"
          body={read.error.message}
          suggestedAction={read.error.suggestedAction ?? null}
          action={<Link href="/admin/feedback">一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const v = read.value;

  return (
    <Shell id={id}>
      {/* ① 送られたこと */}
      <Card>
        <SectionHeading level={2}>届いた内容</SectionHeading>
        <p className={styles.sectionLead}>
          {v.kindLabel}・{v.submittedAt.toLocaleString("ja-JP")}
        </p>
        <p>{v.body}</p>
      </Card>

      {/* ② どうなってほしいか */}
      <Card>
        <SectionHeading level={2}>{UI_COPY.feedback.wishLabel}</SectionHeading>
        {v.wishProvided ? <p>{v.wishText}</p> : <Callout tone="info" reason={v.wishText} />}
      </Card>

      {/* ③ どの画面から */}
      <Card>
        <SectionHeading level={2}>どの画面から届いたか</SectionHeading>
        <DefinitionList
          items={[
            { term: "画面", description: v.screenName },
            { term: "道すじ", description: v.route },
            { term: "アドレス", description: v.url },
          ]}
        />
      </Card>

      {/* ④ どの作業場所のものか */}
      <Card>
        <SectionHeading level={2}>どこのものか</SectionHeading>
        <DefinitionList
          items={[
            { term: "作業場所", description: v.workspaceId },
            { term: "ブランド", description: v.brandId ?? "指定なし" },
            { term: "サイト", description: v.siteId ?? "指定なし" },
          ]}
        />
      </Card>

      {/* ⑤ 画面の写し */}
      <Card>
        <SectionHeading level={2}>そのときの画面</SectionHeading>
        {/* 何で動いているかは入口が決める。ここに条件を書くと、
            置き場をつないだ日に画面だけが古いことを言い続ける。 */}
        <StorageNotice status={await feedbackCaptureNotice()} />
        {v.captureUrl === null ? (
          <Callout
            tone="info"
            reason={v.captureAbsentReason ?? "画像は付いていません（文章だけで送られました）。"}
          />
        ) : (
          <>
            {/* 黒塗りは画素へ焼き込み済み。元の画像は保存していない。 */}
            {/* next/image を使わない: 最適化は画像を別の場所へ複製する。
                複製された先は保存期間の外なので、「180 日で消えます」が効かなくなる。
                取り出す口（/api/feedback-captures）を必ず毎回通す。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.captureUrl} alt={`${v.screenName} の画面（黒塗り済み）`} />
            <Note>
              黒塗りは画像そのものに焼き込まれています。元の画像は保存していません。
            </Note>
          </>
        )}
      </Card>

      {/* ⑥ 技術情報（件数は畳んだまま見せる） */}
      <Card>
        <SectionHeading level={2}>そのとき記録されたこと</SectionHeading>
        <p className={styles.sectionLead}>
          エラー {v.jsErrorCount} 件・通信の失敗 {v.failedRequestCount} 件・黒塗り {v.redactedCount}{" "}
          箇所
        </p>
        <details>
          <summary>中身を見る（開発者向けの記録です）</summary>
          <DefinitionList
            items={[
              {
                term: "エラー",
                description:
                  v.technical.jsErrors.length === 0
                    ? "記録されていません。"
                    : v.technical.jsErrors.join(" / "),
              },
              {
                term: "通信の失敗",
                description:
                  v.technical.failedRequests.length === 0
                    ? "記録されていません。"
                    : v.technical.failedRequests.join(" / "),
              },
              {
                term: "直前の操作",
                description:
                  v.technical.recentActions.length === 0
                    ? "記録されていません。"
                    : v.technical.recentActions.join(" → "),
              },
              {
                term: "使っていた環境",
                description:
                  v.technical.userAgent === "" ? "記録されていません。" : v.technical.userAgent,
              },
            ]}
          />
        </details>
      </Card>

      {/* ⑦ 作業する側へ渡す */}
      <Card>
        <SectionHeading level={2}>{UI_COPY.feedback.handoffTitle}</SectionHeading>
        <Callout tone="info" title="渡した回数" reason={UI_COPY.feedback.handoffIdempotent} />
        <p className={styles.sectionLead}>これまでに {v.handoffCount} 回渡しています。</p>

        <FeedbackHandoffForm>
          <input type="hidden" name="ids" value={v.id} />
        </FeedbackHandoffForm>

        <SectionHeading level={3}>取りに来てもらう</SectionHeading>
        <FeedbackPullCommand />

        <SectionHeading level={3}>渡した記録</SectionHeading>
        {v.handoffHistory.length === 0 ? (
          <Note>{v.handoffHistoryEmptyText}</Note>
        ) : (
          <DataTable
            caption="誰が・どの鍵で持って行ったかが残ります。鍵の値そのものは出ません。"
            columns={[
              {
                key: "at",
                header: "日時",
                rowHeader: true,
                cell: (h) => h.at.toLocaleString("ja-JP"),
              },
              { key: "route", header: "経路", cell: (h) => h.routeLabel },
              { key: "actor", header: "誰が", cell: (h) => h.actor },
              { key: "key", header: "どの鍵で", cell: (h) => h.keyId ?? "—（人がコピーしました）" },
            ]}
            rows={v.handoffHistory}
            rowKey={(h) => `${h.at.toISOString()}-${h.actor}`}
          />
        )}
      </Card>

      {/* ⑧ 対応状況 */}
      <Card>
        <SectionHeading level={2}>対応状況を変える</SectionHeading>
        <FeedbackStatusForm id={v.id} currentStatus={v.statusLabel} />
      </Card>

      {/* ⑨ 扱いの決定と取り消し */}
      <Card>
        <SectionHeading level={2}>この要望の扱い</SectionHeading>
        {v.dispositionReason === null ? null : (
          <Note>いまの理由: {v.dispositionReason}</Note>
        )}
        <FeedbackDispositionForm id={v.id} dispositionLabel={v.dispositionLabel} />
      </Card>

      {/* ⑩ 操作の履歴（積むだけ。消さない） */}
      <Card>
        <SectionHeading level={2}>これまでの操作</SectionHeading>
        {v.history.length === 0 ? (
          <Note>まだ何も操作されていません。</Note>
        ) : (
          <StackedList>
            {v.history.map((h) => (
              <StackedRow key={`${h.at.toISOString()}-${h.summary}`} note={h.summary}>
                {h.at.toLocaleString("ja-JP")}／{h.by}
                
              </StackedRow>
            ))}
          </StackedList>
        )}
        <Note>
          履歴は積むだけで、消したり書き換えたりできません。
          {v.beadsIssueId === null
            ? "実装の進み具合は Beads 側が正本です。"
            : `実装の進み具合は Beads の ${v.beadsIssueId} が正本です。`}
        </Note>
      </Card>
    </Shell>
  );
}

function Shell({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/feedback"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: UI_COPY.feedback.listTitle, href: "/admin/feedback" },
        { label: id },
      ]}
      actions={<Link href="/admin/feedback">一覧へ戻る</Link>}
    >
      <Page
        title="届いた改善要望"
        lead="1 件分の中身と、これまでに誰が持って行ったかを見る画面です。書かれていないことは「書かれていません」と出します。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
