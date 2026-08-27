import { AdminShell } from "@/presentation/admin/admin-shell";
import { DeleteConfirm } from "@/presentation/admin/delete-confirm";
import { disableAffiliateLinkAction } from "@/presentation/admin/delete-form-action";
import { affiliateUseCases, currentActor } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Note,
  Prose,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 登録した成果リンクの一覧と、止める操作。
 *
 * --- なぜ「直す」ボタンが無いのか ---
 *
 * 商品名も ASP の URL も**登録した日の写し**で、上書きしない決まりにしてある
 * （`docs/product/design-decisions.md` §2）。上書きを許すと、読者が実際に見た
 * 表記がその日から誰にも分からなくなる。「この説明だったから買った」と
 * 言われたときに何が書いてあったかを示せるのは、古い行がそのまま残っている
 * 場合だけである。
 *
 * だから直し方は **止める → 受信箱から新しく登録し直す** の 2 手になる。
 * この画面はその 1 手目を持つ。2026-08-26 まで 1 手目が存在せず、
 * ASP 側で商品名が変わっても、読者のカードには古い名前が出続けていた。
 *
 * --- 商品名を大きく出す理由 ---
 *
 * 止める判断は「ASP の管理画面に出ている名前」と「読者に出ている名前」を
 * 見比べて行う。読者に出ている名前が画面に無いと、識別子を頼りに ASP と
 * 往復することになり、**別のリンクを止める**事故が起きる。
 *
 * --- URL の接続先しか出さない理由 ---
 *
 * ASP が発行した URL には成果の割り当て先が入っている。画面に丸ごと出すと、
 * 見せた相手にそのまま成果を横取りされる形の文字列を配ることになる。
 * どの提携先へ飛ぶかの判断には接続先（ドメイン）だけで足りる。
 */
export default async function AffiliateLinksPage() {
  const actor = await currentActor();
  const links = await (await affiliateUseCases()).listLinks.execute(actor, {});

  return (
    <AdminShell
      routeId="affiliate/links"
      title="登録したリンク"
      lead="読者に出ているリンクを見て、表記が古くなったものを止めます。"
      actions={
        <>
          <TextLink href="/admin/inbox">受信箱から登録する</TextLink>
          <TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>
        </>
      }
    >
      {!links.ok ? (
        <ErrorView
          title="登録したリンクを出せませんでした"
          body={links.error.message}
          suggestedAction={links.error.suggestedAction ?? null}
          action={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
        />
      ) : links.value.rows.length === 0 ? (
        <EmptyView
          title="登録したリンクがありません"
          body="受信箱に届いた URL を広告主と商品まで決めると、ここに並びます。記事に成果リンクが出るのはそのあとです。"
          action={<TextLink href="/admin/inbox">受信箱を開く</TextLink>}
        />
      ) : (
        <>
          <Callout
            tone="info"
            title="直すのではなく、止めて登録し直します"
            reason="商品名も URL も登録した日の写しです。上書きすると、読者が実際に見た表記が後から分からなくなり、「この説明だったから買った」に答えられなくなります。"
          />

          <Section title="いま読者に出ているもの">
            <Prose>
              {links.value.usableCount === 0
                ? "読者に出ているリンクが 1 件もありません。記事に成果リンクは表示されていません。"
                : `${links.value.usableCount}件が読者に出ています。ASP の管理画面に出ている商品名と見比べてください。`}
            </Prose>
            <DataTable
              caption="登録してある成果リンクと、いまの状態"
              columns={[
                { key: "product", label: "読者に出ている名前" },
                { key: "brand", label: "作り手" },
                { key: "host", label: "接続先" },
                { key: "registered", label: "登録した日" },
                { key: "state", label: "いまの状態" },
              ]}
              rows={links.value.rows.map((row) => ({
                key: row.affiliateLinkId,
                cells: [
                  row.productName,
                  row.brand ?? "—",
                  row.host,
                  row.registeredAt,
                  row.stateLabel,
                ],
              }))}
            />
            <Note>
              リンクの全体（ASP が発行した URL）は出しません。成果の割り当て先が入っているためです。
            </Note>
          </Section>

          <Section title="止める">
            {links.value.rows.filter((row) => row.canDisable).length === 0 ? (
              <Note>止められるリンクはありません。すべて止め終わっています。</Note>
            ) : (
              links.value.rows
                .filter((row) => row.canDisable)
                .map((row) => (
                  <SubSection
                    key={row.affiliateLinkId}
                    title={`${row.productName}（${row.stateLabel}）`}
                  >
                    {row.oneLine === null ? null : <Prose>{row.oneLine}</Prose>}
                    <DeleteConfirm
                      action={disableAffiliateLinkAction}
                      toolName="affiliate_link_disable"
                      toolDescription="登録済みの成果リンクを止める。記事に貼ったままでも、公開のときに読者へ出なくなる。"
                      idName="affiliateLinkId"
                      idValue={row.affiliateLinkId}
                      label={row.productName}
                      verb="止める"
                      consequence="記事に貼ったままでも、公開のときに読者へ出なくなります。行は消えないので、いつまで出ていたかは後から辿れます。止めたリンクは元へ戻せません。表記を直すときは、受信箱から新しいリンクとして登録し直してください。"
                      acknowledgement="止めたら元へ戻せないことを確かめました"
                    />
                  </SubSection>
                ))
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
