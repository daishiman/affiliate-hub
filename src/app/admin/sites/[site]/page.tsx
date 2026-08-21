import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, platformUseCases, siteSampleNotice } from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
  DefinitionList,
  EmptyView,
  ErrorView,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StubNotice,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * ブログ 1 本の設計図。
 *
 * 「このブログだけ特別扱いする」ための画面ではない。
 * ここに出ている項目がブログの違いのすべてであり、
 * 足りない項目があれば設計図に欄を足す。画面に分岐を足さない。
 */
export default async function SiteDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const actor = await currentActor();
  const result = await (await platformUseCases()).getSite.execute(actor, { siteSlug });

  if (!result.ok) {
    return (
      <Shell title="ブログ">
        <ErrorView
          title="このブログを表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/sites">ブログの一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { summary, blueprint, routes, axes } = result.value;
  const emptyAxes = axes.filter((a) => a.value.trim() === "");

  return (
    <Shell title={summary.name}>
      <StubNotice
        what="ブログの設計図の保存先"
        blockedBy="site_blueprints テーブルの追加とマイグレーション"
        stubId="persistence:site-sample"
      >
        <span>{siteSampleNotice()}</span>
      </StubNotice>

      <Card>
        <SectionHeading level={2}>このブログの位置づけ</SectionHeading>
        <p className={styles.sectionLead}>{blueprint.purpose}</p>
        <DefinitionList
          items={[
            { term: "型", description: summary.patternLabel },
            { term: "扱う分野", description: blueprint.genre },
            { term: "収益の形", description: summary.revenueModelLabel },
            { term: "色の組み合わせ", description: blueprint.theme.brandTheme },
            {
              term: "余白の詰め方",
              description: blueprint.theme.density === "compact" ? "詰める" : "ゆったり",
            },
            { term: "角の丸み", description: blueprint.theme.radius },
            { term: "明暗の切り替え", description: blueprint.theme.colorScheme },
            {
              term: "AI 向けの案内ファイル",
              description: blueprint.emitLlmsTxt ? "出す" : "出さない",
            },
          ]}
        />
      </Card>

      {summary.launchBlockedReason === null ? (
        <Callout
          tone="info"
          title="公開に必要な固定ページは揃っています"
          reason="広告の扱い・訂正の履歴・問い合わせ先など、読者が確かめる先がすべてあります。"
        />
      ) : (
        <Callout
          tone="warn"
          title="いまは公開できません"
          reason={summary.launchBlockedReason}
        />
      )}

      <Card>
        <SectionHeading level={2}>ほかのブログとの違い（10 個の観点）</SectionHeading>
        {emptyAxes.length > 0 ? (
          <Callout
            tone="warn"
            title={`${emptyAxes.length}個の観点が空欄です`}
            reason={`空欄のまま記事を作ると、ほかのブログの言い換えになります（${emptyAxes
              .map((a) => a.label)
              .join(" / ")}）。`}
          />
        ) : null}
        <DefinitionList
          items={axes.map((axis) => ({
            term: axis.label,
            description: axis.value.trim() === "" ? "未記入" : axis.value,
          }))}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>カテゴリー（{blueprint.categories.length}件）</SectionHeading>
        {blueprint.categories.length === 0 ? (
          <EmptyView
            title="カテゴリーがありません"
            body="読者の入口が無い状態です。少なくとも 1 件は必要です。"
          />
        ) : (
          <StackedList>
            {blueprint.categories.map((c) => (
              <StackedRow key={c.slug} note={<>{c.oneLine} / 最初に作る記事: {c.initialArticleTypes.join("・")}</>}>
                <Link href={`/s/${encodeURIComponent(summary.slug)}/categories/${c.slug}`}>
                  {c.name}
                </Link>
                
              </StackedRow>
            ))}
          </StackedList>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>出す画面（{routes.length}種類）</SectionHeading>
        <p className={styles.sectionLead}>
          どこから来るかを必ず書いています。どこからも辿り着けない画面を作らないためです。
        </p>
        <DataTable
          caption="このブログが持つ画面と、その住所・たどり着き方・広告表示の要否。"
          columns={[
            { key: "label", header: "画面", rowHeader: true, cell: (route) => route.label },
            { key: "path", header: "住所", cell: (route) => route.path },
            { key: "from", header: "どこから来るか", cell: (route) => route.reachedFrom },
            {
              key: "disclosure",
              header: "広告表示",
              cell: (route) => (route.requiresDisclosure ? "必要" : "不要"),
            },
          ]}
          rows={routes}
          rowKey={(route) => route.key}
        />
      </Card>
    </Shell>
  );
}

function Shell({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/sites"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "サイト", href: "/admin/sites" },
        { label: title },
      ]}
      actions={<Link href="/admin/sites">ブログの一覧へ戻る</Link>}
    >
      <Page title={title} lead="このブログの設計図です。ほかのブログとの違いはここに書いてある内容がすべてです。">
        {children}
      </Page>
    </AdminShell>
  );
}
