import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  adminOperation,
  adminOperationRouteId,
} from "@/presentation/admin/admin-operation-manifest";
import { currentActor, productSampleNotice, productUseCases } from "@/presentation/composition";
import {
  EmptyView,
  ErrorView,
  ListView,
  Prose,
  Section,
  StubNotice,
  TextLink,
} from "@/presentation/ui";
import { ProductSearchForm } from "./product-search-form";

export const dynamic = "force-dynamic";

/**
 * 商品の一覧。
 *
 * 画面が呼ぶのは `filter_products` と同じユースケース。
 * AI に「ノートPCを絞り込んで」と頼んだときの結果と、この画面の結果が必ず一致する。
 */
export default async function ProductsPage({
  searchParams,
}: {
  // Next.js 16 では searchParams は Promise。await せずに読むと undefined になる。
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const operation = adminOperation("product.list");
  const params = await searchParams;
  const raw = params.q;
  const text = typeof raw === "string" ? raw : "";

  const actor = await currentActor();
  const uc = await productUseCases();
  const result = await uc.filterProducts.execute(actor, {
    text: text === "" ? undefined : text,
  });

  const compareHref = result.ok
    ? `/admin/products/compare?ids=${result.value.items
        .map((i) => encodeURIComponent(i.productId))
        .join(",")}`
    : "/admin/products";

  return (
    <AdminShell
      routeId={adminOperationRouteId(operation)}
      title="商品"
      lead="仕様・根拠・検証記録を確かめます。"
      actions={<TextLink href="/admin/products/new">商品を登録する</TextLink>}
    >
      <Section title="さがす">
        <ProductSearchForm initialText={text} />
      </Section>

      {!result.ok ? (
        <ErrorView
          title="商品の一覧を出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StubNotice
            what="商品データの保存先"
            blockedBy="products / claims / evidence / test_runs テーブルの追加とマイグレーション"
            stubId="persistence:product-sample"
          >
            {productSampleNotice()}
          </StubNotice>

          <Section
            title="商品"
            lead={
              result.value.items.length === 0
                ? "条件に合う商品がありません。"
                : `${result.value.items.length}件を表示しています。商品名を選ぶと、仕様と根拠を確認できます。`
            }
          >
            {result.value.items.length === 0 ? (
              <EmptyView
                title="商品が見つかりませんでした"
                body={result.value.emptyReason ?? "条件を変えてもう一度おさがしください。"}
                action={<TextLink href="/admin/products">絞り込みを解除する</TextLink>}
              />
            ) : (
              <ListView
                rows={result.value.items.map((item) => ({
                  key: item.productId,
                  label: `${item.brand} ${item.name}`,
                  href: `/admin/products/${encodeURIComponent(item.productId)}`,
                  note: item.oneLine,
                }))}
              />
            )}
          </Section>

          {result.value.items.length >= 2 ? (
            <Section title="並べて比べる">
              <Prose>
                すべての商品で値がそろっている項目だけを列にします。そろっていない項目は「比べられない項目」として別に出します。
              </Prose>
              <TextLink href={compareHref}>
                いま表示している{result.value.items.length}件を比べる
              </TextLink>
            </Section>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
