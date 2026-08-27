import { AdminShell } from "@/presentation/admin/admin-shell";
import { adminOperation } from "@/presentation/admin/admin-operation-manifest";
import { DeleteConfirm } from "@/presentation/admin/delete-confirm";
import { deleteProductAction } from "@/presentation/admin/delete-form-action";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import {
  affiliateUseCases,
  currentActor,
  productSampleNotice,
  productUseCases,
  rankingScreenTarget,
} from "@/presentation/composition";
import {
  Callout,
  ClaimStatement,
  Code,
  DataTable,
  EmptyView,
  ErrorView,
  type EvidenceView,
  EvidenceList,
  FactList,
  ListView,
  Prose,
  Section,
  Stack,
  StubNotice,
  TextLink,
} from "@/presentation/ui";
import { factualityOf, formatDate } from "../claim-view";

export const dynamic = "force-dynamic";

/**
 * 商品 1 件の画面。
 *
 * 1 画面に 4 つの問いを並べている。
 *   1. どんな仕様か（get_product）
 *   2. 何が言えるか・その根拠は何か（get_evidence）
 *   3. 編集部は実際に測ったか（list_test_runs）
 *   4. なぜその順位なのか（explain_ranking）
 *   5. ほかに候補はあるか（find_alternatives）
 *
 * どれも AI 用の道具と**同じユースケース**を呼ぶ。
 * 画面側で計算し直すと、人が見る答えと AI が返す答えがずれる。
 */
export default async function ProductDetailPage({
  params,
}: {
  // Next.js 16 では params は Promise。
  readonly params: Promise<{ readonly product: string }>;
}) {
  const { product: productId } = await params;
  const actor = await currentActor();
  const uc = await productUseCases();

  const detail = await uc.getProduct.execute(actor, { productId });
  const title = detail.ok
    ? `${detail.value.product.brand} ${detail.value.product.name}`
    : "商品";

  return (
    <AdminShell
      routeId="products/[product]"
      routeParams={{ product: productId }}
      title={title}
      lead="仕様・根拠・検証記録と順位の理由。"
      actions={
        <TextLink href={`/admin/products/${encodeURIComponent(productId)}/edit`}>
          この商品を直す
        </TextLink>
      }
    >
      {!detail.ok ? (
        <ErrorView
          title="この商品を表示できませんでした"
          body={detail.error.message}
          suggestedAction={detail.error.suggestedAction ?? null}
          action={<TextLink href="/admin/products">商品の一覧へ戻る</TextLink>}
        />
      ) : (
        <ProductDetail productId={productId} detail={detail.value} />
      )}
    </AdminShell>
  );
}

type Detail = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof productUseCases>>["getProduct"]["execute"]>
>;

/**
 * 中身。骨格の外側（パンくず・戻り先）を 2 回書かないために分けている。
 *
 * 読み出しを 5 本まとめて待つのは、順に待つと 5 往復ぶんの間、
 * 画面が何も出ないため。互いに結果を必要としないので、順番に意味は無い。
 */
