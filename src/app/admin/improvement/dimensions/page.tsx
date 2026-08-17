import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, improvementUseCases } from "@/presentation/composition";
import { Callout, Card, EmptyView, ErrorView, Page } from "@/presentation/ui";
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
  const listed = await improvementUseCases().dimensions.execute(actor, { siteSlug });

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
          <h2 className={styles.sectionTitle}>{g.label}</h2>
          <table className={styles.rankTable}>
            <caption>
              まだ一度も試していないものは「未実施」と出します。試した数を実績として持ちます。
            </caption>
            <thead>
              <tr>
                <th scope="col">変えられるもの</th>
                <th scope="col">なぜ変える価値があるか</th>
                <th scope="col">案の作り方</th>
                <th scope="col">効果を見る指標</th>
                <th scope="col">実施中</th>
                <th scope="col">判定済み</th>
              </tr>
            </thead>
            <tbody>
              {g.dimensions.map((d) => (
                <tr key={d.key}>
                  <th scope="row">{d.label}</th>
                  <td>{d.why}</td>
                  <td>{d.candidateSourceLabel}</td>
                  <td>{d.metricLabels.join("・")}</td>
                  <td className={styles.numeric}>{d.runningCount}</td>
                  <td className={styles.numeric}>
                    {d.neverTried ? "未実施" : d.concludedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      <Card>
        <h2 className={styles.sectionTitle}>調整してはいけないもの</h2>
        <p className={styles.sectionLead}>
          ここに並ぶものは、数字が良くなるとしても変えません。軸として登録しようとすると、
          仕組みの側で受け付けません（人の心がけではなく、コードで止めています）。
        </p>
        <ul className={styles.linkList}>
          {v.nonOptimizable.map((n) => (
            <li key={n.label}>
              {n.label}
              <span className={styles.linkNote}>{n.reason}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>ループの種類</h2>
        <p className={styles.sectionLead}>
          いまは「記事を良くするループ」だけが動きます。ほかは形だけ決めてあり、
          動かすのに何が要るかを書いてあります。
        </p>
        {v.loops.map((l) => (
          <div key={l.key}>
            <h3 className={styles.sectionTitle}>
              {l.label}（{l.polarityLabel}・{l.readinessLabel}）
            </h3>
            <ul className={styles.linkList}>
              <li>
                見るもの
                <span className={styles.linkNote}>{l.signal}</span>
              </li>
              <li>
                決め方
                <span className={styles.linkNote}>{l.decisionRule}</span>
              </li>
              <li>
                何をもって決めるか
                <span className={styles.linkNote}>{l.decisionBasisLabel}</span>
              </li>
              <li>
                承認する人
                <span className={styles.linkNote}>{l.approver}</span>
              </li>
              <li>
                止める条件
                <span className={styles.linkNote}>{l.stopConditions.join(" / ")}</span>
              </li>
              <li>
                外せない約束
                <span className={styles.linkNote}>{l.hardGuardrails.join(" / ")}</span>
              </li>
              {l.softGuardrails.length > 0 ? (
                <li>
                  目安の約束
                  <span className={styles.linkNote}>{l.softGuardrails.join(" / ")}</span>
                </li>
              ) : null}
            </ul>
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
        <h2 className={styles.sectionTitle}>いまの見せ方の設定</h2>
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
          <ul className={styles.linkList}>
            {v.specs.map((s) => (
              <li key={s.id}>
                {s.label}
                {s.approved ? "" : "（未承認）"}
                <span className={styles.linkNote}>{s.explanation}</span>
              </li>
            ))}
          </ul>
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
