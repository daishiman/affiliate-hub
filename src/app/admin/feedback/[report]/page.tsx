import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  FeedbackDispositionForm,
  FeedbackHandoffForm,
  FeedbackPullCommand,
  FeedbackStatusForm,
} from "@/presentation/admin/feedback-forms";
import { currentActor, feedbackCaptureNotice, feedbackUseCases } from "@/presentation/composition";
import { Callout, Card, ErrorView, Page, StorageNotice, UI_COPY } from "@/presentation/ui";
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
        <h2 className={styles.sectionTitle}>届いた内容</h2>
        <p className={styles.sectionLead}>
          {v.kindLabel}・{v.submittedAt.toLocaleString("ja-JP")}
        </p>
        <p>{v.body}</p>
      </Card>

      {/* ② どうなってほしいか */}
      <Card>
        <h2 className={styles.sectionTitle}>{UI_COPY.feedback.wishLabel}</h2>
        {v.wishProvided ? <p>{v.wishText}</p> : <Callout tone="info" reason={v.wishText} />}
      </Card>

      {/* ③ どの画面から */}
      <Card>
        <h2 className={styles.sectionTitle}>どの画面から届いたか</h2>
        <dl className={styles.criteria}>
          <div>
            <dt>画面</dt>
            <dd>{v.screenName}</dd>
          </div>
          <div>
            <dt>道すじ</dt>
            <dd>{v.route}</dd>
          </div>
          <div>
            <dt>アドレス</dt>
            <dd>{v.url}</dd>
          </div>
        </dl>
      </Card>

      {/* ④ どの作業場所のものか */}
      <Card>
        <h2 className={styles.sectionTitle}>どこのものか</h2>
        <dl className={styles.criteria}>
          <div>
            <dt>作業場所</dt>
            <dd>{v.workspaceId}</dd>
          </div>
          <div>
            <dt>ブランド</dt>
            <dd>{v.brandId ?? "指定なし"}</dd>
          </div>
          <div>
            <dt>サイト</dt>
            <dd>{v.siteId ?? "指定なし"}</dd>
          </div>
        </dl>
      </Card>

      {/* ⑤ 画面の写し */}
      <Card>
        <h2 className={styles.sectionTitle}>そのときの画面</h2>
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
            <p className={styles.linkNote}>
              黒塗りは画像そのものに焼き込まれています。元の画像は保存していません。
            </p>
          </>
        )}
      </Card>

      {/* ⑥ 技術情報（件数は畳んだまま見せる） */}
      <Card>
        <h2 className={styles.sectionTitle}>そのとき記録されたこと</h2>
        <p className={styles.sectionLead}>
          エラー {v.jsErrorCount} 件・通信の失敗 {v.failedRequestCount} 件・黒塗り {v.redactedCount}{" "}
          箇所
        </p>
        <details>
          <summary>中身を見る（開発者向けの記録です）</summary>
          <dl className={styles.criteria}>
            <div>
              <dt>エラー</dt>
              <dd>
                {v.technical.jsErrors.length === 0
                  ? "記録されていません。"
                  : v.technical.jsErrors.join(" / ")}
              </dd>
            </div>
            <div>
              <dt>通信の失敗</dt>
              <dd>
                {v.technical.failedRequests.length === 0
                  ? "記録されていません。"
                  : v.technical.failedRequests.join(" / ")}
              </dd>
            </div>
            <div>
              <dt>直前の操作</dt>
              <dd>
                {v.technical.recentActions.length === 0
                  ? "記録されていません。"
                  : v.technical.recentActions.join(" → ")}
              </dd>
            </div>
            <div>
              <dt>使っていた環境</dt>
              <dd>{v.technical.userAgent === "" ? "記録されていません。" : v.technical.userAgent}</dd>
            </div>
          </dl>
        </details>
      </Card>

      {/* ⑦ 作業する側へ渡す */}
      <Card>
        <h2 className={styles.sectionTitle}>{UI_COPY.feedback.handoffTitle}</h2>
        <Callout tone="info" title="渡した回数" reason={UI_COPY.feedback.handoffIdempotent} />
        <p className={styles.sectionLead}>これまでに {v.handoffCount} 回渡しています。</p>

        <FeedbackHandoffForm>
          <input type="hidden" name="ids" value={v.id} />
        </FeedbackHandoffForm>

        <h3 className={styles.sectionTitle}>取りに来てもらう</h3>
        <FeedbackPullCommand />

        <h3 className={styles.sectionTitle}>渡した記録</h3>
        {v.handoffHistory.length === 0 ? (
          <p className={styles.linkNote}>{v.handoffHistoryEmptyText}</p>
        ) : (
          <table className={styles.rankTable}>
            <caption>誰が・どの鍵で持って行ったかが残ります。鍵の値そのものは出ません。</caption>
            <thead>
              <tr>
                <th scope="col">日時</th>
                <th scope="col">経路</th>
                <th scope="col">誰が</th>
                <th scope="col">どの鍵で</th>
              </tr>
            </thead>
            <tbody>
              {v.handoffHistory.map((h) => (
                <tr key={`${h.at.toISOString()}-${h.actor}`}>
                  <th scope="row">{h.at.toLocaleString("ja-JP")}</th>
                  <td>{h.routeLabel}</td>
                  <td>{h.actor}</td>
                  <td>{h.keyId ?? "—（人がコピーしました）"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ⑧ 対応状況 */}
      <Card>
        <h2 className={styles.sectionTitle}>対応状況を変える</h2>
        <FeedbackStatusForm id={v.id} currentStatus={v.statusLabel} />
      </Card>

      {/* ⑨ 扱いの決定と取り消し */}
      <Card>
        <h2 className={styles.sectionTitle}>この要望の扱い</h2>
        {v.dispositionReason === null ? null : (
          <p className={styles.linkNote}>いまの理由: {v.dispositionReason}</p>
        )}
        <FeedbackDispositionForm id={v.id} dispositionLabel={v.dispositionLabel} />
      </Card>

      {/* ⑩ 操作の履歴（積むだけ。消さない） */}
      <Card>
        <h2 className={styles.sectionTitle}>これまでの操作</h2>
        {v.history.length === 0 ? (
          <p className={styles.linkNote}>まだ何も操作されていません。</p>
        ) : (
          <ul className={styles.linkList}>
            {v.history.map((h) => (
              <li key={`${h.at.toISOString()}-${h.summary}`}>
                {h.at.toLocaleString("ja-JP")}／{h.by}
                <span className={styles.linkNote}>{h.summary}</span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.linkNote}>
          履歴は積むだけで、消したり書き換えたりできません。
          {v.beadsIssueId === null
            ? "実装の進み具合は Beads 側が正本です。"
            : `実装の進み具合は Beads の ${v.beadsIssueId} が正本です。`}
        </p>
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
