import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  IssueIntegrationAccessForm,
  RevokeIntegrationAccessForm,
} from "@/presentation/admin/integration-access-form";
import { currentActor, feedbackUseCases } from "@/presentation/composition";
import { Callout, Card, EmptyView, ErrorView, Page } from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 取りに来るときの鍵。
 *
 * --- 一覧に値が出ない ---
 *
 * 保存しているのは潰した値だけで、平文はどこにも残っていない。
 * 「見せない」ではなく「持っていない」ので、この画面をどう作っても値は出せない。
 * 忘れたら失効させて新しく発行する、が唯一の道になる。
 *
 * --- 最後に使った日を出す ---
 *
 * 使われていない鍵は、失効させてよい鍵である。この列が無いと、
 * 「消してよいか分からない」という理由だけで鍵が増え続ける。
 *
 * --- ここで秘密情報を預からない ---
 *
 * 発行した値を入力し直させる欄は作らない。作れば、その入力が
 * どこかの記録に残る経路ができる。
 */
export default async function IntegrationAccessPage() {
  const actor = await currentActor();
  const listed = await feedbackUseCases().keys.execute(actor, { action: "list" });

  if (!listed.ok) {
    return (
      <Shell>
        <ErrorView
          title="取得用の鍵を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<Link href="/admin/settings">設定へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { rows, handlingText, emptyReason } = listed.value;

  return (
    <Shell>
      <Callout tone="warn" title="鍵の扱い" reason={handlingText} />

      <Card>
        <h2 className={styles.sectionTitle}>新しい鍵を発行する</h2>
        <p className={styles.sectionLead}>
          Claude Code に未対応の要望を取りに来てもらう場合だけ発行してください。
          人がコピーして渡すだけなら、鍵は要りません。
        </p>
        <IssueIntegrationAccessForm />
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>いまある鍵</h2>
        {rows.length === 0 ? (
          <EmptyView
            title="まだ鍵はありません"
            body={emptyReason ?? "取りに来てもらう場合だけ発行してください。"}
            action={<Link href="/admin/feedback">改善要望の一覧へ</Link>}
          />
        ) : (
          <>
            <table className={styles.rankTable}>
              <caption>
                鍵の値そのものは、発行したときの 1 回しか出ません。ここには残っていません。
              </caption>
              <thead>
                <tr>
                  <th scope="col">名前</th>
                  <th scope="col">できること</th>
                  <th scope="col">発行した日</th>
                  <th scope="col">最後に使った日</th>
                  <th scope="col">1 分あたりの上限</th>
                  <th scope="col">状態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id}>
                    <th scope="row">{k.label}</th>
                    <td>{k.scopeLabels.join("・")}</td>
                    <td>{k.createdAt.toLocaleDateString("ja-JP")}</td>
                    <td>
                      {k.lastUsedAt === null
                        ? k.lastUsedText
                        : k.lastUsedAt.toLocaleString("ja-JP")}
                    </td>
                    <td className={styles.numeric}>{k.rateLimitPerMinute}回</td>
                    <td>{k.revoked ? "失効済み" : "使えます"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rows
              .filter((k) => !k.revoked)
              .map((k) => (
                <div key={`revoke-${k.id}`}>
                  <RevokeIntegrationAccessForm id={k.id} label={k.label} />
                </div>
              ))}
            <p className={styles.linkNote}>
              失効させても一覧からは消えません。消すと、渡した記録の「どの鍵で」が
              名前の無い番号だけになり、後からたどれなくなるためです。
            </p>
          </>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/settings"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "設定", href: "/admin/settings" },
        { label: "取得用の鍵" },
      ]}
      actions={<Link href="/admin/feedback">改善要望の一覧へ</Link>}
    >
      <Page
        title="取得用の鍵"
        lead="Claude Code に、未対応の改善要望を取りに来てもらうための鍵を管理する画面です。値が表示されるのは発行したときの 1 回だけです。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
