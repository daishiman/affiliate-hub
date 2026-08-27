import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, productUseCases } from "@/presentation/composition";
import {
  Callout,
  ClaimStatement,
  EmptyView,
  ErrorView,
  EvidenceList,
  Note,
  Section,
  Stack,
  TextLink,
  type EvidenceView,
} from "@/presentation/ui";
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
  const uc = await productUseCases();
  const listed = await uc.filterProducts.execute(actor, {});

  return (
    <AdminShell
      routeId="evidence"
      title="根拠"
      lead="登録内容と、その出所を確かめます。"
      actions={
        <>
          {/*
            登録の入口を一覧の側に置く。ここは「足りない箇所をさがす」画面で、
            足りないと分かった直後に足せないと、探し直しから始めることになる。
          */}
          <TextLink href="/admin/evidence/new">根拠を登録する</TextLink>
          <TextLink href="/admin/evidence/claims/new">言えることを登録する</TextLink>
          <TextLink href="/admin/evidence/test-runs/new">検証記録を登録する</TextLink>
          <TextLink href="/admin">ホームへ戻る</TextLink>
        </>
      }
    >
      {!listed.ok ? (
        <ErrorView
          title="根拠の一覧を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : listed.value.items.length === 0 ? (
        <Section title="根拠">
          <EmptyView
            title="商品がまだありません"
            body="根拠は商品にひもづきます。先に商品を登録してください。"
            action={<TextLink href="/admin/products">商品の一覧へ</TextLink>}
          />
        </Section>
      ) : (
        <EvidenceOverview items={listed.value.items} />
      )}
    </AdminShell>
  );
}

type ProductRow = { readonly productId: string; readonly brand: string; readonly name: string };

/**
 * 商品ごとの根拠を読み出して並べる。
 *
 * 読み出しは商品の数だけ走るので、親ではなくここで待つ。
 * 親は「一覧を出せたか」だけを判断し、骨格と戻り先を先に描く。
 */
async function EvidenceOverview({ items }: { readonly items: readonly ProductRow[] }) {
  const actor = await currentActor();
  const uc = await productUseCases();

  const perProduct = await Promise.all(
    items.map(async (p) => ({
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
    <>
      <Callout
        tone={unsupported === 0 ? "info" : "warn"}
        title={unsupported === 0 ? "根拠のない内容はありません" : "根拠のない内容があります"}
        reason={
          unsupported === 0
            ? "登録されている内容には、すべて出所が付いています。"
            : `${unsupported}件に出所が付いていません。出所のない内容は記事に使えません。`
        }
        action={<TextLink href="/admin/products">商品ごとに確認する</TextLink>}
      />

      {perProduct.map(({ product, result }) => {
        const href = `/admin/products/${encodeURIComponent(product.productId)}`;
        return (
          <Section key={product.productId} title={`${product.brand} ${product.name}`}>
            {!result.ok ? (
              <ErrorView
                title="この商品の根拠を読み出せませんでした"
                body={result.error.message}
                suggestedAction={result.error.suggestedAction ?? null}
                action={<TextLink href={href}>商品ページを開く</TextLink>}
              />
            ) : result.value.items.length === 0 ? (
              <EmptyView
                title="登録された内容がありません"
                body={result.value.emptyReason ?? "この商品にはまだ何も登録されていません。"}
                action={<TextLink href={href}>商品ページを開く</TextLink>}
              />
            ) : (
              <Stack>
                <TextLink href={href}>この商品のページを開く</TextLink>
                {result.value.items.map((item) => (
                  <ClaimStatement
                    key={String(item.claim.id)}
                    kind={factualityOf(item.claim.type)}
                    statement={item.claim.statement}
                  >
                    {/*
                      期限切れの但し書きは `Callout` を重ねない。件数が読めなくなり、
                      画面が注意書きだらけになる。根拠の並びの手前に 1 行で添える。
                    */}
                    {item.expiredNote === null ? null : <Note>{item.expiredNote}</Note>}
                    <EvidenceList
                      items={item.evidence.map(toEvidenceView)}
                      emptyAction={<TextLink href={href}>商品ページで確認する</TextLink>}
                    />
                  </ClaimStatement>
                ))}
              </Stack>
            )}
          </Section>
        );
      })}
    </>
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
