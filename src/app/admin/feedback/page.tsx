import Link from "next/link";
import type { ReactNode } from "react";
import {
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
} from "@/domain/feedback";
import { FeedbackHandoffForm } from "@/presentation/admin/feedback-forms";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, feedbackNotice, feedbackUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DefinitionList,
  EmptyView,
  ErrorView,
  FilterBar,
  Note,
  Page,
  SectionHeading,
  SeeAlso,
  StorageNotice,
  type FilterAxis,
  UI_COPY,
} from "@/presentation/ui";
import styles from "../admin.module.css";

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

  if (!listed.ok) {
    return (
      <Shell>
        <ErrorView
          title="改善要望の一覧を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const { rows, counts, emptyReason } = listed.value;

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
    <Shell>
      <StorageNotice status={await feedbackNotice()} />

      <Card>
        <SectionHeading level={2}>いまの状況</SectionHeading>
        <DefinitionList
          items={FEEDBACK_STATUSES.map((s) => ({
            term: FEEDBACK_STATUS_LABELS[s],
            description: `${counts[s]}件`,
            align: "numeric" as const,
          }))}
        />
        <Note>
          この件数は、いま絞り込んで見えている分の数です。絞り込みを外した全体の数ではありません。
        </Note>
      </Card>

      <Card>
        <SectionHeading level={2}>絞り込む</SectionHeading>
        <FilterBar
          axes={axes}
          action="/admin/feedback"
          legend="改善要望の絞り込み"
          keep={includeDiscarded ? { discarded: "yes" } : undefined}
          summary={active.length === 0 ? null : `いま ${active.join("・")} で絞っています。`}
          clearHref="/admin/feedback"
        />
        {/*
          **6 箇所のうち、ここだけ行き先が「別の画面」ではない。**残り 5 つは
          別の画面へ連れて行くが、これは同じ一覧の絞り込みを切り替えているだけである。
          役としては**絞り込みの軸**で、置き場は上の `FilterBar` の中が正しい
          （`axes` に載っていない軸が 1 本だけ外に出ている状態）。
          いま `SeeAlso` にしてあるのは、`FilterBar` の口を広げる判断を
          このついでに済ませないためで、**同じだと判定したからではない**（残課題 153）。
        */}
        <SeeAlso>
          {includeDiscarded ? (
            <Link href="/admin/feedback">廃棄したものを隠す</Link>
          ) : (
            <Link href="/admin/feedback?discarded=yes">廃棄したものも見る（消していません）</Link>
          )}
        </SeeAlso>
      </Card>

      <Card>
        <SectionHeading level={2}>届いている要望</SectionHeading>
        {rows.length === 0 ? (
          <EmptyView
            title={UI_COPY.feedback.emptyTitle}
            body={emptyReason ?? UI_COPY.feedback.emptyBody}
            action={<Link href="/admin/feedback">絞り込みを外す</Link>}
          />
        ) : (
          <FeedbackHandoffForm>
            {/* 横へ流す器。`tabIndex` が無いとキーボードで動かせない
                （`DataTable` と同じ理由。`admin.module.css` の `.rankTableWrap` を読むこと）。 */}
            <div
              className={styles.rankTableWrap}
              role="group"
              aria-label="受け取った指摘の一覧"
              tabIndex={0}
            >
            <table className={styles.rankTable}>
              <caption>
                新しい順に並べています。渡したいものにチェックを付けて、下のボタンを押してください。
              </caption>
              <thead>
                <tr>
                  <th scope="col">選ぶ</th>
                  <th scope="col">届いた日</th>
                  <th scope="col">種類</th>
                  <th scope="col">内容</th>
                  <th scope="col">画面</th>
                  <th scope="col">対応状況</th>
                  <th scope="col">扱い</th>
                  <th scope="col">払い出し</th>
                  <th scope="col">渡した回数</th>
                  <th scope="col">最後に渡した日</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <label>
                        <input type="checkbox" name="ids" value={r.id} />
                        <span className={styles.linkNote}>{r.id} を渡す</span>
                      </label>
                    </td>
                    <th scope="row">{r.submittedAt.toLocaleDateString("ja-JP")}</th>
                    <td>{r.kindLabel}</td>
                    <td>
                      <Link href={`/admin/feedback/${encodeURIComponent(r.id)}`}>{r.summary}</Link>
                    </td>
                    <td>{r.screenName}</td>
                    <td>{r.statusLabel}</td>
                    <td>{r.dispositionLabel ?? "—"}</td>
                    <td>{r.handedOff ? "渡した" : "まだ"}</td>
                    <td className={styles.numeric}>{r.handoffCount}回</td>
                    <td>
                      {r.lastHandoffAt === null
                        ? "—"
                        : r.lastHandoffAt.toLocaleDateString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Note>
              「—」は、まだ決まっていない・まだ起きていないという意味です。該当なしではありません。
            </Note>
          </FeedbackHandoffForm>
        )}
      </Card>

      <Callout
        tone="info"
        title="ここに並ぶものと、Beads に並ぶもの"
        reason="ここにあるのは「利用者が困っていること」です。実装が進んだかどうかは Beads が正本で、こちらへは写しません。両方に書くと、必ずどちらかが古くなります。"
        action={<Link href="/admin/settings/integration-access">取得用の鍵を管理する</Link>}
      />
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/feedback"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: UI_COPY.feedback.listTitle }]}
      actions={<Link href="/admin/settings/integration-access">取得用の鍵</Link>}
    >
      <Page
        title={UI_COPY.feedback.listTitle}
        lead="画面の右下から届いた「困っていること」を扱う場所です。渡した記録が残るので、同じ要望を二重に着手することがありません。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
