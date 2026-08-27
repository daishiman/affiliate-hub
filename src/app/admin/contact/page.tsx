import { AdminShell } from "@/presentation/admin/admin-shell";
import { ContactHandledForm } from "@/presentation/admin/contact-forms";
import { contactUseCases, currentActor } from "@/presentation/composition";
import {
  Callout,
  EmptyView,
  ErrorView,
  FactList,
  Note,
  SeeAlso,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 読者から届いた問い合わせ。
 *
 * --- なぜ「使い勝手を直す」と別の画面なのか ---
 * あちらは画面の右下から届く社内向けの要望で、返事をする相手がいない。
 * こちらは**外の人が待っている**。同じ一覧に混ぜると、返事の要るものが
 * 社内の作業に埋もれる。埋もれた問い合わせは、返事をしなかったのと同じになる。
 *
 * --- 既定で未対応だけを出す ---
 * 済んだものが常に視界にあると、残りが何件かを毎回数え直すことになる。
 * ただし「対応済みも見る」は必ず用意する。消していないことを確かめられないと、
 * 印を付けるのが怖くなる。
 *
 * --- メールは出していない ---
 * 通知には Turnstile の鍵と送信元アドレスの登録（利用者本人の作業）が要る。
 * **届いていることに気づく道がここしか無い**ので、その旨を画面に書いておく。
 */
export default async function ContactPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const includeHandled = params.handled === "yes";

  const actor = await currentActor();
  const listed = await (await contactUseCases()).list.execute(actor, { includeHandled });

  return (
    <AdminShell
      routeId="contact"
      title="読者からの問い合わせ"
      lead="ブログの「お問い合わせ」から届いた内容を読み、対応の済んだものに印を付けます。"
      actions={<TextLink href="/admin">ホームへ戻る</TextLink>}
    >
      {!listed.ok ? (
        <ErrorView
          title="問い合わせの一覧を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <Callout
            tone="warn"
            title="届いてもメールは飛びません"
            reason="送信元メールアドレスと自動送信よけ (Turnstile) の登録がまだです。届いたことに気づけるのは、いまのところこの画面だけです。"
          />

          <Section title="いまの状況">
            <FactList
              rows={[
                { key: "unhandled", label: "未対応", value: `${listed.value.unhandledCount}件` },
                { key: "total", label: "届いた合計", value: `${listed.value.totalCount}件` },
              ]}
            />
            <Note>
              この件数は絞り込みの影響を受けません。届いた合計は、対応済みのものも数えた数です。
            </Note>
          </Section>

          <Section title={includeHandled ? "届いた問い合わせ（すべて）" : "未対応の問い合わせ"}>
            <SeeAlso>
              {includeHandled ? (
                <TextLink href="/admin/contact">未対応だけ見る</TextLink>
              ) : (
                <TextLink href="/admin/contact?handled=yes">
                  対応済みも見る（消していません）
                </TextLink>
              )}
            </SeeAlso>

            {listed.value.rows.length === 0 ? (
              <EmptyView
                title="出せるものがありません"
                body={listed.value.emptyReason ?? "まだ問い合わせは届いていません。"}
                action={
                  includeHandled ? (
                    <TextLink href="/admin/contact">未対応だけ見る</TextLink>
                  ) : (
                    <TextLink href="/admin/contact?handled=yes">対応済みも見る</TextLink>
                  )
                }
              />
            ) : (
              listed.value.rows.map((row) => (
                <SubSection
                  key={row.id}
                  title={`${row.siteSlug}｜${row.summary}`}
                >
                  <FactList
                    rows={[
                      { key: "received", label: "届いた日時", value: row.receivedAt },
                      {
                        key: "replyTo",
                        label: "返信先",
                        // 「—」は「無い」ではなく「書かれていない」。返せない相手だと分かる形で出す。
                        value: row.replyTo ?? "書かれていません（返信できません）",
                      },
                      {
                        key: "handled",
                        label: "対応",
                        value: row.handledAt === null ? "まだ" : `済み（${row.handledAt}）`,
                      },
                    ]}
                  />
                  {/*
                    本文は抜粋ではなく全文を出す。抜粋だけの一覧は、
                    結局 1 件ずつ開くことになり、開かれなかったものが残る。
                  */}
                  <p style={{ whiteSpace: "pre-wrap" }}>{row.body}</p>
                  <ContactHandledForm id={row.id} handled={row.handled} />
                </SubSection>
              ))
            )}
          </Section>

          <Note>
            ここに出る文章は読者が書いたものです。操作の記録（監査ログ）へは写していません。
          </Note>
        </>
      )}
    </AdminShell>
  );
}
