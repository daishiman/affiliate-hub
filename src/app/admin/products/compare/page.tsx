import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, productSampleNotice, productUseCases } from "@/presentation/composition";
import {
  Callout,
  ComparisonTable,
  EmptyView,
  ErrorView,
  ListView,
  Section,
  StubNotice,
  TextLink,
  type ComparisonCell,
  type ComparisonColumn,
  type ComparisonRow,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 並べて比べる画面。
 *
 * **そろっていない項目を空欄で出さない。**
 * 空欄にすると「その機能が無い」と読まれる。
 * 値を持っていないだけの項目は、表の外に「比べられない項目」として出す。
 * この判断はユースケース側（compare_products）が持っていて、
 * 画面はその結果をそのまま描くだけ。AI が同じ問いに答えたときも同じ扱いになる。
 */
export default async function CompareProductsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.ids;
  const ids = (typeof raw === "string" ? raw.split(",") : [])
    .map((s) => s.trim())
    .filter((s) => s !== "");

  return (
    <AdminShell
      routeId="products/compare"
      title="並べて比べる"
      lead="値がそろっている項目だけを表にします。"
      actions={<TextLink href="/admin/products">商品の一覧へ戻る</TextLink>}
    >
      {ids.length < 2 ? (
        <Section title="比較表">
          <EmptyView
            title="比べる商品が足りません"
            body="2件以上を選ぶと比較表を出せます。商品の一覧から選び直してください。"
            action={<TextLink href="/admin/products">商品の一覧へ</TextLink>}
          />
        </Section>
      ) : (
        <Comparison ids={ids} />
      )}
    </AdminShell>
  );
}

/**
 * 比較表の本体。
 *
 * 骨格から切り出しているのは、id が足りないときと読み出しに失敗したときで
 * 出す物が違うのに、パンくずと戻り先は同じだから。
 */
async function Comparison({ ids }: { readonly ids: readonly string[] }) {
  const actor = await currentActor();
  const uc = await productUseCases();
  const result = await uc.compareProducts.execute(actor, { productIds: [...ids] });

  if (!result.ok) {
    return (
      <ErrorView
        title="比較表を作れませんでした"
        body={result.error.message}
        suggestedAction={result.error.suggestedAction ?? null}
        action={<TextLink href="/admin/products">商品の一覧へ戻る</TextLink>}
      />
    );
  }

  const { products, columns, rows, missingColumns } = result.value;

  const tableColumns: readonly ComparisonColumn[] = columns.map((key) => ({ key, label: key }));
  const tableRows: readonly ComparisonRow[] = products.map((p, i) => {
    const cells: Record<string, ComparisonCell> = {};
    columns.forEach((key, c) => {
      const value = rows[i]?.[c] ?? null;
      if (value !== null) {
        // 仕様値はメーカー公表値。測った値ではないので「事実」として出す。
        cells[key] = { value, factuality: "fact" };
      }
    });
    return { id: p.productId, label: `${p.brand} ${p.name}`, cells };
  });

  return (
    <>
      <StubNotice
        what="商品データの保存先"
        blockedBy="products / claims / evidence / test_runs テーブルの追加とマイグレーション"
        stubId="persistence:product-sample"
      >
        {productSampleNotice()}
      </StubNotice>

      <Section
        title="比較表"
        lead={`${products.length}件を比べています。列にできたのは、全商品で値がそろっている${columns.length}項目です。`}
      >
        <ComparisonTable
          caption={`${products.map((p) => p.name).join(" / ")} の比較`}
          columns={tableColumns}
          rows={tableRows}
          emptyAction={<TextLink href="/admin/products">商品を選び直す</TextLink>}
        />
      </Section>

      {missingColumns.length > 0 ? (
        <Section title="比べられない項目">
          <Callout
            tone="warn"
            title="一部の商品にしか値がありません"
            reason={`${missingColumns.join(" / ")} は、値を持っていない商品があるため列にしていません。空欄で出すと「その機能が無い」と誤って伝わります。`}
            action={<TextLink href="/admin/products">商品ごとの仕様を見る</TextLink>}
          />
        </Section>
      ) : null}

      <Section title="比べている商品">
        <ListView
          rows={products.map((p) => ({
            key: p.productId,
            label: `${p.brand} ${p.name}`,
            href: `/admin/products/${encodeURIComponent(p.productId)}`,
            note: p.oneLine,
          }))}
        />
      </Section>
    </>
  );
}
