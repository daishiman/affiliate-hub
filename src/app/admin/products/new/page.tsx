import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateProductForm } from "@/presentation/admin/material/product-form";
import { Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 商品を 1 件登録する画面。
 *
 * 一覧の中に登録欄を混ぜていない。一覧は「あるものを探す」画面で、
 * ここは「無いものを足す」画面である。混ぜると、探しに来た人の目の前に
 * 常に空の入力欄が並ぶ。
 *
 * 実URLと脇の「商品」という現在地はroute metadataから別々に解決する。
 */
export default function NewProductPage() {
  return (
    <AdminShell
      routeId="products/new"
      title="商品を登録"
      lead="仕様と出どころを一緒に入れます。"
      actions={<TextLink href="/admin/products">商品の一覧へ戻る</TextLink>}
    >
      <Section title="登録する">
        <Prose>
          仕様と、その出どころを一緒に入れます。出どころの無い仕様は比較表に出せません。
        </Prose>
        <CreateProductForm />
      </Section>
    </AdminShell>
  );
}
