import { AdminShell } from "@/presentation/admin/admin-shell";
import { UpdateProductForm } from "@/presentation/admin/product-form";
import { formatSpecifications } from "@/presentation/admin/product-form-state";
import { currentActor, productUseCases } from "@/presentation/composition";
import { ErrorView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 商品 1 件を直す画面。
 *
 * 詳細画面に編集欄を差し込んでいない。詳細は根拠と順位の理由を**読む**画面で、
 * 読んでいる途中に入力欄が挟まると、どこまでが今の値でどこからが下書きか
 * 見分けが付かなくなる。
 *
 * 初期値は保存されている値そのままを入れる。空欄で開いて
 * 「書いた欄だけ直る」形にすると、今なんと書いてあるかを確かめに
 * 別の画面へ戻ることになる。
 */
export default async function EditProductPage({
  params,
}: {
  readonly params: Promise<{ readonly product: string }>;
}) {
  const { product: productId } = await params;
  const actor = await currentActor();
  const uc = await productUseCases();
  const detail = await uc.getProduct.execute(actor, { productId });

  const label = detail.ok
    ? `${detail.value.product.brand} ${detail.value.product.name}`
    : "商品";

  return (
    <AdminShell
      routeId="products/[product]/edit"
      routeParams={{ product: productId }}
      breadcrumbLabels={{ "products/[product]": label }}
      title="商品を直す"
      lead="いま入っている値を書き換えます。"
      actions={<TextLink href="/admin/products">商品の一覧へ戻る</TextLink>}
    >
      {!detail.ok ? (
        <ErrorView
          title="この商品を編集できません"
          body={detail.error.message}
          suggestedAction={detail.error.suggestedAction ?? null}
          action={<TextLink href="/admin/products">商品の一覧へ戻る</TextLink>}
        />
      ) : (
        <Section title="内容を直す">
          <Prose>
            いま保存されている内容が入っています。直したところだけ書き換えてください。
          </Prose>
          <UpdateProductForm
            defaults={{
              productId,
              brand: detail.value.product.brand,
              name: detail.value.product.name,
              manufacturer: detail.value.product.manufacturer ?? "",
              description: detail.value.product.description ?? "",
              specifications: formatSpecifications(detail.value.product.specifications),
              officialUrl: detail.value.product.officialUrl ?? "",
            }}
          />
        </Section>
      )}
    </AdminShell>
  );
}
