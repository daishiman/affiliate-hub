import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, personaUseCases } from "@/presentation/composition";
import {
  EmptyView,
  ErrorView,
  FactList,
  Foldable,
  ListView,
  Note,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 読者像。
 *
 * `/admin/personas` から移出した。書き手と同じ画面に積んでいたが、
 * **決める順番も、決める人も違う**。書き手は「名乗れるか」の話で、
 * 読者像は「何を比べたいか」の話である。
 *
 * 「—」は未定であって該当なしではない、という断りをここでも繰り返す。
 * 移した先で落とすと、空欄が「調べた結果なにも無かった」と読まれる。
 */
export default async function AudiencePersonasPage() {
  const actor = await currentActor();
  const audiences = await (await personaUseCases()).listAudiences.execute(actor, {});

  return (
    <AdminShell
      routeId="personas/audiences"
      title="読者像"
      lead="誰に向けて書くかを決めます。"
      actions={
        <>
          <TextLink href="/admin/personas/audiences/new">読者像を作る</TextLink>
          <TextLink href="/admin/personas">書き手へ戻る</TextLink>
        </>
      }
    >
      {!audiences.ok ? (
        /*
          `Callout` ではなく `ErrorView` を使う。`Callout` は理由を 1 本しか持てず、
          「何が起きたか」か「次に何をするか」のどちらかしか出せない。
          読めなかった画面では、その 2 つは別々に要る。
        */
        <ErrorView
          title="読者像の一覧を出せませんでした"
          body={audiences.error.message}
          suggestedAction={audiences.error.suggestedAction ?? null}
          action={<TextLink href="/admin/personas">書き手へ戻る</TextLink>}
        />
      ) : audiences.value.total === 0 ? (
        <Section title="読者像">
          <EmptyView
            title="読者像が登録されていません"
            body={audiences.value.emptyReason ?? "誰に向けて書くかが決まっていません。"}
            action={<TextLink href="/admin/personas">書き手の画面へ</TextLink>}
          />
        </Section>
      ) : (
        <>
          <Section title="知識量の散らばり">
            <FactList
              rows={Object.entries(audiences.value.countsByKnowledge).map(([label, count]) => ({
                key: label,
                label,
                value: `${count}人`,
              }))}
            />
            <Note>知識量が 1 種類に偏っていると、同じ書き方の記事ばかりになります。</Note>
          </Section>

          {audiences.value.items.map((audience) => {
            /*
             * 折りたたむ側の件数。
             *
             * 開く前の 1 行に件数を出す。「詳細」とだけ書くと、
             * 開かないと中身が有るのか空なのかが分からず、全員が必ず開く。
             * それでは折りたたんだ意味が無くなる。
             */
            const detailCount =
              audience.decisionCriteria.length +
              audience.painPoints.length +
              audience.objections.length +
              audience.trustRequirements.length;
            return (
            <Section key={audience.personaId} title={audience.name} lead={audience.primaryJob}>
              <FactList
                rows={[
                  { key: "situation", label: "今の状況", value: audience.currentSituation },
                  { key: "outcome", label: "望んでいること", value: audience.desiredOutcome },
                  { key: "knowledge", label: "知識量", value: audience.knowledgeLabel },
                  {
                    key: "awareness",
                    label: "どこまで知っているか",
                    value: audience.awarenessLabel,
                  },
                  { key: "detail", label: "読みたい詳しさ", value: audience.detailLabel },
                  { key: "budget", label: "予算の事情", value: audience.budgetContext ?? "—" },
                  { key: "time", label: "時間の事情", value: audience.timeContext ?? "—" },
                  {
                    key: "next",
                    label: "読んだあとにしてほしいこと",
                    value: audience.nextAction,
                  },
                ]}
              />
              <Note>「—」は、まだ決まっていないという意味です。該当なしではありません。</Note>

              <Foldable summary={`書き方の手がかり ${detailCount}件（基準・困りごと・引っかかり・信じる条件）`}>
                <SubSection title="選ぶときの基準">
                  <ListView rows={audience.decisionCriteria.map((c) => ({ key: c, label: c }))} />
                </SubSection>

                <SubSection title="困っていること">
                  <ListView rows={audience.painPoints.map((p) => ({ key: p, label: p }))} />
                </SubSection>

                <SubSection title="読む前に感じている引っかかり">
                  <ListView rows={audience.objections.map((o) => ({ key: o, label: o }))} />
                </SubSection>

                <SubSection title="信じてもらうために要ること">
                  <ListView rows={audience.trustRequirements.map((t) => ({ key: t, label: t }))} />
                </SubSection>
              </Foldable>

              {audience.prohibitedAssumptions.length > 0 ? (
                <Note>
                  決めつけてはいけないこと: {audience.prohibitedAssumptions.join("／")}
                </Note>
              ) : null}
            </Section>
            );
          })}
        </>
      )}
    </AdminShell>
  );
}
