import { AdminShell } from "@/presentation/admin/admin-shell";
import { SaveScoreCardForm } from "@/presentation/admin/score-card-form";
import { currentActor, productUseCases, rankingUseCases } from "@/presentation/composition";
import { EmptyView, ErrorView, ListView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 商品に点を入れる画面。
 *
 * **基準を選んでから点を入れる順にしている。** 逆にすると、打ち終えてから
 * 「どの測り方の点か」を聞くことになり、選び間違えた人は 7 項目を打ち直す。
 *
 * 出す指標はその基準が使うものだけ。許可された 7 つを常に出すと、
 * 基準が使わない項目にも点を打たせることになり、保存時に黙って捨てられる。
 */
export default async function RankingScoresPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    /** どの基準の点を入れるか。省くと一覧の先頭（＝いちばん新しい版）。 */
    readonly model?: string;
  }>;
}) {
  const { model: requestedModel } = await searchParams;
  const actor = await currentActor();
  const [models, products] = await Promise.all([
    (await rankingUseCases()).listModels.execute(actor, {}),
    (await productUseCases()).filterProducts.execute(actor, { limit: 50 }),
  ]);

  const items = models.ok ? models.value.items : [];
  // 知らない基準 ID を渡されたら断らずに先頭へ落とす。URL を手で触った人が
  // 「画面が出ない」ではなく「別の基準が選ばれている」で気づけるほうが早い。
  const selected = items.find((m) => m.modelId === requestedModel) ?? items[0] ?? null;

  return (
    <AdminShell
      routeId="rankings/scores"
      title="点を入れる"
      lead="決めた基準で、商品 1 つずつを測った結果を記録します。"
      actions={
        <>
          <TextLink href="/admin/rankings/models">基準の一覧へ</TextLink>
          <TextLink href="/admin/rankings">順位へ戻る</TextLink>
        </>
      }
    >
      {!models.ok ? (
        <ErrorView
          title="評価基準を読み出せませんでした"
          body={models.error.message}
          suggestedAction={models.error.suggestedAction ?? null}
          action={<TextLink href="/admin/rankings">順位へ戻る</TextLink>}
        />
      ) : selected === null ? (
        <Section title="点を入れる">
          <EmptyView
            title="先に基準を決めます"
            body="どの項目をどれだけ重く見るかが決まっていないと、点を入れても順位は出ません。"
            action={<TextLink href="/admin/rankings/models/new">基準を作る</TextLink>}
          />
        </Section>
      ) : !products.ok ? (
        /*
         * 「読めなかった」と「1 件も無い」を分ける。
         * 権限が足りない人へ「商品を登録してください」と出すと、
         * 登録しようとして、また断られる。誰に頼めばよいかを先に書く。
         */
        <ErrorView
          title="点を付ける商品の一覧を読み出せませんでした"
          body={products.error.message}
          suggestedAction={
            products.error.suggestedAction ??
            "商品を扱える権限を持つ担当者に頼んでください。"
          }
          action={<TextLink href="/admin/rankings">順位へ戻る</TextLink>}
        />
      ) : products.value.items.length === 0 ? (
        <Section title="点を入れる">
          <EmptyView
            title="点を付ける商品がありません"
            body="先に商品を登録してください。点だけ入れても、順位に並ぶ相手がいません。"
            action={<TextLink href="/admin/products/new">商品を登録する</TextLink>}
          />
        </Section>
      ) : (
        <>
          {/* 基準が 1 つしか無いうちは切り替え欄を出さない。 */}
          {items.length < 2 ? null : (
            <Section title="どの基準で測った点か">
              <ListView
                rows={items.map((m) => ({
                  key: m.modelId,
                  label: `${m.audience}向け・${m.version}`,
                  href:
                    m.modelId === selected.modelId
                      ? undefined
                      : `/admin/rankings/scores?model=${encodeURIComponent(m.modelId)}`,
                  note: m.modelId === selected.modelId ? "いま選んでいます" : undefined,
                }))}
              />
            </Section>
          )}

          <Section
            title={`「${selected.audience}向け・${selected.version}」で測った点`}
            lead="同じ商品でも、基準の版が違えば別の点として残ります。前の版の順位は消えません。"
          >
            <SaveScoreCardForm
              modelId={selected.modelId}
              modelLabel={`${selected.audience}向け・${selected.version}`}
              criteria={selected.criteria.map((c) => ({ key: String(c.key), label: c.label }))}
              products={products.value.items.map((p) => ({
                value: p.productId,
                label: `${p.brand} ${p.name}`.trim(),
              }))}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
