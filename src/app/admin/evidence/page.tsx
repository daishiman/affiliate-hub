import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, productSampleNotice, productUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  ClaimStatement,
  EmptyView,
  ErrorView,
  EvidenceList,
  Page,
  StubNotice,
  type EvidenceView,
} from "@/presentation/ui";
import styles from "../admin.module.css";
import { factualityOf, formatDate } from "../products/claim-view";

export const dynamic = "force-dynamic";

/**
 * 根拠の一覧。
 *
 * 商品ページは「1 商品について何が言えるか」を見る画面。
 * こちらは横断して**根拠が足りていない箇所をさがす**ための画面。
 * 記事を書く前にここを見て、根拠なしの主張を先に潰す。
 */
export default async function EvidencePage() {
  const actor = await currentActor();
  const uc = productUseCases();

  const listed = await uc.filterProducts.execute(actor, {});
  if (!listed.ok) {
    return (
      <Shell>
        <ErrorView
          title="根拠の一覧を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const products = listed.value.items;
  if (products.length === 0) {
    return (
      <Shell>
        <EmptyView
          title="商品がまだありません"
          body="根拠は商品にひもづきます。先に商品を登録してください。"
          action={<Link href="/admin/products">商品の一覧へ</Link>}
        />
      </Shell>
    );
  }

  const perProduct = await Promise.all(
    products.map(async (p) => ({
      product: p,
      result: await uc.getEvidence.execute(actor, { productId: p.productId }),
    })),
  );

  // 根拠が 1 件も付いていない主張の数。ここが 0 になるまで記事にしない。
  const unsupported = perProduct.reduce((sum, { result }) => {
    if (!result.ok) return sum;
    return sum + result.value.items.filter((i) => i.evidence.length === 0).length;
  }, 0);

  return (
    <Shell>
      <StubNotice
        what="根拠データの保存先"
        blockedBy="products / claims / evidence / test_runs テーブルの追加とマイグレーション"
        stubId="persistence:product-sample"
      >
        <span>{productSampleNotice()}</span>
      </StubNotice>

      <Callout
        tone={unsupported === 0 ? "info" : "warn"}
        title={unsupported === 0 ? "根拠のない内容はありません" : "根拠のない内容があります"}
        reason={
          unsupported === 0
            ? "登録されている内容には、すべて出所が付いています。"
            : `${unsupported}件に出所が付いていません。出所のない内容は記事に使えません。`
        }
        action={<Link href="/admin/products">商品ごとに確認する</Link>}
      />

      {perProduct.map(({ product, result }) => (
        <Card key={product.productId}>
          <h2 className={styles.sectionTitle}>
            <Link href={`/admin/products/${encodeURIComponent(product.productId)}`}>
              {product.brand} {product.name}
            </Link>
          </h2>

          {!result.ok ? (
            <ErrorView
              title="この商品の根拠を読み出せませんでした"
              body={result.error.message}
              suggestedAction={result.error.suggestedAction ?? null}
            />
          ) : result.value.items.length === 0 ? (
            <EmptyView
              title="登録された内容がありません"
              body={result.value.emptyReason ?? "この商品にはまだ何も登録されていません。"}
              action={
                <Link href={`/admin/products/${encodeURIComponent(product.productId)}`}>
                  商品ページを開く
                </Link>
              }
            />
          ) : (
            <div className={styles.catalogStack}>
              {result.value.items.map((item) => (
                <ClaimStatement
                  key={String(item.claim.id)}
                  kind={factualityOf(item.claim.type)}
                  statement={item.claim.statement}
                >
                  {item.expiredNote === null ? null : (
                    <Callout tone="warn" reason={item.expiredNote} />
                  )}
                  <EvidenceList
                    items={item.evidence.map(toEvidenceView)}
                    emptyAction={
                      <Link href={`/admin/products/${encodeURIComponent(product.productId)}`}>
                        商品ページで確認する
                      </Link>
                    }
                  />
                </ClaimStatement>
              ))}
            </div>
          )}
        </Card>
      ))}
    </Shell>
  );
}

function toEvidenceView(e: {
  readonly id: unknown;
  readonly title: string;
  readonly urlOrAssetId: string;
  readonly capturedAt: Date;
}): EvidenceView {
  return {
    id: String(e.id),
    sourceLabel: e.title,
    url: e.urlOrAssetId.startsWith("http") ? e.urlOrAssetId : undefined,
    checkedAt: formatDate(e.capturedAt),
  };
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/evidence"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "根拠" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="根拠"
        lead="登録されている内容と、その出所をまとめて確認します。出所のない内容をここで見つけます。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
