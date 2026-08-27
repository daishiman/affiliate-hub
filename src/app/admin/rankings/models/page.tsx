import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, rankingUseCases } from "@/presentation/composition";
import { DataTable, EmptyView, ErrorView, ListView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 評価基準の一覧。
 *
 * `/admin/rankings/criteria` とは別の画面である。あちらは
 * **いま順位に使われている 1 つ**の測り方を読者向けの言葉で説明する場所で、
 * ここは**保存されている全部**を並べて、次にどれを使うかを選ぶ場所。
 * 1 つにまとめると、読者へ見せる説明の中に版の管理が混ざる。
 */
export default async function RankingModelsPage() {
  const actor = await currentActor();
  const result = await (await rankingUseCases()).listModels.execute(actor, {});

  return (
    <AdminShell
      routeId="rankings/models"
      title="評価基準"
      lead="どう測って並べるかの決めごと。"
      actions={
        <>
          <TextLink href="/admin/rankings/models/new">基準を作る</TextLink>
          <TextLink href="/admin/rankings">順位へ戻る</TextLink>
        </>
      }
    >
      {!result.ok ? (
        <ErrorView
          title="評価基準を読み出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/rankings">順位へ戻る</TextLink>}
        />
      ) : result.value.emptyReason !== null ? (
        <Section title="評価基準">
          <EmptyView
            title="まだ基準がありません"
            body="何をどれだけ重く見るかを決めないと、商品に点を付けても順位は出ません。"
            action={<TextLink href="/admin/rankings/models/new">基準を作る</TextLink>}
          />
        </Section>
      ) : (
        <Section
          title="保存されている基準"
          lead="新しい版ほど上にあります。版を上げても、前の版で出した順位はそのまま残ります。"
        >
          <DataTable
            caption="評価基準の一覧"
            columns={[
              { key: "version", label: "版" },
              { key: "audience", label: "誰にとっての順位か" },
              { key: "from", label: "いつから" },
              { key: "criteria", label: "重みの内訳" },
            ]}
            rows={result.value.items.map((m) => ({
              key: m.modelId,
              cells: [
                <TextLink
                  key={`${m.modelId}-version`}
                  href={`/admin/rankings?model=${encodeURIComponent(m.modelId)}`}
                >
                  {m.version}
                </TextLink>,
                m.audience,
                m.effectiveFrom,
                // 内訳を畳まない。版を選ぶ人が知りたいのは名前ではなく
                // 「何を重く見る測り方か」で、それは重みの並びにしか出ていない。
                <ListView
                  key={`${m.modelId}-criteria`}
                  rows={m.criteria.map((c) => ({
                    key: c.label,
                    label: `${c.label} ${c.weightPercent}%`,
                  }))}
                />,
              ],
            }))}
          />
        </Section>
      )}
    </AdminShell>
  );
}
