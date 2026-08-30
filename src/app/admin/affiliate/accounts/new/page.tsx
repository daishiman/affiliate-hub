import { AdminShell } from "@/presentation/admin/admin-shell";
import { SaveAffiliateAccountForm } from "@/presentation/admin/affiliate-account-form";
import { affiliateAspOptions } from "@/presentation/composition";
import { Callout, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 提携先を登録する画面。
 *
 * 提携先が 1 件も無いと、提携条件も成果も置き場所が無い。
 * ここが収益側の一番はじめの入口になる。
 *
 * **鍵やパスワードはこの画面で扱わない。** 入れる欄を作らないことが、
 * 漏れないことの担保になる。登録は各サービスの画面でご自身で行うもの。
 */
export default async function NewAffiliateAccountPage() {
  return (
    <AdminShell
      routeId="affiliate/accounts/new"
      title="提携先を登録する"
      lead="どのサービスのどの ASP アカウントで提携しているかを 1 つ登録します。"
      actions={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
    >
      <Callout
        tone="warn"
        title="パスワードや API キーは入れないでください"
        reason="この画面にも保存先にも、鍵そのものを入れる場所がありません。書けるのは「鍵を置いた場所の名前」だけです。鍵の登録は、ご自身のブラウザで各サービスの画面から行ってください。"
      />

      <Section title="この提携先のこと">
        <SaveAffiliateAccountForm
          aspOptions={affiliateAspOptions().map((o) => ({ value: o.key, label: o.label }))}
        />
      </Section>
    </AdminShell>
  );
}
