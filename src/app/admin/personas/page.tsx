import { AdminShell } from "@/presentation/admin/admin-shell";
import { type AuthorOption, FactBoundaryCheckForm } from "@/presentation/admin/write/fact-boundary-form";
import {
  currentActor,
  personaStorageNotice,
  personaUseCases,
} from "@/presentation/composition";
import {
  ActionNote,
  DataTable,
  EmptyView,
  ErrorView,
  FactList,
  ListView,
  Note,
  Prose,
  Section,
  StorageNotice,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 書き手。
 *
 * **「誰の立場で書くか」を決める画面。**
 * ここが空のまま記事を作ると、誰にでも当てはまるが誰にも刺さらない文章になる。
 * 読者像（誰に向けて書くか）は `/admin/personas/audiences` へ移した。
 *
 * この画面では、書き手ごとに「できないこと」を必ず出す。
 * 実際に試した記録が無い書き手に「使ってみました」と書かせないのは仕様であって、
 * 不具合ではない。理由を出さないと、利用者は壊れていると受け取る。
 *
 * 書き手 1 人を `Section`（見出しは `h2`）にしている。
 * 「書き手一覧」を 1 つの `h2` にまとめると、その下の資格や事実の範囲が `h4` になり、
 * **1 人分の中でだけ段が 1 つ深い**画面ができる。読み上げでは、いま誰の話かが
 * 段の深さでしか分からないので、深さが揃っていないと追えなくなる。
 */
export default async function PersonasPage() {
  const actor = await currentActor();
  const authors = await (await personaUseCases()).listAuthors.execute(actor, {});

  const authorOptions: readonly AuthorOption[] = authors.ok
    ? authors.value.items.map((a) => ({ value: a.personaId, label: a.displayName }))
    : [];

  return (
    <AdminShell
      routeId="personas"
      title="書き手"
      lead="誰の立場で書くかを決めます。"
      actions={
        <>
          <TextLink href="/admin/personas/new">書き手を作る</TextLink>
          <TextLink href="/admin/content">記事へ戻る</TextLink>
        </>
      }
    >
      {!authors.ok ? (
        <ErrorView
          title="書き手の一覧を出せませんでした"
          body={authors.error.message}
          suggestedAction={authors.error.suggestedAction ?? null}
          action={<TextLink href="/admin/content">記事へ戻る</TextLink>}
        />
      ) : (
        <>
          {/*
            条件を画面側に書かない。書いていた頃は、保存先をつないだあとも
            「まだつながっていません」と出続けた（`stub-notice.tsx` に経緯）。
            いま何で動いているかを知っているのは composition 側だけにする。
          */}
          <StorageNotice status={await personaStorageNotice()} />

          <Prose>
            記事の署名になる人が{authors.value.total}
            人います。名乗れる資格と、書ける事実の範囲がそれぞれ決まっています。
          </Prose>

          {authors.value.total === 0 ? (
            <Section title="書き手">
              <EmptyView
                title="書き手が登録されていません"
                body={authors.value.emptyReason ?? "誰の立場で書くかが決まっていません。"}
                action={<TextLink href="/admin/content">記事の画面へ</TextLink>}
              />
            </Section>
          ) : (
            authors.value.items.map((author) => (
              <Section
                key={author.personaId}
                title={`${author.displayName}（${author.personaTypeLabel}）`}
                lead={author.role}
              >
                <FactList
                  rows={[
                    {
                      key: "knowledge",
                      label: "読者の知識量の想定",
                      value: author.knowledgeLabel,
                    },
                    { key: "years", label: "経験年数", value: author.experienceYearsLabel },
                    { key: "pronoun", label: "一人称", value: author.firstPersonPronoun },
                    { key: "address", label: "読者の呼び方", value: author.readerAddress },
                    {
                      key: "verified",
                      label: "実際に試した記録",
                      value: `${author.verifiedExperienceCount}件`,
                    },
                  ]}
                />

                <DataTable
                  caption="文体の決め方"
                  columns={[
                    { key: "axis", label: "項目" },
                    { key: "label", label: "度合い" },
                  ]}
                  rows={author.toneLabels.map((tone) => ({
                    key: tone.axis,
                    cells: [tone.axis, tone.label],
                  }))}
                />

                <SubSection title="名乗れる資格">
                  {author.verifiedCredentials.length === 0 ? (
                    <Note>確認済みの資格はありません。資格を前提にした書き方はできません。</Note>
                  ) : (
                    <ListView
                      rows={author.verifiedCredentials.map((c) => ({ key: c, label: c }))}
                    />
                  )}
                </SubSection>

                <SubSection title="書いてよい事実の範囲">
                  {author.factBoundary.length === 0 ? (
                    <Note>まだ決まっていません。決まるまでこの書き手では公開できません。</Note>
                  ) : (
                    <ListView rows={author.factBoundary.map((b) => ({ key: b, label: b }))} />
                  )}
                </SubSection>

                {author.prohibitedPhrases.length > 0 ? (
                  <Note>使わないと決めた言葉: {author.prohibitedPhrases.join("、")}</Note>
                ) : null}

                {author.limitations.map((limitation) => (
                  <ActionNote key={limitation} tone="danger">
                    {limitation}
                  </ActionNote>
                ))}
              </Section>
            ))
          )}

          <Section
            title="書ける範囲か調べる"
            lead="下書きを貼り付けると、その書き手が書ける事実の範囲に収まっているかを調べます。記事を作ったあと、人が直したあと、公開の直前の 3 回とも、同じ判定を使っています。"
          >
            {authorOptions.length === 0 ? (
              <EmptyView
                title="調べる相手がいません"
                body="書き手が 1 人も登録されていないため、誰の範囲で調べるかを決められません。"
              />
            ) : (
              <FactBoundaryCheckForm authors={authorOptions} />
            )}
          </Section>

          <Section
            title="読者像"
            lead="誰に向けて書くかは別の画面で決めます。書き手と同じ場所に置くと、「名乗れるか」と「何を比べたいか」という別の問いが混ざります。"
          >
            <ListView
              rows={[
                { key: "audiences", label: "読者像を決める", href: "/admin/personas/audiences" },
              ]}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
