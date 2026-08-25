import { DEFAULT_MINIMUM_SAMPLES, METRIC_DEFINITIONS } from "@/domain/analytics";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  AdvanceLoopRunForm,
  ApproveVariantSpecForm,
  DraftVariantSpecForm,
  StartLoopRunForm,
} from "@/presentation/admin/improvement-forms";
import {
  currentActor,
  improvementBlockedBy,
  improvementNotice,
  improvementUseCases,
  platformUseCases,
} from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  FactList,
  ListView,
  Note,
  Prose,
  Section,
  StubNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * いま何を試していて、何が言えるのか。
 *
 * この画面で一番大事なのは「良くなった」を見せることではなく、
 * **まだ何も言えないものを、言えないまま出すこと**。
 * 判定できていないものを隠すと、実施中のまま忘れられた比較が溜まり、
 * 半年後に同じことをもう一度試すことになる。
 *
 * だから並べ方は状態順（実施中 → 判定済み）で固定し、
 * 「判定保留」「効果不明」も同じ大きさで出す。
 */
export default async function ImprovementPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const siteSlug = params.site !== undefined && params.site !== "" ? params.site : undefined;

  const actor = await currentActor();
  const uc = await improvementUseCases();
  const review = await uc.review.execute(actor, { siteSlug });
  // 回す側の材料（軸の一覧・登録済みの設定・ブログの一覧）。
  // 読めなくても状況の表示は出す。ここで落とすと、見ることまでできなくなる。
  const dimensions = await uc.dimensions.execute(actor, { siteSlug });
  const sites = await (await platformUseCases()).listSites.execute(actor, {});

  // 軸の選択肢は登録表から作る。画面に書き起こすと、軸を足した日にここだけ古くなる。
  const dimensionOptions = dimensions.ok
    ? dimensions.value.groups.flatMap((g) =>
        g.dimensions.map((d) => ({ value: d.key, label: `${g.label}／${d.label}` })),
      )
    : [];
  const specs = dimensions.ok ? dimensions.value.specs : [];
  const pendingSpecs = specs
    .filter((s) => !s.approved)
    .map((s) => ({ value: s.id, label: `${s.label}（${s.explanation}）` }));
  const approvedSpecs = specs
    .filter((s) => s.approved)
    .map((s) => ({ value: s.id, label: `${s.label}（${s.explanation}）` }));
  const metricOptions = METRIC_DEFINITIONS.map((m) => ({ value: m.key, label: m.label }));
  const siteOptions = sites.ok ? sites.value.items : [];

  return (
    <AdminShell
      routeId="improvement"
      title="改善の状況"
      lead="いま何を試していて、何が言えるのかを見ます。"
      actions={
        <TextLink href="/admin/improvement/dimensions">変えられるものを見る</TextLink>
      }
    >
      {!review.ok ? (
        <ErrorView
          title="改善の状況を出せませんでした"
          body={review.error.message}
          suggestedAction={review.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StubNotice
            what="改善ループの記録先"
            blockedBy={improvementBlockedBy()}
            stubId="persistence:improvement-sample"
          >
            {improvementNotice()}
          </StubNotice>

          <Section title="いまの状況">
            <FactList
              rows={[
                {
                  key: "running",
                  label: "実施中",
                  value: `${review.value.runningCount}件（結果が出るまで待ちます）`,
                },
                {
                  key: "pending",
                  label: "まだ判定できないもの",
                  value: `${review.value.pendingCount}件（件数が足りていません）`,
                },
              ]}
            />
            {review.value.caveats.map((c) => (
              <ActionNote key={c}>この数字の読み方: {c}</ActionNote>
            ))}
          </Section>

          <Section
            title="試す（1 周まわす）"
            lead="試作を登録する → 承認する → 比較を始める → 観測値を書く → 判定する。この順番は飛ばせません。承認を挟むのは、見た目だけの変更でも人が決めるためです。"
          >
            {!dimensions.ok ? (
              <Callout
                tone="warn"
                title="いまは試作を登録できません"
                reason={dimensions.error.message}
              />
            ) : siteSlug === undefined ? (
              <>
                <Prose>どのブログで試すかを先に決めてください。</Prose>
                {siteOptions.length === 0 ? (
                  <Note>
                    {sites.ok
                      ? "まだブログがありません。先にブログを 1 つ作ってください。"
                      : `ブログの一覧をまだ読み出せません（${sites.error.message}）。`}
                  </Note>
                ) : (
                  <ListView
                    rows={siteOptions.map((s) => ({
                      key: s.slug,
                      label: s.name,
                      href: `/admin/improvement?site=${s.slug}`,
                      note: "このブログで試す",
                    }))}
                  />
                )}
              </>
            ) : (
              <>
                <DraftVariantSpecForm
                  siteSlug={siteSlug}
                  dimensions={dimensionOptions}
                  maxSimultaneous={dimensions.value.maxSimultaneous}
                />
                <ApproveVariantSpecForm siteSlug={siteSlug} pendingSpecs={pendingSpecs} />
                <StartLoopRunForm
                  siteSlug={siteSlug}
                  approvedSpecs={approvedSpecs}
                  metrics={metricOptions}
                  defaultMinimumSamples={DEFAULT_MINIMUM_SAMPLES}
                />
              </>
            )}
          </Section>

          <Section title="試している比較">
            {review.value.rows.length === 0 ? (
              <EmptyView
                title="まだ試している比較がありません"
                body={
                  review.value.emptyReason ??
                  "変えてみたい軸を選ぶと、ここに比較が並びます。"
                }
                action={
                  <TextLink href="/admin/improvement/dimensions">
                    変えられるものを見る
                  </TextLink>
                }
              />
            ) : (
              <DataTable
                caption="実施中のものを先に並べています。判定できないものも隠さず出します。"
                columns={[
                  { key: "site", label: "ブログ" },
                  { key: "changed", label: "変えたところ" },
                  { key: "metric", label: "見ている指標" },
                  { key: "status", label: "状態" },
                  { key: "verdict", label: "いまの判定" },
                ]}
                rows={review.value.rows.map((r) => ({
                  key: r.id,
                  cells: [
                    r.siteSlug,
                    r.changedLabels.join("・"),
                    r.primaryMetricLabel,
                    r.statusLabel,
                    r.verdictLabel,
                  ],
                }))}
              />
            )}
          </Section>

          {review.value.rows.map((r) => (
            <Section
              key={`detail-${r.id}`}
              title={`${r.siteSlug}／${r.changedLabels.join("・")}`}
              lead={`${r.loopKindLabel}・${r.statusLabel}`}
            >
              {r.blockedReason !== null ? (
                <ActionNote>まだ判定していません。{r.blockedReason}</ActionNote>
              ) : (
                <ActionNote>
                  {r.verdictLabel}。{r.result?.reason ?? "判定の理由が記録されていません。"}
                </ActionNote>
              )}
              {r.suggestions.length === 0 ? (
                <Note>
                  判定が出ていないため、次の一手はまだ出せません。件数が足りるまで待ちます。
                </Note>
              ) : (
                <ListView
                  rows={r.suggestions.map((s) => ({
                    key: `${r.id}-${s.dimensionKey}`,
                    label: `${s.dimensionLabel}: ${s.from} → ${s.to}`,
                    // 承認が要ることを毎回書く。1 か所にまとめて書くと、
                    // 提案を見た場所と、承認が要ると書いてある場所が離れる。
                    note: `${s.rationale}／適用には承認が要ります（見た目だけの変更でも同じです）。`,
                  }))}
                />
              )}

              <AdvanceLoopRunForm
                runId={r.id}
                running={r.status === "running"}
                hasObservation={r.hasObservation}
              />
            </Section>
          ))}
        </>
      )}
    </AdminShell>
  );
}
