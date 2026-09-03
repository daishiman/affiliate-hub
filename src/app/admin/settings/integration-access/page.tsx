import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  IssueIntegrationAccessForm,
  RevokeIntegrationAccessForm,
} from "@/presentation/admin/maintain/integration-access-form";
import { currentActor, feedbackUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Note,
  Prose,
  Section,
  Stack,
  TextLink,
} from "@/presentation/ui";

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

  return (
    <AdminShell
      routeId="settings/integration-access"
      title="取得用の鍵"
      lead="取りに来てもらう鍵を管理します。"
      actions={<TextLink href="/admin/feedback">改善要望の一覧へ</TextLink>}
    >
      {!listed.ok ? (
        <ErrorView
          title="取得用の鍵を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
        />
      ) : (
        <>
          <Callout tone="warn" title="鍵の扱い" reason={listed.value.handlingText} />

          <Section title="新しい鍵を発行する">
            <Prose>
              Claude Code に未対応の要望を取りに来てもらう場合だけ発行してください。
              人がコピーして渡すだけなら、鍵は要りません。
            </Prose>
            <IssueIntegrationAccessForm />
          </Section>

          <Section title="いまある鍵">
            {listed.value.rows.length === 0 ? (
              <EmptyView
                title="まだ鍵はありません"
                body={listed.value.emptyReason ?? "取りに来てもらう場合だけ発行してください。"}
                action={<TextLink href="/admin/feedback">改善要望の一覧へ</TextLink>}
              />
            ) : (
              <>
                <DataTable
                  caption="鍵の値そのものは、発行したときの 1 回しか出ません。ここには残っていません。"
                  columns={[
                    { key: "label", label: "名前" },
                    { key: "scope", label: "できること" },
                    { key: "created", label: "発行した日" },
                    { key: "used", label: "最後に使った日" },
                    { key: "rate", label: "1 分あたりの上限", numeric: true },
                    { key: "state", label: "状態" },
                  ]}
                  rows={listed.value.rows.map((k) => ({
                    key: k.id,
                    cells: [
                      k.label,
                      k.scopeLabels.join("・"),
                      k.createdAt.toLocaleDateString("ja-JP"),
                      k.lastUsedAt === null
                        ? k.lastUsedText
                        : k.lastUsedAt.toLocaleString("ja-JP"),
                      `${k.rateLimitPerMinute}回`,
                      k.revoked ? "失効済み" : "使えます",
                    ],
                  }))}
                />

                <Stack>
                  {listed.value.rows
                    .filter((k) => !k.revoked)
                    .map((k) => (
                      <RevokeIntegrationAccessForm key={`revoke-${k.id}`} id={k.id} label={k.label} />
                    ))}
                </Stack>
                <Note>
                  失効させても一覧からは消えません。消すと、渡した記録の「どの鍵で」が
                  名前の無い番号だけになり、後からたどれなくなるためです。
                </Note>
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
