import { AdminShell } from "@/presentation/admin/admin-shell";
import { SaveAffiliateProgramForm } from "@/presentation/admin/affiliate-program-form";
import { affiliateUseCases, currentActor } from "@/presentation/composition";
import { Callout, EmptyView, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 提携条件を登録する画面。
 *
 * 提携条件は「この広告主を、いくらで、どう書けば紹介できるか」。
 * これが無いと、成果が入ってきても何％の話なのか確かめられない。
 *
 * 提携先を先に読むのは、**1 件も無い状態でこの欄を出さない**ため。
 * 選べない選択肢の前で悩ませるより、先に提携先を作りに行かせる。
 */
export default async function NewAffiliateProgramPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly account?: string }>;
}) {
  const { account } = await searchParams;
  const actor = await currentActor();
  const accounts = await (await affiliateUseCases()).listAccounts.execute(actor, {});

  return (
    <AdminShell
      routeId="affiliate/programs/new"
      title="提携条件を登録する"
      lead="どの広告主を、いくらで紹介できるかを 1 つ登録します。"
      actions={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
    >
      {!accounts.ok ? (
        <ErrorView
          title="提携先の一覧を読み出せませんでした"
          body={accounts.error.message}
          suggestedAction={accounts.error.suggestedAction ?? null}
          action={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
        />
      ) : accounts.value.total === 0 ? (
        <EmptyView
          title="先に提携先を登録してください"
          body="提携条件は、どの提携先の下にぶら下がるかが決まっていないと登録できません。"
          action={<TextLink href="/admin/affiliate/accounts/new">提携先を登録する</TextLink>}
        />
      ) : (
        <>
          <Callout
            tone="info"
            title="ここに入れた報酬額は、記事の順位に入りません"
            reason="報酬の額を順位づけの計算へ渡せないよう、プログラムの作りとして止めています。渡そうとすると組み上がりません。"
          />

          <Section title="この提携のこと">
            <SaveAffiliateProgramForm
              accountOptions={accounts.value.items.map((a) => ({
                value: a.accountId,
                label: `${a.label}（${a.aspLabel}）`,
              }))}
              defaultAccountId={account}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
