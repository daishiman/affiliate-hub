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
export default async function RankingsPage() {
  const actor = await currentActor();
  const target = rankingScreenTarget();
  const result = await invokeTool(rankingTool(), actor, target);

  return (
    <AdminShell
      routeId="rankings"
      title="順位"
      lead="どの商品が上に来たか。"
      actions={<TextLink href="/admin">ホームへ戻る</TextLink>}
    >
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
                      {productDisplayName(row.productId)}
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
                  label: productDisplayName(row.productId),
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
