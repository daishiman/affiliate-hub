import {
  AdvanceIngestionForm,
  type ProgramOption,
  SubmitAffiliateUrlForm,
} from "@/presentation/admin/inbox-forms";
import {
  affiliateUseCases,
  currentActor,
  linkInboxNotice,
  linkInboxUseCases,
} from "@/presentation/composition";
import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  filterLabel,
  LINK_INBOX_FILTERS,
} from "@/application/usecases/monetization/manage-link-inbox";
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
  StorageNotice,
} from "@/presentation/ui";
import styles from "../admin.module.css";

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

  if (!inbox.ok) {
    return (
      <Shell>
        <ErrorView
          title="受信箱を出せませんでした"
          body={inbox.error.message}
          suggestedAction={inbox.error.suggestedAction ?? null}
          action={<Link href="/admin/affiliate">提携と成果へ戻る</Link>}
        />
      </Shell>
    );
  }

  const programOptions: readonly ProgramOption[] = programs.ok
    ? programs.value.items.map((p) => ({
        value: p.programId,
        label: `${p.advertiserName}（${p.aspLabel}）`,
      }))
    : [];

  const counts = inbox.value.countsByState;

  return (
    <Shell>
      <StorageNotice status={await linkInboxNotice()} />

      <Callout
        tone="info"
        title="受信箱の役目"
        reason="貼り付けられたリンクは、広告主と商品が決まるまで記事に出しません。順位づけの計算にも入りません。"
      />

      <Card>
        <SectionHeading level={2}>成果リンクを受け取る</SectionHeading>
        <p className={styles.sectionLead}>
          ASP で発行された URL をそのまま貼り付けてください。
          同じリンクが既にあるときも、消さずに受け取ったうえでお知らせします。
        </p>
        <SubmitAffiliateUrlForm />
      </Card>

      <Card>
        <SectionHeading level={2}>受信箱のようす</SectionHeading>
        <DefinitionList
          items={[
            { term: "未調査", description: `${counts.received}件`, align: "numeric" },
            { term: "広告主が判明", description: `${counts.resolved}件`, align: "numeric" },
            { term: "結びつけ済み", description: `${counts.matched}件`, align: "numeric" },
            { term: "対象外", description: `${counts.rejected}件`, align: "numeric" },
            {
              term: "重複しているもの",
              description: `${inbox.value.duplicateCount}件`,
              align: "numeric",
            },
          ]}
        />
        <StackedList>
          {LINK_INBOX_FILTERS.map((f) => (
            <StackedRow key={f}>
              {f === filter ? (
                <span>{filterLabel(f)}（表示中）</span>
              ) : (
                <Link href={`/admin/inbox?state=${encodeURIComponent(f)}`}>
                  {filterLabel(f)}を見る
                </Link>
              )}
            </StackedRow>
          ))}
        </StackedList>
      </Card>

      {programs.ok && programOptions.length === 0 ? (
        <Callout
          tone="warn"
          title="提携プログラムが登録されていません"
          reason="広告主を決めるには、先に提携プログラムを登録する必要があります。"
          action={<Link href="/admin/affiliate">提携と成果の画面へ</Link>}
        />
      ) : null}
      {!programs.ok ? (
        <Callout
          tone="warn"
          title="提携プログラムの一覧を出せませんでした"
          reason={programs.error.suggestedAction ?? programs.error.message}
          action={<Link href="/admin/affiliate">提携と成果の画面へ</Link>}
        />
      ) : null}

      <Card>
        <SectionHeading level={2}>受け取ったリンク（{filterLabel(filter)}）</SectionHeading>
        {inbox.value.total === 0 ? (
          <EmptyView
            title="表示するリンクがありません"
            body={inbox.value.emptyReason ?? "受信箱はからです。"}
            action={<Link href="/admin/inbox">すべてを見る</Link>}
          />
        ) : (
          <>
            <DataTable
              caption="受け取ったリンクの一覧。受け取った日の順に並べる。"
              columns={[
                {
                  key: "submittedAt",
                  header: "受け取り",
                  rowHeader: true,
                  cell: (item) => item.submittedAt.toLocaleDateString("ja-JP"),
                },
                { key: "host", header: "リンク先", cell: (item) => item.host },
                { key: "source", header: "経路", cell: (item) => item.sourceLabel },
                { key: "state", header: "状態", cell: (item) => item.stateLabel },
                { key: "program", header: "広告主", cell: (item) => item.programLabel ?? "—" },
                { key: "product", header: "商品", cell: (item) => item.productId ?? "—" },
              ]}
              rows={inbox.value.items}
              rowKey={(item) => item.id}
            />
            <Note>
              「—」は、まだ決まっていないという意味です。該当なしではありません。
            </Note>

            {inbox.value.items.map((item) => (
              <div key={item.id} className={styles.catalogStack}>
                <SectionHeading level={3}>{item.host}</SectionHeading>
                <Note>{item.submittedUrl}</Note>
                {item.duplicateOf === null ? null : (
                  <Callout
                    tone="warn"
                    reason={`同じリンクが受信箱に既にあります（${item.duplicateOf}）。消さずに残しています。`}
                  />
                )}
                <AdvanceIngestionForm item={item} programs={programOptions} />
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
      currentPath="/admin/inbox"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "成果リンクの受信箱" }]}
      actions={<Link href="/admin/affiliate">提携と成果へ戻る</Link>}
    >
      <Page
        title="成果リンクの受信箱"
        lead="貼り付けられた成果リンクを受け取り、どの広告主の、どの商品のものかを決める画面です。ここを通るまで記事には出しません。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