async function ProductDetail({
  productId,
  detail,
}: {
  readonly productId: string;
  readonly detail: Detail;
}) {
  const operation = adminOperation("product.delete");
  const { product, specifications, retrievedAt, validUntil } = detail;
  const actor = await currentActor();
  const uc = await productUseCases();
  // 順位の説明に要るのは「どの基準で・どの商品群の中で」の 2 つだけ。
  // 画面向けの付随情報（選択肢や表示名）はここへ渡さない。
  const { modelId, productIds } = await rankingScreenTarget();

  const [evidence, testRuns, alternatives, explained, links] = await Promise.all([
    uc.getEvidence.execute(actor, { productId }),
    uc.listTestRuns.execute(actor, { productId }),
    uc.findAlternatives.execute(actor, { productId }),
    uc.explainRanking.execute(actor, { modelId, productIds, productId }),
    // 提携リンクは商業の区分。上の順位の計算とは別のつなぎ目から取る。
    (await affiliateUseCases()).listProductLinks.execute(actor, { productId }),
  ]);

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
        title="仕様"
        lead={`${product.description ?? "説明はまだ登録されていません。"}（${formatDate(
          retrievedAt,
        )}時点の情報 / 有効期限: ${formatDate(validUntil)}）`}
      >
        {specifications.length === 0 ? (
          <EmptyView
            title="仕様がまだ登録されていません"
            body="仕様が無いと比較表の列を作れません。メーカー公式の値を登録してください。"
          />
        ) : (
          <FactList
            rows={specifications.map((s) => ({ key: s.key, label: s.key, value: s.value }))}
          />
        )}
      </Section>

      <Section
        title="この商品について言えること"
        lead="測った内容と、そこから導いた判断を分けて出します。判断には必ず印が付きます。"
      >
        {!evidence.ok ? (
          <ErrorView
            title="根拠を読み出せませんでした"
            body={evidence.error.message}
            suggestedAction={evidence.error.suggestedAction ?? null}
          />
        ) : evidence.value.items.length === 0 ? (
          <EmptyView
            title="登録された内容がありません"
            body={evidence.value.emptyReason ?? "この商品にはまだ何も登録されていません。"}
            action={<TextLink href="/admin/evidence">根拠の一覧を見る</TextLink>}
          />
        ) : (
          <Stack>
            {evidence.value.items.map((item) => (
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
                    <TextLink href="/admin/evidence">根拠を登録する画面へ</TextLink>
                  }
                />
              </ClaimStatement>
            ))}
          </Stack>
        )}
      </Section>

      <Section
        title="編集部の検証記録"
        lead="ここに記録がある項目だけ、記事で「実際に使ってみた」と書けます。"
      >
        {!testRuns.ok ? (
          <ErrorView
            title="検証記録を読み出せませんでした"
            body={testRuns.error.message}
            suggestedAction={testRuns.error.suggestedAction ?? null}
          />
        ) : testRuns.value.runs.length === 0 ? (
          <EmptyView
            title="検証記録がありません"
            body={testRuns.value.emptyReason ?? "この商品はまだ編集部で実測していません。"}
          />
        ) : (
          <ListView
            rows={testRuns.value.runs.map((run) => ({
              key: String(run.id),
              label: `測定方法 ${run.methodVersion}（${formatDate(run.completedAt)}）`,
              note: Object.entries(run.rawResults)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(" / "),
            }))}
          />
        )}
      </Section>

      <Section title="この順位になった理由">
        {!explained.ok ? (
          <ErrorView
            title="順位の理由を出せませんでした"
            body={explained.error.message}
            suggestedAction={explained.error.suggestedAction ?? null}
            action={<TextLink href="/admin/rankings">評価基準と順位を見る</TextLink>}
          />
        ) : explained.value.excludedReason !== null ? (
          <EmptyView
            title="この商品は順位に入っていません"
            body={explained.value.excludedReason}
            action={<TextLink href="/admin/rankings">評価基準を確認する</TextLink>}
          />
        ) : (
          <>
            <Prose>
              評価方法 {explained.value.modelVersion} で {explained.value.rank}位（総合{" "}
              {explained.value.totalScore.toFixed(2)}）。内訳は次のとおりです。
            </Prose>
            <DataTable
              caption="評価項目ごとの、測り方と重みと点数"
              columns={[
                { key: "criterion", label: "評価項目" },
                { key: "measurement", label: "どう測ったか" },
                { key: "weight", label: "重み", numeric: true },
                { key: "score", label: "点数", numeric: true },
                { key: "contribution", label: "総合への寄与", numeric: true },
              ]}
              rows={explained.value.contributions.map((c) => ({
                key: c.key,
                cells: [
                  c.key,
                  c.measurement,
                  `${Math.round(c.weight * 100)}%`,
                  c.score.toFixed(2),
                  c.contribution.toFixed(2),
                ],
              }))}
            />
          </>
        )}
      </Section>

      <Section
        title="この商品の提携リンク"
        lead="リンクは発行されたままの形で使います。計測用の印を足すと多くの提携先で規約違反になり、成果が付かなくなるためです。ここに出る内容は、上の順位の計算には一切入りません。"
      >
        {!links.ok ? (
          <ErrorView
            title="提携リンクを出せませんでした"
            body={links.error.message}
            suggestedAction={links.error.suggestedAction ?? null}
            action={<TextLink href="/admin/affiliate">提携と成果を見る</TextLink>}
          />
        ) : links.value.items.length === 0 ? (
          <EmptyView
            title="提携リンクがありません"
            body={links.value.emptyReason ?? "この商品につながる提携リンクはまだありません。"}
            action={<TextLink href="/admin/affiliate">提携と成果を見る</TextLink>}
          />
        ) : (
          <ListView
            rows={links.value.items.map((l) => ({
              key: l.linkId,
              label: <Code>{l.url}</Code>,
              note: `${l.usable ? "使えます" : (l.blockedReason ?? "使えません")}${
                l.alterationProhibited ? " / 改変禁止" : ""
              }`,
            }))}
          />
        )}
      </Section>

      <Section title="ほかの候補">
        {!alternatives.ok ? (
          <ErrorView
            title="ほかの候補を出せませんでした"
            body={alternatives.error.message}
            suggestedAction={alternatives.error.suggestedAction ?? null}
          />
        ) : alternatives.value.alternatives.length === 0 ? (
          <EmptyView
            title="ほかの候補がありません"
            body={alternatives.value.emptyReason ?? "同じ用途の商品がまだ登録されていません。"}
            action={<TextLink href="/admin/products">商品の一覧を見る</TextLink>}
          />
        ) : (
          <ListView
            rows={alternatives.value.alternatives.map((a) => ({
              key: a.productId,
              label: `${a.brand} ${a.name}`,
              href: `/admin/products/${encodeURIComponent(a.productId)}`,
              note: a.oneLine,
            }))}
          />
        )}
      </Section>

      <Section title="この商品を消す">
        <DeleteConfirm
          action={deleteProductAction}
          toolName={operation.tool}
          toolDescription="商品を消す（使っている記事が残っていれば断られる）"
          idName="productId"
          idValue={productId}
          label={`${product.brand} ${product.name}`}
          verb="消す"
          consequence="この商品を使っている記事が残っていれば断られます。消すと、順位表と比較表からこの商品の列が無くなります。集めた根拠も一緒に消えます。"
        />
      </Section>
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
    // 社内保管の資料（sample:// など）は開けないので、リンクにしない。
    // リンクにして開けない方が、無いことより分かりにくい。
    url: e.urlOrAssetId.startsWith("http") ? e.urlOrAssetId : undefined,
    checkedAt: formatDate(e.capturedAt),
  };
}
