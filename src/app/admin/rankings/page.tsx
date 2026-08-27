import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  currentActor,
  productDisplayName,
  rankingScreenTarget,
  rankingTool,
} from "@/presentation/composition";
import { invokeTool } from "@/presentation/tools/tool-definition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  ListView,
  Section,
  TextLink,
} from "@/presentation/ui";
import { criterionLabel, formatPercent, formatScore, formatTestedAt } from "./criterion-view";

export const dynamic = "force-dynamic";

/**
 * 順位の画面。
 *
 * 評価基準の説明は `/admin/rankings/criteria` へ移出した。
 * 並んだ結果を見に来た人と、測り方を確かめに来た人は別人である。
 *
 * **AI 用の操作と同じ入口を通している。**
 * この画面は `rank_products` をそのまま呼ぶ。
 * 画面用に別の計算を書くと、画面と AI の答えがずれる
 * （仕様が禁じている「WebMCP 内に独自のランキング式を実装」と同じ壊れ方）。
 */
export default async function RankingsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    /** どの評価基準で並べるか。省くと一覧の先頭（＝いちばん新しい版）。 */
    readonly model?: string;
  }>;
}) {
  const { model: requestedModel } = await searchParams;
  const actor = await currentActor();
  const target = await rankingScreenTarget(requestedModel);
  const result = await invokeTool(await rankingTool(), actor, {
    modelId: target.modelId,
    productIds: target.productIds,
  });

  /** 商品の名前。保存された商品の名前を優先し、無いものだけ見本の名前で補う。 */
  const nameOf = (productId: string): string =>
    target.productNames[productId] ?? productDisplayName(productId);

  return (
    <AdminShell
      routeId="rankings"
      title="順位"
      lead="どの商品が上に来たか。"
      actions={
        <>
          <TextLink href="/admin/rankings/models">評価基準を管理する</TextLink>
          <TextLink href="/admin/rankings/scores">点を入れる</TextLink>
          <TextLink href="/admin">ホームへ戻る</TextLink>
        </>
      }
    >
      {target.emptyReason !== null ? (
        <Callout
          tone="warn"
          title="表示している中身について"
          reason={target.emptyReason}
          action={<TextLink href="/admin/rankings/models/new">評価基準を作る</TextLink>}
        />
      ) : null}

      {/* 基準が 1 つしか無いうちは切り替え欄を出さない。選べない選択肢は迷いにしかならない。 */}
      {target.models.length < 2 ? null : (
        <Section title="どの基準で並べるか" lead="版を上げると、同じ商品でも並びが変わります。">
          <ListView
            rows={target.models.map((m) => ({
              key: m.modelId,
              label: m.label,
              // いま見ている行はリンクにしない。押しても何も起きない行を残すと、
              // 押した人は「切り替えに失敗した」と受け取る。
              href:
                m.modelId === target.modelId
                  ? undefined
                  : `/admin/rankings?model=${encodeURIComponent(m.modelId)}`,
              note: m.modelId === target.modelId ? "いま見ています" : undefined,
            }))}
          />
        </Section>
      )}

      {!result.ok ? (
        <ErrorView
          title="順位を出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <Callout
            tone="info"
            title="順位の決め方"
            reason="報酬額・広告主の予算・販売実績は、順位の計算に入れていません（入れられない作りです）。"
            action={<TextLink href="/admin/rankings/criteria">評価基準を見る</TextLink>}
          />

          <Section
            title="順位"
            lead={`${result.value.audience}向け・評価方法 ${result.value.modelVersion}`}
          >
            {result.value.ranked.length === 0 ? (
              <EmptyView
                title="順位に載る商品がありません"
                body="すべての商品が合格ラインを下回りました。評価の記録か合格ラインを見直してください。"
              />
            ) : (
              <DataTable
                caption={`${result.value.audience}向けの順位`}
                columns={[
                  { key: "rank", label: "順位", numeric: true },
                  { key: "product", label: "商品" },
                  { key: "score", label: "総合点", numeric: true },
                  { key: "tested", label: "最後に検証した日" },
                ]}
                rows={result.value.ranked.map((row) => ({
                  key: row.productId,
                  cells: [
                    row.rank,
                    <>
                      {nameOf(row.productId)}
                      {/* 内訳を隠さない。総合点だけでは、どこで差が付いたか読めない。 */}
                      <ListView
                        rows={row.breakdown.map((b) => ({
                          key: b.key,
                          label: `${criterionLabel(b.key)} ${formatScore(b.rawScore)}（重み ${formatPercent(b.weight)}）`,
                        }))}
                      />
                    </>,
                    formatScore(row.totalScore),
                    formatTestedAt(row.testedAt),
                  ],
                }))}
              />
            )}
          </Section>

          <Section title="選外になった商品">
            {result.value.excluded.length === 0 ? (
              <EmptyView
                title="選外はありません"
                body="すべての商品が合格ラインを満たしています。"
              />
            ) : (
              <ListView
                rows={result.value.excluded.map((row) => ({
                  key: row.productId,
                  label: nameOf(row.productId),
                  note: row.reason,
                }))}
              />
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
