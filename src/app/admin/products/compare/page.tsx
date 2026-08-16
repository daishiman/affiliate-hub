import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, productSampleNotice, productUseCases } from "@/presentation/composition";
import {
  AppShell,
  Callout,
  Card,
  ComparisonTable,
  EmptyView,
  ErrorView,
  Page,
  StubNotice,
  type ComparisonCell,
  type ComparisonColumn,
  type ComparisonRow,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

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

  if (ids.length < 2) {
    return (
      <Shell>
        <EmptyView
          title="比べる商品が足りません"
          body="2件以上を選ぶと比較表を出せます。商品の一覧から選び直してください。"
          action={<Link href="/admin/products">商品の一覧へ</Link>}
        />
      </Shell>
    );
  }

  const actor = await currentActor();
  const result = await productUseCases().compareProducts.execute(actor, { productIds: ids });

  if (!result.ok) {
    return (
      <Shell>
        <ErrorView
          title="比較表を作れませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/products">商品の一覧へ戻る</Link>}
        />
      </Shell>
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
    <Shell>
      <StubNotice
        what="商品データの保存先"
        blockedBy="products / claims / evidence / test_runs テーブルの追加とマイグレーション"
        stubId="persistence:product-sample"
      >
        <span>{productSampleNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>比較表</h2>
        <p className={styles.sectionLead}>
          {products.length}件を比べています。列にできたのは、全商品で値がそろっている
          {columns.length}項目です。
        </p>
        <ComparisonTable
          caption={`${products.map((p) => p.name).join(" / ")} の比較`}
          columns={tableColumns}
          rows={tableRows}
          emptyAction={<Link href="/admin/products">商品を選び直す</Link>}
        />
      </Card>

      {missingColumns.length > 0 ? (
        <Card>
          <h2 className={styles.sectionTitle}>比べられない項目</h2>
          <Callout
            tone="warn"
            title="一部の商品にしか値がありません"
            reason={`${missingColumns.join(" / ")} は、値を持っていない商品があるため列にしていません。空欄で出すと「その機能が無い」と誤って伝わります。`}
            action={<Link href="/admin/products">商品ごとの仕様を見る</Link>}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className={styles.sectionTitle}>比べている商品</h2>
        <ul className={styles.linkList}>
          {products.map((p) => (
            <li key={p.productId}>
              <Link href={`/admin/products/${encodeURIComponent(p.productId)}`}>
                {p.brand} {p.name}
              </Link>
              <span className={styles.linkNote}>{p.oneLine}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AppShell
      currentPath="/admin/products"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "商品", href: "/admin/products" },
        { label: "並べて比べる" },
      ]}
      actions={<Link href="/admin/products">商品の一覧へ戻る</Link>}
    >
      <Page
        title="並べて比べる"
        lead="複数の商品を同じ項目でならべ、値がそろっているところだけを表にします。"
      >
        {children}
      </Page>
    </AppShell>
  );
}
