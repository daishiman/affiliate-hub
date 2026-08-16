import Link from "next/link";
import type { ReactNode } from "react";
import {
  type AuthorOption,
  FactBoundaryCheckForm,
} from "@/presentation/admin/fact-boundary-form";
import { currentActor, personaUseCases } from "@/presentation/composition";
import {
  AppShell,
  Callout,
  Card,
  EmptyView,
  ErrorView,
  Page,
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
        <h2 className={styles.sectionTitle}>書き手（{authors.value.total}人）</h2>
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
              <h3 className={styles.sectionTitle}>
                {author.displayName}（{author.personaTypeLabel}）
              </h3>
              <p className={styles.sectionLead}>{author.role}</p>

              <dl className={styles.criteria}>
                <div>
                  <dt>読者の知識量の想定</dt>
                  <dd>{author.knowledgeLabel}</dd>
                </div>
                <div>
                  <dt>経験年数</dt>
                  <dd>{author.experienceYearsLabel}</dd>
                </div>
                <div>
                  <dt>一人称</dt>
                  <dd>{author.firstPersonPronoun}</dd>
                </div>
                <div>
                  <dt>読者の呼び方</dt>
                  <dd>{author.readerAddress}</dd>
                </div>
                <div>
                  <dt>実際に試した記録</dt>
                  <dd className={styles.numeric}>{author.verifiedExperienceCount}件</dd>
                </div>
              </dl>

              <table className={styles.rankTable}>
                <caption>文体の決め方</caption>
                <thead>
                  <tr>
                    <th scope="col">項目</th>
                    <th scope="col">度合い</th>
                  </tr>
                </thead>
                <tbody>
                  {author.toneLabels.map((tone) => (
                    <tr key={tone.axis}>
                      <th scope="row">{tone.axis}</th>
                      <td>{tone.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 className={styles.sectionTitle}>名乗れる資格</h4>
              {author.verifiedCredentials.length === 0 ? (
                <p className={styles.linkNote}>
                  確認済みの資格はありません。資格を前提にした書き方はできません。
                </p>
              ) : (
                <ul className={styles.linkList}>
                  {author.verifiedCredentials.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}

              <h4 className={styles.sectionTitle}>書いてよい事実の範囲</h4>
              {author.factBoundary.length === 0 ? (
                <p className={styles.linkNote}>
                  まだ決まっていません。決まるまでこの書き手では公開できません。
                </p>
              ) : (
                <ul className={styles.linkList}>
                  {author.factBoundary.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}

              {author.prohibitedPhrases.length > 0 ? (
                <p className={styles.linkNote}>
                  使わないと決めた言葉: {author.prohibitedPhrases.join("、")}
                </p>
              ) : null}

              {author.limitations.map((limitation) => (
                <Callout key={limitation} tone="warn" reason={limitation} />
              ))}
            </div>
          ))
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>書ける範囲か調べる</h2>
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
        <h2 className={styles.sectionTitle}>読者像</h2>
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
            <dl className={styles.criteria}>
              {Object.entries(audiences.value.countsByKnowledge).map(([label, count]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={styles.numeric}>{count}人</dd>
                </div>
              ))}
            </dl>
            <p className={styles.linkNote}>
              知識量が 1 種類に偏っていると、同じ書き方の記事ばかりになります。
            </p>

            {audiences.value.items.map((audience) => (
              <div key={audience.personaId} className={styles.catalogStack}>
                <h3 className={styles.sectionTitle}>{audience.name}</h3>
                <p className={styles.sectionLead}>{audience.primaryJob}</p>

                <dl className={styles.criteria}>
                  <div>
                    <dt>今の状況</dt>
                    <dd>{audience.currentSituation}</dd>
                  </div>
                  <div>
                    <dt>望んでいること</dt>
                    <dd>{audience.desiredOutcome}</dd>
                  </div>
                  <div>
                    <dt>知識量</dt>
                    <dd>{audience.knowledgeLabel}</dd>
                  </div>
                  <div>
                    <dt>どこまで知っているか</dt>
                    <dd>{audience.awarenessLabel}</dd>
                  </div>
                  <div>
                    <dt>読みたい詳しさ</dt>
                    <dd>{audience.detailLabel}</dd>
                  </div>
                  <div>
                    <dt>予算の事情</dt>
                    <dd>{audience.budgetContext ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>時間の事情</dt>
                    <dd>{audience.timeContext ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>読んだあとにしてほしいこと</dt>
                    <dd>{audience.nextAction}</dd>
                  </div>
                </dl>
                <p className={styles.linkNote}>
                  「—」は、まだ決まっていないという意味です。該当なしではありません。
                </p>

                <h4 className={styles.sectionTitle}>選ぶときの基準</h4>
                <ul className={styles.linkList}>
                  {audience.decisionCriteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>

                <h4 className={styles.sectionTitle}>困っていること</h4>
                <ul className={styles.linkList}>
                  {audience.painPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>

                <h4 className={styles.sectionTitle}>読む前に感じている引っかかり</h4>
                <ul className={styles.linkList}>
                  {audience.objections.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>

                <h4 className={styles.sectionTitle}>信じてもらうために要ること</h4>
                <ul className={styles.linkList}>
                  {audience.trustRequirements.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>

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
    <AppShell
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
    </AppShell>
  );
}
