import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
} from "@/domain/feedback";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { FeedbackHandoffForm } from "@/presentation/admin/feedback-forms";
import { currentActor, feedbackNotice, feedbackUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  FactList,
  FilterBar,
  Note,
  SeeAlso,
  RowSelector,
  Section,
  StorageNotice,
  TextLink,
  UI_COPY,
  type FilterAxis,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 使い勝手を直す（改善要望の一覧）。
 *
 * --- 件数を必ず一緒に出す理由 ---
 *
 * 絞り込んだ一覧だけを見ていると、**絞ったことを忘れて「もう無い」と読む**。
 * 状態ごとの件数を上に置き、いま何で絞っているかを絞り込みの棚が文で出す。
 *
 * --- まとめて渡せるようにしてある理由 ---
 *
 * 1 件ずつ開いてコピーする作りだと、10 件たまった時点で誰もやらなくなる。
 * やらなくなった記録は、記録が無いのと同じである。
 *
 * --- 廃棄したものを既定で出さない ---
 *
 * 出すと、対応する必要のないものが常に視界に入る。ただし
 * 「廃棄したものも見る」を必ず用意する（消していないことが確かめられないと、
 * 廃棄を押すのが怖くなる）。
 */
export default async function FeedbackListPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const status = FEEDBACK_STATUSES.find((s) => s === params.status) ?? null;
  const kind = FEEDBACK_KINDS.find((k) => k === params.kind) ?? null;
  const handedOff = params.handedOff === "yes" ? true : params.handedOff === "no" ? false : null;
  const includeDiscarded = params.discarded === "yes";

  const actor = await currentActor();
  const listed = await (await feedbackUseCases()).list.execute(actor, {
    statuses: status === null ? undefined : [status],
    kinds: kind === null ? undefined : [kind],
    handedOff: handedOff === null ? undefined : handedOff,
    includeDiscarded,
  });

  const axes: readonly FilterAxis[] = [
    {
      key: "status",
      label: "対応状況",
      whatItTells: "受け取ってから渡すまでの、どこで止まっているかが分かります。",
      options: FEEDBACK_STATUSES.map((s) => ({ value: s, label: FEEDBACK_STATUS_LABELS[s] })),
      selected: status,
      unavailableReason: null,
      commercial: false,
    },
    {
      key: "kind",
      label: "種類",
      whatItTells: "「動かない」だけを先に見る、といった読み方ができます。",
      options: FEEDBACK_KINDS.map((k) => ({ value: k, label: FEEDBACK_KIND_LABELS[k] })),
      selected: kind,
      unavailableReason: null,
      commercial: false,
    },
    {
      key: "handedOff",
      label: "払い出し",
      whatItTells: "まだ誰も持って行っていないものだけを選べます。",
      options: [
        { value: "no", label: "まだ渡していない" },
        { value: "yes", label: "渡した" },
      ],
      selected: handedOff === null ? null : handedOff ? "yes" : "no",
      unavailableReason: null,
      commercial: false,
    },
  ];

  const active = [
    status === null ? null : `対応状況「${FEEDBACK_STATUS_LABELS[status]}」`,
    kind === null ? null : `種類「${FEEDBACK_KIND_LABELS[kind]}」`,
    handedOff === null ? null : handedOff ? "渡したもの" : "まだ渡していないもの",
  ].filter((v): v is string => v !== null);

  return (
    <AdminShell
      routeId="feedback"
      title={UI_COPY.feedback.listTitle}
      lead="画面の右下から届いた「困っていること」を扱います。"
      actions={<TextLink href="/admin/settings/integration-access">取得用の鍵</TextLink>}
    >
      {!listed.ok ? (
        <ErrorView
          title="改善要望の一覧を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await feedbackNotice()} />

          <Section title="いまの状況">
            <FactList
              rows={FEEDBACK_STATUSES.map((s) => ({
                key: s,
                label: FEEDBACK_STATUS_LABELS[s],
                value: `${listed.value.counts[s]}件`,
              }))}
            />
            <Note>
              この件数は、いま絞り込んで見えている分の数です。絞り込みを外した全体の数ではありません。
            </Note>
          </Section>

          <Section title="絞り込む">
            <FilterBar
              axes={axes}
              action="/admin/feedback"
              legend="改善要望の絞り込み"
              keep={includeDiscarded ? { discarded: "yes" } : undefined}
              summary={active.length === 0 ? null : `いま ${active.join("・")} で絞っています。`}
              clearHref="/admin/feedback"
            />
            <SeeAlso>
              {includeDiscarded ? (
                <TextLink href="/admin/feedback">廃棄したものを隠す</TextLink>
              ) : (
                <TextLink href="/admin/feedback?discarded=yes">
                  廃棄したものも見る（消していません）
                </TextLink>
              )}
            </SeeAlso>
          </Section>

          <Section title="届いている要望">
            {listed.value.rows.length === 0 ? (
              <EmptyView
                title={UI_COPY.feedback.emptyTitle}
                body={listed.value.emptyReason ?? UI_COPY.feedback.emptyBody}
                action={<TextLink href="/admin/feedback">絞り込みを外す</TextLink>}
              />
            ) : (
              <FeedbackHandoffForm>
                <DataTable
                  caption="改善要望の一覧（新しい順）"
                  columns={[
                    { key: "date", label: "届いた日" },
                    { key: "pick", label: "選ぶ" },
                    { key: "kind", label: "種類" },
                    { key: "summary", label: "内容" },
                    { key: "screen", label: "画面" },
                    { key: "status", label: "対応状況" },
                    { key: "disposition", label: "扱い" },
                    { key: "handedOff", label: "払い出し" },
                    { key: "count", label: "渡した回数", numeric: true },
                    { key: "last", label: "最後に渡した日" },
                  ]}
                  rows={listed.value.rows.map((r) => ({
                    key: r.id,
                    cells: [
                      r.submittedAt.toLocaleDateString("ja-JP"),
                      <RowSelector key="pick" name="ids" value={r.id} label={`${r.id} を渡す`} />,
                      r.kindLabel,
                      <TextLink key="link" href={`/admin/feedback/${encodeURIComponent(r.id)}`}>
                        {r.summary}
                      </TextLink>,
                      r.screenName,
                      r.statusLabel,
                      r.dispositionLabel ?? "—",
                      r.handedOff ? "渡した" : "まだ",
                      `${r.handoffCount}回`,
                      r.lastHandoffAt === null ? "—" : r.lastHandoffAt.toLocaleDateString("ja-JP"),
                    ],
                  }))}
                />
                <Note>
                  「—」は、まだ決まっていない・まだ起きていないという意味です。該当なしではありません。
                </Note>
              </FeedbackHandoffForm>
            )}
          </Section>

          <Callout
            tone="info"
            title="ここに並ぶものと、Beads に並ぶもの"
            reason="ここにあるのは「利用者が困っていること」です。実装が進んだかどうかは Beads が正本で、こちらへは写しません。両方に書くと、必ずどちらかが古くなります。"
            action={
              <TextLink href="/admin/settings/integration-access">取得用の鍵を管理する</TextLink>
            }
          />
        </>
      )}
    </AdminShell>
  );
}
