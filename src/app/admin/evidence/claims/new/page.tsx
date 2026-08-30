import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateClaimForm } from "@/presentation/admin/claim-form";
import { claimTypeOptions, currentActor, productUseCases } from "@/presentation/composition";
import { Callout, EmptyView, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 言えることを登録する画面。
 *
 * 「言えること」は記事に書く 1 文そのもの。商品にひもづくので、
 * **商品が 1 件も無いうちはこの画面を使えない。**
 * 使えない状態で欄だけ出すと、書き終えてから保存で断られる。
 */
export default async function NewClaimPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    /** 直前に登録した根拠の番号。欄に先に入れておく。 */
    readonly evidence?: string;
  }>;
}) {
  const { evidence: initialEvidenceId } = await searchParams;
  const actor = await currentActor();
  const products = await (await productUseCases()).filterProducts.execute(actor, { limit: 50 });

  return (
    <AdminShell
      routeId="evidence/claims/new"
      title="言えることを登録する"
      lead="商品について記事に書ける 1 文と、その裏付けを結び付けます。"
      actions={
        <>
          <TextLink href="/admin/evidence/new">根拠を登録する</TextLink>
          <TextLink href="/admin/evidence">根拠へ戻る</TextLink>
        </>
      }
    >
      {!products.ok ? (
        /*
         * 「読めなかった」と「1 件も無い」を分ける（`rankings/scores` と同じ理由）。
         * 権限が足りない人へ「商品を登録してください」と出すと、
         * 登録しようとして、また断られる。誰に頼めばよいかを先に書く。
         */
        <ErrorView
          title="商品の一覧を読み出せませんでした"
          body={products.error.message}
          suggestedAction={
            products.error.suggestedAction ?? "商品を扱える権限を持つ担当者に頼んでください。"
          }
          action={<TextLink href="/admin/evidence">根拠へ戻る</TextLink>}
        />
      ) : products.value.items.length === 0 ? (
        <Section title="言えることを登録する">
          <EmptyView
            title="対象になる商品がありません"
            body="言えることは商品にひもづきます。先に商品を登録してください。"
            action={<TextLink href="/admin/products/new">商品を登録する</TextLink>}
          />
        </Section>
      ) : (
        <>
          <Callout
            tone="info"
            title="登録した直後は、まだ記事に使えません"
            reason="確かめる人が承認するまでは「確認待ち」のままです。書いた人がそのまま公開できると、確かめる工程が省ける道ができます。"
          />

          <Section
            title="この 1 文のこと"
            lead="公式・測定・体験・外部の評価は「事実」として扱うので、根拠の番号が 1 つ以上要ります。"
          >
            <CreateClaimForm
              types={claimTypeOptions().map((t) => ({ value: t.key, label: t.label }))}
              products={products.value.items.map((p) => ({
                value: p.productId,
                label: `${p.brand} ${p.name}`.trim(),
              }))}
              initialEvidenceId={initialEvidenceId ?? ""}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
