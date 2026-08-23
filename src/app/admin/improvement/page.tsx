import Link from "next/link";
import type { ReactNode } from "react";
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
import { DEFAULT_MINIMUM_SAMPLES, METRIC_DEFINITIONS } from "@/domain/analytics";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  Callout,
  Card,
  DataTable,
  EmptyView,
  ErrorView,
  Note,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StubNotice,
} from "@/presentation/ui";
import styles from "../admin.module.css";

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

  if (!review.ok) {
    return (
      <Shell>
        <ErrorView
          title="改善の状況を出せませんでした"
          body={review.error.message}
          suggestedAction={review.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const v = review.value;

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
    <Shell>
      <StubNotice
        what="改善ループの記録先"
        blockedBy={improvementBlockedBy()}
        stubId="persistence:improvement-sample"
      >
        <span>{improvementNotice()}</span>
      </StubNotice>

      <Card>
        <SectionHeading level={2}>いまの状況</SectionHeading>
        <StackedList>
          <StackedRow note={<>結果が出るまで待ちます</>}>
            実施中 {v.runningCount} 件
            
          </StackedRow>
          <StackedRow note={<>件数が足りていません</>}>
            まだ判定できないもの {v.pendingCount} 件
            
          </StackedRow>
        </StackedList>
        {v.caveats.map((c) => (
          <Callout key={c} tone="info" title="この数字の読み方" reason={c} />
        ))}
      </Card>

      <Card>
        <SectionHeading level={2}>試す（1 周まわす）</SectionHeading>
        <p className={styles.sectionLead}>
          試作を登録する → 承認する → 比較を始める → 観測値を書く → 判定する。
          この順番は飛ばせません。承認を挟むのは、見た目だけの変更でも人が決めるためです。
        </p>

        {!dimensions.ok ? (
          <Callout
            tone="warn"
            title="いまは試作を登録できません"
            reason={dimensions.error.message}
          />
        ) : siteSlug === undefined ? (
          <>
            <p>どのブログで試すかを先に決めてください。</p>
            {siteOptions.length === 0 ? (
              <Note>
                {sites.ok
                  ? "まだブログがありません。先にブログを 1 つ作ってください。"
                  : `ブログの一覧をまだ読み出せません（${sites.error.message}）。`}
              </Note>
            ) : (
              <StackedList>
                {siteOptions.map((s) => (
                  <StackedRow key={s.slug} note={<>このブログで試す</>}>
                    <Link href={`/admin/improvement?site=${s.slug}`}>{s.name}</Link>
                    
                  </StackedRow>
                ))}
              </StackedList>
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
      </Card>

      <Card>
        <SectionHeading level={2}>試している比較</SectionHeading>
        {v.rows.length === 0 ? (
          <EmptyView
            title="まだ試している比較がありません"
            body={v.emptyReason ?? "変えてみたい軸を選ぶと、ここに比較が並びます。"}
            action={<Link href="/admin/improvement/dimensions">変えられるものを見る</Link>}
          />
        ) : (
          <DataTable
            caption="実施中のものを先に並べています。判定できないものも隠さず出します。"
            columns={[
              { key: "site", header: "ブログ", rowHeader: true, cell: (r) => r.siteSlug },
              {
                key: "changed",
                header: "変えたところ",
                cell: (r) => r.changedLabels.join("・"),
              },
              { key: "metric", header: "見ている指標", cell: (r) => r.primaryMetricLabel },
              { key: "status", header: "状態", cell: (r) => r.statusLabel },
              { key: "verdict", header: "いまの判定", cell: (r) => r.verdictLabel },
            ]}
            rows={v.rows}
            rowKey={(r) => r.id}
          />
        )}
      </Card>

      {v.rows.map((r) => (
        <Card key={`detail-${r.id}`}>
          <SectionHeading level={2}>
            {r.siteSlug}／{r.changedLabels.join("・")}
          </SectionHeading>
          <p className={styles.sectionLead}>
            {r.loopKindLabel}・{r.statusLabel}
          </p>
          {r.blockedReason !== null ? (
            <Callout tone="info" title="まだ判定していません" reason={r.blockedReason} />
          ) : (
            <Callout
              tone="info"
              title={r.verdictLabel}
              reason={r.result?.reason ?? "判定の理由が記録されていません。"}
            />
          )}
          {r.suggestions.length === 0 ? (
            <Note>
              判定が出ていないため、次の一手はまだ出せません。件数が足りるまで待ちます。
            </Note>
          ) : (
            <>
              <StackedList>
                {r.suggestions.map((s) => (
                  <StackedRow key={`${r.id}-${s.dimensionKey}`} note={s.rationale}>
                    {s.dimensionLabel}: {s.from} → {s.to}
                  </StackedRow>
                ))}
              </StackedList>
              {/*
                承認が要ることは一覧に 1 回だけ言う。
                **各行に同じ文を繰り返していた**（`StackedRow` へ移したときの
                置換跡で、行の注記は `note` の `s.rationale` が持っているのに、
                中身の側に固定文の `<span>` が残っていた）。
                **同じ文が n 回並ぶと、読む人は文ではなく模様として飛ばす**
                ——n 回言うほど伝わらなくなる種類の文である。
              */}
              <Note>適用には承認が要ります（見た目だけの変更でも同じです）。</Note>
            </>
          )}

          <AdvanceLoopRunForm
            runId={r.id}
            running={r.status === "running"}
            hasObservation={r.hasObservation}
          />
        </Card>
      ))}
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/improvement"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "改善の状況" }]}
      actions={<Link href="/admin/improvement/dimensions">変えられるものを見る</Link>}
    >
      <Page
        title="改善の状況"
        lead="いま何を試していて、何が言えるのかを見る画面です。件数が足りないものは「まだ分からない」と出します。数字を良く見せるために判定を緩めません。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
