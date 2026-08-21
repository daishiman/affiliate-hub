import Link from "next/link";
import type { ReactNode } from "react";
import {
  IssueIntegrationAccessForm,
  RevokeIntegrationAccessForm,
} from "@/presentation/admin/integration-access-form";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, feedbackUseCases } from "@/presentation/composition";
import { Callout, Card, DataTable, EmptyView, ErrorView, Note, Page, SectionHeading } from "@/presentation/ui";
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
  const listed = await (await feedbackUseCases()).keys.execute(actor, { action: "list" });

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
        <SectionHeading level={2}>新しい鍵を発行する</SectionHeading>
        <p className={styles.sectionLead}>
          Claude Code に未対応の要望を取りに来てもらう場合だけ発行してください。
          人がコピーして渡すだけなら、鍵は要りません。
        </p>
        <IssueIntegrationAccessForm />
      </Card>

      <Card>
        <SectionHeading level={2}>いまある鍵</SectionHeading>
        {rows.length === 0 ? (
          <EmptyView
            title="まだ鍵はありません"
            body={emptyReason ?? "取りに来てもらう場合だけ発行してください。"}
            action={<Link href="/admin/feedback">改善要望の一覧へ</Link>}
          />
        ) : (
          <>
            <DataTable
              caption="鍵の値そのものは、発行したときの 1 回しか出ません。ここには残っていません。"
              columns={[
                { key: "label", header: "名前", rowHeader: true, cell: (k) => k.label },
                {
                  key: "scopes",
                  header: "できること",
                  cell: (k) => k.scopeLabels.join("・"),
                },
                {
                  key: "createdAt",
                  header: "発行した日",
                  cell: (k) => k.createdAt.toLocaleDateString("ja-JP"),
                },
                {
                  key: "lastUsedAt",
                  header: "最後に使った日",
                  cell: (k) =>
                    k.lastUsedAt === null ? k.lastUsedText : k.lastUsedAt.toLocaleString("ja-JP"),
                },
                {
                  key: "rateLimit",
                  header: "1 分あたりの上限",
                  align: "numeric",
                  cell: (k) => `${k.rateLimitPerMinute}回`,
                },
                { key: "state", header: "状態", cell: (k) => (k.revoked ? "失効済み" : "使えます") },
              ]}
              rows={rows}
              rowKey={(k) => k.id}
            />

            {rows
              .filter((k) => !k.revoked)
              .map((k) => (
                <div key={`revoke-${k.id}`}>
                  <RevokeIntegrationAccessForm id={k.id} label={k.label} />
                </div>
              ))}
            <Note>
              失効させても一覧からは消えません。消すと、渡した記録の「どの鍵で」が
              名前の無い番号だけになり、後からたどれなくなるためです。
            </Note>
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
