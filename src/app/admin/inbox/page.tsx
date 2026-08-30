import {
  LINK_INBOX_FILTERS,
  filterLabel,
} from "@/application/usecases/monetization/manage-link-inbox";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  AdvanceIngestionForm,
  type ProgramOption,
  SubmitAffiliateUrlForm,
} from "@/presentation/admin/earn/inbox-forms";
import {
  affiliateUseCases,
  currentActor,
  linkInboxNotice,
  linkInboxUseCases,
} from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  Code,
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
 * 成果リンクの受信箱。
 *
 * 貼り付けられた URL が、どの広告主の、どの商品のものかを突き止めるまでの場所。
 * ここを通っていないリンクは記事に出さない。
 *
 * この画面に出る URL は、貼り付けられたままの形で表示する。
 * 見た目を整えるために書き換えると、ASP の規約に触れることがある。
 */
export default async function InboxPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly state?: string }>;
}) {
  const { state: requested } = await searchParams;
  const filter = LINK_INBOX_FILTERS.find((f) => f === requested) ?? "all";

  const actor = await currentActor();
  const useCases = await linkInboxUseCases();
  const [inbox, programs] = await Promise.all([
    useCases.list.execute(actor, { state: filter }),
    (await affiliateUseCases()).listPrograms.execute(actor, {}),
  ]);

  const programOptions: readonly ProgramOption[] = programs.ok
    ? programs.value.items.map((p) => ({
        value: p.programId,
        label: `${p.advertiserName}（${p.aspLabel}）`,
      }))
    : [];

  return (
    <AdminShell
      routeId="inbox"
      title="成果リンクの受信箱"
      lead="届いた成果リンクを、どの商品のものか決めます。"
      actions={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
    >
      {!inbox.ok ? (
        <ErrorView
          title="受信箱を出せませんでした"
          body={inbox.error.message}
          suggestedAction={inbox.error.suggestedAction ?? null}
          action={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await linkInboxNotice()} />

          <Prose>
            貼り付けられたリンクは、広告主と商品が決まるまで記事に出しません。順位づけの計算にも入りません。
          </Prose>

          <Section
            title="成果リンクを受け取る"
            lead="ASP で発行された URL をそのまま貼り付けてください。同じリンクが既にあるときも、消さずに受け取ったうえでお知らせします。"
          >
            <SubmitAffiliateUrlForm />
          </Section>

          <Section title="受信箱のようす">
            <FactList
              rows={[
                { key: "received", label: "未調査", value: `${inbox.value.countsByState.received}件` },
                {
                  key: "resolved",
                  label: "広告主が判明",
                  value: `${inbox.value.countsByState.resolved}件`,
                },
                {
                  key: "matched",
                  label: "結びつけ済み",
                  value: `${inbox.value.countsByState.matched}件`,
                },
                {
                  key: "rejected",
                  label: "対象外",
                  value: `${inbox.value.countsByState.rejected}件`,
                },
                {
                  key: "duplicate",
                  label: "重複しているもの",
                  value: `${inbox.value.duplicateCount}件`,
                },
              ]}
            />
            <ListView
              rows={LINK_INBOX_FILTERS.map((f) =>
                f === filter
                  ? { key: f, label: `${filterLabel(f)}（表示中）` }
                  : {
                      key: f,
                      label: `${filterLabel(f)}を見る`,
                      href: `/admin/inbox?state=${encodeURIComponent(f)}`,
                    },
              )}
            />
          </Section>

          {programs.ok && programOptions.length === 0 ? (
            <Callout
              tone="warn"
              title="提携プログラムが登録されていません"
              reason="広告主を決めるには、先に提携プログラムを登録する必要があります。"
              action={<TextLink href="/admin/affiliate">提携と成果の画面へ</TextLink>}
            />
          ) : null}
          {!programs.ok ? (
            <Callout
              tone="warn"
              title="提携プログラムの一覧を出せませんでした"
              reason={programs.error.suggestedAction ?? programs.error.message}
              action={<TextLink href="/admin/affiliate">提携と成果の画面へ</TextLink>}
            />
          ) : null}

          <Section title={`受け取ったリンク（${filterLabel(filter)}）`}>
            {inbox.value.total === 0 ? (
              <EmptyView
                title="表示するリンクがありません"
                body={inbox.value.emptyReason ?? "受信箱はからです。"}
                action={<TextLink href="/admin/inbox">すべてを見る</TextLink>}
              />
            ) : (
              <>
                <DataTable
                  caption="受け取ったリンクごとの、経路と状態と結びつけ先"
                  columns={[
                    { key: "submitted", label: "受け取り" },
                    { key: "host", label: "リンク先" },
                    { key: "source", label: "経路" },
                    { key: "state", label: "状態" },
                    { key: "program", label: "広告主" },
                    { key: "product", label: "商品" },
                  ]}
                  rows={inbox.value.items.map((item) => ({
                    key: item.id,
                    cells: [
                      item.submittedAt.toLocaleDateString("ja-JP"),
                      item.host,
                      item.sourceLabel,
                      item.stateLabel,
                      item.programLabel ?? "—",
                      item.productId ?? "—",
                    ],
                  }))}
                />
                <Note>「—」は、まだ決まっていないという意味です。該当なしではありません。</Note>

                {inbox.value.items.map((item) => (
                  <SubSection key={item.id} title={item.host}>
                    {/*
                      貼り付けられたままの形で出す。等幅にするのは、
                      合言葉が 1 文字違うと別のリンクになるため。
                    */}
                    <Note>
                      <Code>{item.submittedUrl}</Code>
                    </Note>
                    {item.duplicateOf === null ? null : (
                      <ActionNote tone="danger">
                        {`同じリンクが受信箱に既にあります（${item.duplicateOf}）。消さずに残しています。`}
                      </ActionNote>
                    )}
                    <AdvanceIngestionForm item={item} programs={programOptions} />
                  </SubSection>
                ))}
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
