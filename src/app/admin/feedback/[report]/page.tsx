import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  FeedbackDispositionForm,
  FeedbackHandoffForm,
  FeedbackPullCommand,
  FeedbackStatusForm,
} from "@/presentation/admin/feedback-forms";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import { currentActor, feedbackCaptureNotice, feedbackUseCases } from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  Foldable,
  ErrorView,
  FactList,
  Figure,
  ListView,
  Note,
  Prose,
  Section,
  StorageNotice,
  SubSection,
  TextLink,
  UI_COPY,
} from "@/presentation/ui";

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
  const captureNotice = await feedbackCaptureNotice();

  return (
    <AdminShell
      routeId="feedback/[report]"
      routeParams={{ report: id }}
      title="届いた改善要望"
      lead="1 件分の中身と、誰が持って行ったかを見ます。"
      actions={<TextLink href="/admin/feedback">一覧へ戻る</TextLink>}
    >
      {!read.ok ? (
        <ErrorView
          title="この改善要望を出せませんでした"
          body={read.error.message}
          suggestedAction={read.error.suggestedAction ?? null}
          action={<TextLink href="/admin/feedback">一覧へ戻る</TextLink>}
        />
      ) : (
        <FeedbackReport report={read.value} captureNotice={captureNotice} />
      )}
    </AdminShell>
  );
}

type Report = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof feedbackUseCases>>["read"]["execute"]>
>;

function FeedbackReport({
  report: v,
  captureNotice,
}: {
  readonly report: Report;
  readonly captureNotice: Awaited<ReturnType<typeof feedbackCaptureNotice>>;
}) {
  return (
    <>
      {/* ① 送られたこと */}
      <Section
        title="届いた内容"
        lead={`${v.kindLabel}・${v.submittedAt.toLocaleString("ja-JP")}`}
      >
        <Prose>{v.body}</Prose>
      </Section>

      {/* ② どうなってほしいか */}
      <Section title={UI_COPY.feedback.wishLabel}>
        {v.wishProvided ? <Prose>{v.wishText}</Prose> : <ActionNote>{v.wishText}</ActionNote>}
      </Section>

      {/* ③ どの画面から */}
      <Section title="どの画面から届いたか">
        <FactList
          rows={[
            { key: "screen", label: "画面", value: v.screenName },
            { key: "route", label: "道すじ", value: v.route },
            { key: "url", label: "アドレス", value: v.url },
          ]}
        />
      </Section>

      {/* ④ どの作業場所のものか */}
      <Section title="どこのものか">
        <FactList
          rows={[
            { key: "workspace", label: "作業場所", value: v.workspaceId },
            { key: "brand", label: "ブランド", value: v.brandId ?? "指定なし" },
            { key: "site", label: "サイト", value: v.siteId ?? "指定なし" },
          ]}
        />
      </Section>

      {/* ⑤ 画面の写し */}
      <Section title="そのときの画面">
        {/* 何で動いているかは入口が決める。ここに条件を書くと、
            置き場をつないだ日に画面だけが古いことを言い続ける。 */}
        <StorageNotice status={captureNotice} />
        {v.captureUrl === null ? (
          <ActionNote>
            {v.captureAbsentReason ?? "画像は付いていません（文章だけで送られました）。"}
          </ActionNote>
        ) : (
          /* 黒塗りは画素へ焼き込み済み。元の画像は保存していない。
             取り出す口（/api/feedback-captures）を必ず毎回通す。 */
          <Figure
            src={v.captureUrl}
            alt={`${v.screenName} の画面（黒塗り済み）`}
            note="黒塗りは画像そのものに焼き込まれています。元の画像は保存していません。"
          />
        )}
      </Section>

      {/* ⑥ 技術情報（件数は畳んだまま見せる） */}
      <Section
        title="そのとき記録されたこと"
        lead={`エラー ${v.jsErrorCount} 件・通信の失敗 ${v.failedRequestCount} 件・黒塗り ${v.redactedCount} 箇所`}
      >
        <Foldable summary="中身を見る（開発者向けの記録です）">
          <FactList
            rows={[
              {
                key: "js",
                label: "エラー",
                value:
                  v.technical.jsErrors.length === 0
                    ? "記録されていません。"
                    : v.technical.jsErrors.join(" / "),
              },
              {
                key: "net",
                label: "通信の失敗",
                value:
                  v.technical.failedRequests.length === 0
                    ? "記録されていません。"
                    : v.technical.failedRequests.join(" / "),
              },
              {
                key: "actions",
                label: "直前の操作",
                value:
                  v.technical.recentActions.length === 0
                    ? "記録されていません。"
                    : v.technical.recentActions.join(" → "),
              },
              {
                key: "ua",
                label: "使っていた環境",
                value:
                  v.technical.userAgent === "" ? "記録されていません。" : v.technical.userAgent,
              },
            ]}
          />
        </Foldable>
      </Section>

      {/* ⑦ 作業する側へ渡す */}
      <Section title={UI_COPY.feedback.handoffTitle}>
        <Callout tone="info" title="渡した回数" reason={UI_COPY.feedback.handoffIdempotent} />
        <Prose>これまでに {v.handoffCount} 回渡しています。</Prose>

        <FeedbackHandoffForm ids={[v.id]} />

        <SubSection title="取りに来てもらう">
          <FeedbackPullCommand />
        </SubSection>

        <SubSection title="渡した記録">
          {v.handoffHistory.length === 0 ? (
            <Note>{v.handoffHistoryEmptyText}</Note>
          ) : (
            <DataTable
              caption="誰が・どの鍵で持って行ったかが残ります。鍵の値そのものは出ません。"
              columns={[
                { key: "at", label: "日時" },
                { key: "route", label: "経路" },
                { key: "actor", label: "誰が" },
                { key: "key", label: "どの鍵で" },
              ]}
              rows={v.handoffHistory.map((h) => ({
                key: `${h.at.toISOString()}-${h.actor}`,
                cells: [
                  h.at.toLocaleString("ja-JP"),
                  h.routeLabel,
                  h.actor,
                  h.keyId ?? "—（人がコピーしました）",
                ],
              }))}
            />
          )}
        </SubSection>
      </Section>

      {/* ⑧ 対応状況 */}
      <Section title="対応状況を変える">
        <FeedbackStatusForm id={v.id} currentStatus={v.statusLabel} />
      </Section>

      {/* ⑨ 扱いの決定と取り消し */}
      <Section title="この要望の扱い">
        {v.dispositionReason === null ? null : <Note>いまの理由: {v.dispositionReason}</Note>}
        <FeedbackDispositionForm id={v.id} dispositionLabel={v.dispositionLabel} />
      </Section>

      {/* ⑩ 操作の履歴（積むだけ。消さない） */}
      <Section title="これまでの操作">
        {v.history.length === 0 ? (
          <Note>まだ何も操作されていません。</Note>
        ) : (
          <ListView
            rows={v.history.map((h) => ({
              key: `${h.at.toISOString()}-${h.summary}`,
              label: `${h.at.toLocaleString("ja-JP")}／${h.by}`,
              note: h.summary,
            }))}
          />
        )}
        <Note>
          履歴は積むだけで、消したり書き換えたりできません。
          {v.beadsIssueId === null
            ? "実装の進み具合は Beads 側が正本です。"
            : `実装の進み具合は Beads の ${v.beadsIssueId} が正本です。`}
        </Note>
      </Section>
    </>
  );
}
