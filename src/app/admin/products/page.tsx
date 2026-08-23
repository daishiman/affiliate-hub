import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, productSampleNotice, productUseCases } from "@/presentation/composition";
import {
  Card,
  EmptyView,
  ErrorView,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StubNotice,
} from "@/presentation/ui";
import styles from "../admin.module.css";
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
  const params = await searchParams;
  const raw = params.q;
  const text = typeof raw === "string" ? raw : "";

  const actor = await currentActor();
  const result = await productUseCases().filterProducts.execute(actor, {
    text: text === "" ? undefined : text,
  });

  if (!result.ok) {
    return (
      <Shell text={text}>
        <ErrorView
          title="商品の一覧を出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const { items, emptyReason } = result.value;
  const compareHref = `/admin/products/compare?ids=${items.map((i) => encodeURIComponent(i.productId)).join(",")}`;

  return (
    <Shell text={text}>
      <StubNotice
        what="商品データの保存先"
        blockedBy="products / claims / evidence / test_runs テーブルの追加とマイグレーション"
        stubId="persistence:product-sample"
      >
        <span>{productSampleNotice()}</span>
      </StubNotice>

      <Card>
        <SectionHeading level={2}>商品</SectionHeading>
        <p className={styles.sectionLead}>
          {items.length === 0
            ? "条件に合う商品がありません。"
            : `${items.length}件を表示しています。商品名を選ぶと、仕様と根拠を確認できます。`}
        </p>

        {items.length === 0 ? (
          <EmptyView
            title="商品が見つかりませんでした"
            body={emptyReason ?? "条件を変えてもう一度おさがしください。"}
            action={<Link href="/admin/products">絞り込みを解除する</Link>}
          />
        ) : (
          <StackedList>
            {items.map((item) => (
              <StackedRow key={item.productId} note={item.oneLine}>
                <Link href={`/admin/products/${encodeURIComponent(item.productId)}`}>
                  {item.brand} {item.name}
                </Link>
                
              </StackedRow>
            ))}
          </StackedList>
        )}
      </Card>

      {items.length >= 2 ? (
        <Card>
          <SectionHeading level={2}>並べて比べる</SectionHeading>
          <p className={styles.sectionLead}>
            すべての商品で値がそろっている項目だけを列にします。そろっていない項目は「比べられない項目」として別に出します。
          </p>
          <Link href={compareHref}>いま表示している{items.length}件を比べる</Link>
        </Card>
      ) : null}
    </Shell>
  );
}

function Shell({ text, children }: { readonly text: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/products"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "商品" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="商品"
        lead="扱っている商品をさがし、仕様・根拠・検証記録を確かめます。"
      >
        <Card>
          <ProductSearchForm initialText={text} />
        </Card>
        {children}
      </Page>
    </AdminShell>
  );
}
