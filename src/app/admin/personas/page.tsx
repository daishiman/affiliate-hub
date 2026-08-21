import { type AuthorOption, FactBoundaryCheckForm } from "@/presentation/admin/fact-boundary-form";
import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, personaUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
  DefinitionList,
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
 * 書き手と読者像。
 *
 * **「誰が」「誰に向けて」書くかを決める画面。**
 * ここが空のまま記事を作ると、誰にでも当てはまるが誰にも刺さらない文章になる。
 *
 * この画面では、書き手ごとに「できないこと」を必ず出す。
 * 実際に試した記録が無い書き手に「使ってみました」と書かせないのは仕様であって、
 * 不具合ではない。理由を出さないと、利用者は壊れていると受け取る。
 */
export default async function PersonasPage() {
  const actor = await currentActor();
  const useCases = personaUseCases();
  const [authors, audiences] = await Promise.all([
    useCases.listAuthors.execute(actor, {}),
    useCases.listAudiences.execute(actor, {}),
  ]);

  if (!authors.ok) {
    return (
      <Shell>
        <ErrorView
          title="書き手の一覧を出せませんでした"
          body={authors.error.message}
          suggestedAction={authors.error.suggestedAction ?? null}
          action={<Link href="/admin/content">記事へ戻る</Link>}
        />
      </Shell>
    );
  }

  const authorOptions: readonly AuthorOption[] = authors.value.items.map((a) => ({
    value: a.personaId,
    label: a.displayName,
  }));

  return (
    <Shell>
      <StubNotice
        what="書き手と読者像の保存先"
        blockedBy="author_personas / audience_personas テーブルの追加と D1 への接続"
        stubId="persistence:content-editorial-sample"
      >
        <span>
          今は見本のデータを読んでいます。この画面から書き手を追加・変更することはまだできません。
        </span>
      </StubNotice>

      <Callout
        tone="info"
        title="書き手と読者像の関係"
        reason="書き手は「何を事実として書けるか」を決め、読者像は「何を比べたいか」を決めます。比較表の列も、結論の書き方も、この 2 つから決まります。"
      />

      <Card>
        <SectionHeading level={2}>書き手（{authors.value.total}人）</SectionHeading>
        <p className={styles.sectionLead}>
          記事の署名になる人です。名乗れる資格と、書ける事実の範囲がそれぞれ決まっています。
        </p>

        {authors.value.total === 0 ? (
          <EmptyView
            title="書き手が登録されていません"
            body={authors.value.emptyReason ?? "誰の立場で書くかが決まっていません。"}
            action={<Link href="/admin/content">記事の画面へ</Link>}
          />
        ) : (
          authors.value.items.map((author) => (
            <div key={author.personaId} className={styles.catalogStack}>
              <SectionHeading level={3}>
                {author.displayName}（{author.personaTypeLabel}）
              </SectionHeading>
              <p className={styles.sectionLead}>{author.role}</p>

              <DefinitionList
                items={[
                  { term: "読者の知識量の想定", description: author.knowledgeLabel },
                  { term: "経験年数", description: author.experienceYearsLabel },
                  { term: "一人称", description: author.firstPersonPronoun },
                  { term: "読者の呼び方", description: author.readerAddress },
                  {
                    term: "実際に試した記録",
                    description: `${author.verifiedExperienceCount}件`,
                    align: "numeric",
                  },
                ]}
              />

              <DataTable
                caption="文体の決め方"
                columns={[
                  { key: "axis", header: "項目", rowHeader: true, cell: (t) => t.axis },
                  { key: "label", header: "度合い", cell: (t) => t.label },
                ]}
                rows={author.toneLabels}
                rowKey={(t) => t.axis}
              />

              <SectionHeading level={4}>名乗れる資格</SectionHeading>
              {author.verifiedCredentials.length === 0 ? (
                <Note>
                  確認済みの資格はありません。資格を前提にした書き方はできません。
                </Note>
              ) : (
                <StackedList>
                  {author.verifiedCredentials.map((c) => (
                    <StackedRow key={c}>{c}</StackedRow>
                  ))}
                </StackedList>
              )}

              <SectionHeading level={4}>書いてよい事実の範囲</SectionHeading>
              {author.factBoundary.length === 0 ? (
                <Note>
                  まだ決まっていません。決まるまでこの書き手では公開できません。
                </Note>
              ) : (
                <StackedList>
                  {author.factBoundary.map((b) => (
                    <StackedRow key={b}>{b}</StackedRow>
                  ))}
                </StackedList>
              )}

              {author.prohibitedPhrases.length > 0 ? (
                <Note>
                  使わないと決めた言葉: {author.prohibitedPhrases.join("、")}
                </Note>
              ) : null}

              {author.limitations.map((limitation) => (
                <Callout key={limitation} tone="warn" reason={limitation} />
              ))}
            </div>
          ))
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>書ける範囲か調べる</SectionHeading>
        <p className={styles.sectionLead}>
          下書きを貼り付けると、その書き手が書ける事実の範囲に収まっているかを調べます。
          記事を作ったあと、人が直したあと、公開の直前の 3 回とも、同じ判定を使っています。
        </p>
        {authorOptions.length === 0 ? (
          <EmptyView
            title="調べる相手がいません"
            body="書き手が 1 人も登録されていないため、誰の範囲で調べるかを決められません。"
          />
        ) : (
          <FactBoundaryCheckForm authors={authorOptions} />
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>読者像</SectionHeading>
        <p className={styles.sectionLead}>
          記事を読む人です。何に困っていて、何を基準に選ぶかが、比較の観点になります。
        </p>

        {!audiences.ok ? (
          <Callout
            tone="warn"
            title="読者像の一覧を出せませんでした"
            reason={audiences.error.suggestedAction ?? audiences.error.message}
          />
        ) : audiences.value.total === 0 ? (
          <EmptyView
            title="読者像が登録されていません"
            body={audiences.value.emptyReason ?? "誰に向けて書くかが決まっていません。"}
          />
        ) : (
          <>
            <DefinitionList
              items={Object.entries(audiences.value.countsByKnowledge).map(([label, count]) => ({
                term: label,
                description: `${count}人`,
                align: "numeric" as const,
              }))}
            />
            <Note>
              知識量が 1 種類に偏っていると、同じ書き方の記事ばかりになります。
            </Note>

            {audiences.value.items.map((audience) => (
              <div key={audience.personaId} className={styles.catalogStack}>
                <SectionHeading level={3}>{audience.name}</SectionHeading>
                <p className={styles.sectionLead}>{audience.primaryJob}</p>

                <DefinitionList
                  items={[
                    { term: "今の状況", description: audience.currentSituation },
                    { term: "望んでいること", description: audience.desiredOutcome },
                    { term: "知識量", description: audience.knowledgeLabel },
                    { term: "どこまで知っているか", description: audience.awarenessLabel },
                    { term: "読みたい詳しさ", description: audience.detailLabel },
                    { term: "予算の事情", description: audience.budgetContext ?? "—" },
                    { term: "時間の事情", description: audience.timeContext ?? "—" },
                    { term: "読んだあとにしてほしいこと", description: audience.nextAction },
                  ]}
                />
                <Note>
                  「—」は、まだ決まっていないという意味です。該当なしではありません。
                </Note>

                <SectionHeading level={4}>選ぶときの基準</SectionHeading>
                <StackedList>
                  {audience.decisionCriteria.map((c) => (
                    <StackedRow key={c}>{c}</StackedRow>
                  ))}
                </StackedList>

                <SectionHeading level={4}>困っていること</SectionHeading>
                <StackedList>
                  {audience.painPoints.map((p) => (
                    <StackedRow key={p}>{p}</StackedRow>
                  ))}
                </StackedList>

                <SectionHeading level={4}>読む前に感じている引っかかり</SectionHeading>
                <StackedList>
                  {audience.objections.map((o) => (
                    <StackedRow key={o}>{o}</StackedRow>
                  ))}
                </StackedList>

                <SectionHeading level={4}>信じてもらうために要ること</SectionHeading>
                <StackedList>
                  {audience.trustRequirements.map((t) => (
                    <StackedRow key={t}>{t}</StackedRow>
                  ))}
                </StackedList>

                {audience.prohibitedAssumptions.length > 0 ? (
                  <Callout
                    tone="warn"
                    title="決めつけてはいけないこと"
                    reason={audience.prohibitedAssumptions.join("／")}
                  />
                ) : null}
              </div>
            ))}
          </>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/personas"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "書き手と読者像" }]}
      actions={<Link href="/admin/content">記事へ戻る</Link>}
    >
      <Page
        title="書き手と読者像"
        lead="誰の立場で、誰に向けて書くかを決める画面です。書ける事実の範囲と、比較の観点がここで決まります。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
