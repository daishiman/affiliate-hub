import { AdminShell } from "@/presentation/admin/admin-shell";
import { AffiliateLedger } from "@/presentation/admin/earn/affiliate-ledger";
import { affiliateUseCases, currentActor } from "@/presentation/composition";
import { Callout, EmptyView, ErrorView, TextLink } from "@/presentation/ui";

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
const LINK_STATES = ["usable", "expired", "disabled"] as const;

export default async function AffiliateLinksPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly state?: string;
    readonly provider?: string;
    readonly attention?: string;
  }>;
}) {
  const requested = await searchParams;
  const state = LINK_STATES.find((candidate) => candidate === requested.state) ?? null;
  const provider = requested.provider?.trim() || null;
  const attention = requested.attention === "yes" ? true : null;
  const actor = await currentActor();
  const links = await (await affiliateUseCases()).listLinks.execute(actor, {
    state,
    provider,
    attention,
  });

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
      ) : links.value.totalCount === 0 ? (
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

          <AffiliateLedger
            result={links.value}
            state={state}
            provider={provider}
            attention={attention}
          />
        </>
      )}
    </AdminShell>
  );
}
