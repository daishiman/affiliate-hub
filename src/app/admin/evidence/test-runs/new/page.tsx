import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateTestRunForm } from "@/presentation/admin/test-run-form";
import {
  currentActor,
  productUseCases,
  rankingCriteriaOptions,
} from "@/presentation/composition";
import { Callout, EmptyView, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 検証記録を登録する画面。
 *
 * **「実際に使ってみました」と書けるかどうかは、ここに記録があるかで決まる。**
 * 記録が無いのに一人称の体験として書くと、公開前の判定で止まる。
 * 止まるのは正しいが、そこまで書いた文章が丸ごと無駄になるので、
 * 測ったその日にここへ入れておく。
 */
export default async function NewTestRunPage() {
  const actor = await currentActor();
  const products = await (await productUseCases()).filterProducts.execute(actor, { limit: 50 });

  return (
    <AdminShell
      routeId="evidence/test-runs/new"
      title="検証記録を登録する"
      lead="いつ・誰が・どの方法で測ったかを残します。"
      actions={
        <>
          <TextLink href="/admin/evidence/new">根拠を登録する</TextLink>
          <TextLink href="/admin/evidence">根拠へ戻る</TextLink>
        </>
      }
    >
      {!products.ok ? (
        <ErrorView
          title="商品の一覧を読み出せませんでした"
          body={products.error.message}
          suggestedAction={
            products.error.suggestedAction ?? "商品を扱える権限を持つ担当者に頼んでください。"
          }
          action={<TextLink href="/admin/evidence">根拠へ戻る</TextLink>}
        />
      ) : products.value.items.length === 0 ? (
        <Section title="検証記録を登録する">
          <EmptyView
            title="測る相手がいません"
            body="検証記録は商品にひもづきます。先に商品を登録してください。"
            action={<TextLink href="/admin/products/new">商品を登録する</TextLink>}
          />
        </Section>
      ) : (
        <>
          <Callout
            tone="info"
            title="測り方を変えたら、版を上げてください"
            reason="版を据え置くと、違う方法で出た数字が同じ列に並びます。良くなったのが方法の違いなのか実際の差なのか、後から分けられなくなります。"
          />

          <Section
            title="この測定のこと"
            lead="登録すると番号が出ます。点を入れる画面では、その番号を根拠として書きます。"
          >
            <CreateTestRunForm
              products={products.value.items.map((p) => ({
                value: p.productId,
                label: `${p.brand} ${p.name}`.trim(),
              }))}
              criteria={rankingCriteriaOptions()}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
