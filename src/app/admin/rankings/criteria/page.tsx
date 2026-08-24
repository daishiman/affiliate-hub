import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, rankingScreenTarget, rankingTool } from "@/presentation/composition";
import { invokeTool } from "@/presentation/tools/tool-definition";
import { ErrorView, FactList, Note, Prose, Section, TextLink } from "@/presentation/ui";
import { criterionLabel, formatPercent } from "../criterion-view";

export const dynamic = "force-dynamic";

/**
 * 評価基準。
 *
 * `/admin/rankings` から移出した。並んだ結果を見に来た人と、
 * **なぜその測り方なのか**を確かめに来た人は別人で、後者は
 * 順位が変わっても同じ物を読みに来る。
 *
 * 順位と同じ道具（`rank_products`）を呼んでいるのは、基準の一覧を
 * ここで書き直さないため。書き直すと、重みを変えた日に
 * 「順位はこの重み、説明はあの重み」という状態が作れる。
 */
export default async function RankingCriteriaPage() {
  const actor = await currentActor();
  const result = await invokeTool(rankingTool(), actor, rankingScreenTarget());

  return (
    <AdminShell
      routeId="rankings/criteria"
      title="評価基準"
      lead="何をどう測って並べているか。"
      actions={<TextLink href="/admin/rankings">順位へ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="評価基準を出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/rankings">順位へ戻る</TextLink>}
        />
      ) : (
        <>
          <Section title="入れていないもの">
            <Prose>
              報酬額・広告主の予算・販売実績は、順位の計算に入れていません。
              入れ忘れているのではなく、入れられない作りにしてあります。
            </Prose>
          </Section>

          <Section
            title={`測り方（評価方法 ${result.value.modelVersion}）`}
            lead="読者に見せるものと同じ内容です。どう測ったかを隠しません。"
          >
            <FactList
              rows={result.value.criteriaDisclosure.map((c) => ({
                key: c.key,
                label: `${criterionLabel(c.key)}（重み ${formatPercent(c.weight)}）`,
                value: c.measurement,
              }))}
            />
            <Note>
              この基準で並べた結果は <TextLink href="/admin/rankings">順位</TextLink> にあります。
            </Note>
          </Section>
        </>
      )}
    </AdminShell>
  );
}
