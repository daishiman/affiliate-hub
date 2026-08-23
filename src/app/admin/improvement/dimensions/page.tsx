import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, improvementUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
  EmptyView,
  ErrorView,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

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

  if (!listed.ok) {
    return (
      <Shell>
        <ErrorView
          title="変えられるものの一覧を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<Link href="/admin/improvement">改善の状況へ戻る</Link>}
        />
      </Shell>
    );
  }

  const v = listed.value;

  return (
    <Shell>
      <Callout
        tone="info"
        title="一度に変えてよいのは最大 2 か所です"
        reason={`同時に ${v.maxSimultaneous} か所を超えて変えると、どれが効いたのか分からなくなります。分からない記録は後から使えません。`}
      />

      {v.groups.map((g) => (
        <Card key={g.group}>
          <SectionHeading level={2}>{g.label}</SectionHeading>
          <DataTable
            caption={`${g.label}で変えられるもの。まだ一度も試していないものは「未実施」と出します。`}
            columns={[
              { key: "label", header: "変えられるもの", rowHeader: true, cell: (d) => d.label },
              { key: "why", header: "なぜ変える価値があるか", cell: (d) => d.why },
              { key: "source", header: "案の作り方", cell: (d) => d.candidateSourceLabel },
              {
                key: "metrics",
                header: "効果を見る指標",
                cell: (d) => d.metricLabels.join("・"),
              },
              {
                key: "running",
                header: "実施中",
                align: "numeric",
                cell: (d) => d.runningCount,
              },
              {
                key: "concluded",
                header: "判定済み",
                align: "numeric",
                cell: (d) => (d.neverTried ? "未実施" : d.concludedCount),
              },
            ]}
            rows={g.dimensions}
            rowKey={(d) => d.key}
          />
        </Card>
      ))}

      <Card>
        <SectionHeading level={2}>調整してはいけないもの</SectionHeading>
        <p className={styles.sectionLead}>
          ここに並ぶものは、数字が良くなるとしても変えません。軸として登録しようとすると、
          仕組みの側で受け付けません（人の心がけではなく、コードで止めています）。
        </p>
        <StackedList>
          {v.nonOptimizable.map((n) => (
            <StackedRow key={n.label} note={n.reason}>
              {n.label}
              
            </StackedRow>
          ))}
        </StackedList>
      </Card>

      <Card>
        <SectionHeading level={2}>ループの種類</SectionHeading>
        <p className={styles.sectionLead}>
          いまは「記事を良くするループ」だけが動きます。ほかは形だけ決めてあり、
          動かすのに何が要るかを書いてあります。
        </p>
        {v.loops.map((l) => (
          <div key={l.key}>
            <SectionHeading level={3}>
              {l.label}（{l.polarityLabel}・{l.readinessLabel}）
            </SectionHeading>
            <StackedList>
              <StackedRow note={l.signal}>
                見るもの
                
              </StackedRow>
              <StackedRow note={l.decisionRule}>
                決め方
                
              </StackedRow>
              <StackedRow note={l.decisionBasisLabel}>
                何をもって決めるか
                
              </StackedRow>
              <StackedRow note={l.approver}>
                承認する人
                
              </StackedRow>
              <StackedRow note={l.stopConditions.join(" / ")}>
                止める条件
                
              </StackedRow>
              <StackedRow note={l.hardGuardrails.join(" / ")}>
                外せない約束
                
              </StackedRow>
              {l.softGuardrails.length > 0 ? (
                <StackedRow note={l.softGuardrails.join(" / ")}>
                  目安の約束
                  
                </StackedRow>
              ) : null}
            </StackedList>
            {l.implemented ? null : (
              <Callout
                tone="info"
                title="まだ動きません"
                reason={l.blockedBy ?? "動かすのに必要なものが記録されていません。"}
              />
            )}
          </div>
        ))}
      </Card>

      <Card>
        <SectionHeading level={2}>いまの見せ方の設定</SectionHeading>
        <p className={styles.sectionLead}>
          「この記事がなぜこの形なのか」をたどるための記録です。
          色の設定も見出しの順番も、同じ 1 つの形で持ちます。
        </p>
        {v.specs.length === 0 ? (
          <EmptyView
            title="見せ方の設定がまだありません"
            body={v.specsEmptyReason ?? "設定を作ると、ここに経緯つきで並びます。"}
            action={<Link href="/admin/improvement">改善の状況を見る</Link>}
          />
        ) : (
          <StackedList>
            {v.specs.map((s) => (
              <StackedRow key={s.id} note={s.explanation}>
                {s.label}
                {s.approved ? "" : "（未承認）"}
                
              </StackedRow>
            ))}
          </StackedList>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/improvement/dimensions"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "改善の状況", href: "/admin/improvement" },
        { label: "変えられるもの" },
      ]}
      actions={<Link href="/admin/improvement">改善の状況へ戻る</Link>}
    >
      <Page
        title="変えられるもの"
        lead="文章の組み立て・見た目・たどり方のうち、試して比べてよいものの一覧です。あわせて、数字が良くなっても変えないものも出します。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
