import { AdminShell } from "@/presentation/admin/admin-shell";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import { currentActor, improvementUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  FactList,
  ListView,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 「何を変えて試せるか」の一覧。
 *
 * 一覧の中身は domain の登録表（optimization.ts / loop-kinds.ts）から作る。
 * **この画面に軸を書き起こさない。** 書き起こすと、軸を 1 つ足したときに
 * 画面だけ古いまま残り、「登録したのに選べない」が起きる。
 *
 * 調整してはいけないもの（根拠・広告表示・アクセシビリティなど）も
 * 同じ画面に並べる。別ページに分けると、軸を足す人がそれを読まない。
 */
export default async function ImprovementDimensionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const siteSlug = params.site !== undefined && params.site !== "" ? params.site : undefined;

  const actor = await currentActor();
  const listed = await (await improvementUseCases()).dimensions.execute(actor, { siteSlug });

  return (
    <AdminShell
      routeId="improvement/dimensions"
      title="変えられるもの"
      lead="試して比べてよいものと、変えないものの一覧です。"
      actions={<TextLink href="/admin/improvement">改善の状況へ戻る</TextLink>}
    >
      {!listed.ok ? (
        <ErrorView
          title="変えられるものの一覧を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<TextLink href="/admin/improvement">改善の状況へ戻る</TextLink>}
        />
      ) : (
        <DimensionsBody value={listed.value} />
      )}
    </AdminShell>
  );
}

type Dimensions = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof improvementUseCases>>["dimensions"]["execute"]>
>;

function DimensionsBody({ value: v }: { readonly value: Dimensions }) {
  return (
    <>
      <Callout
        tone="info"
        title="一度に変えてよいのは最大 2 か所です"
        reason={`同時に ${v.maxSimultaneous} か所を超えて変えると、どれが効いたのか分からなくなります。分からない記録は後から使えません。`}
      />

      {v.groups.map((g) => (
        <Section key={g.group} title={g.label}>
          <DataTable
            caption="まだ一度も試していないものは「未実施」と出します。試した数を実績として持ちます。"
            columns={[
              { key: "label", label: "変えられるもの" },
              { key: "why", label: "なぜ変える価値があるか" },
              { key: "source", label: "案の作り方" },
              { key: "metrics", label: "効果を見る指標" },
              { key: "running", label: "実施中", numeric: true },
              { key: "concluded", label: "判定済み", numeric: true },
            ]}
            rows={g.dimensions.map((d) => ({
              key: d.key,
              cells: [
                d.label,
                d.why,
                d.candidateSourceLabel,
                d.metricLabels.join("・"),
                d.runningCount,
                d.neverTried ? "未実施" : d.concludedCount,
              ],
            }))}
          />
        </Section>
      ))}

      <Section
        title="調整してはいけないもの"
        lead="ここに並ぶものは、数字が良くなるとしても変えません。軸として登録しようとすると、仕組みの側で受け付けません（人の心がけではなく、コードで止めています）。"
      >
        <ListView
          rows={v.nonOptimizable.map((n) => ({
            key: n.label,
            label: n.label,
            note: n.reason,
          }))}
        />
      </Section>

      <Section
        title="ループの種類"
        lead="いまは「記事を良くするループ」だけが動きます。ほかは形だけ決めてあり、動かすのに何が要るかを書いてあります。"
      >
        {v.loops.map((l) => (
          <SubSection key={l.key} title={`${l.label}（${l.polarityLabel}・${l.readinessLabel}）`}>
            <FactList
              rows={[
                { key: "signal", label: "見るもの", value: l.signal },
                { key: "rule", label: "決め方", value: l.decisionRule },
                { key: "basis", label: "何をもって決めるか", value: l.decisionBasisLabel },
                { key: "approver", label: "承認する人", value: l.approver },
                { key: "stop", label: "止める条件", value: l.stopConditions.join(" / ") },
                { key: "hard", label: "外せない約束", value: l.hardGuardrails.join(" / ") },
                ...(l.softGuardrails.length > 0
                  ? [
                      {
                        key: "soft",
                        label: "目安の約束",
                        value: l.softGuardrails.join(" / "),
                      },
                    ]
                  : []),
              ]}
            />
            {l.implemented ? null : (
              <Callout
                tone="info"
                title="まだ動きません"
                reason={l.blockedBy ?? "動かすのに必要なものが記録されていません。"}
              />
            )}
          </SubSection>
        ))}
      </Section>

      <Section
        title="いまの見せ方の設定"
        lead="「この記事がなぜこの形なのか」をたどるための記録です。色の設定も見出しの順番も、同じ 1 つの形で持ちます。"
      >
        {v.specs.length === 0 ? (
          <EmptyView
            title="見せ方の設定がまだありません"
            body={v.specsEmptyReason ?? "設定を作ると、ここに経緯つきで並びます。"}
            action={<TextLink href="/admin/improvement">改善の状況を見る</TextLink>}
          />
        ) : (
          <ListView
            rows={v.specs.map((s) => ({
              key: s.id,
              label: `${s.label}${s.approved ? "" : "（未承認）"}`,
              note: s.explanation,
            }))}
          />
        )}
      </Section>
    </>
  );
}
