import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, platformUseCases, siteStorageNotice } from "@/presentation/composition";
import {
  Callout,
  Card,
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
 * ブログの一覧（運営者向け）。
 *
 * この画面が示したいのは「ブログを増やすのに新しいコードは要らない」こと。
 * 並んでいるブログはどれも同じ画面・同じ部品で動いていて、
 * 違うのは設計図の設定値とテーマの名前だけ。
 */
export default async function SitesPage() {
  const actor = await currentActor();
  const uc = (await platformUseCases());

  const [list, diff] = await Promise.all([
    uc.listSites.execute(actor, {}),
    uc.checkDifferentiation.execute(actor, {}),
  ]);

  if (!list.ok) {
    return (
      <Shell>
        <ErrorView
          title="ブログの一覧を出せませんでした"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const blocked = list.value.items.filter((s) => s.launchBlockedReason !== null);

  return (
    <Shell>
      <StorageNotice status={await siteStorageNotice()} />

      <Callout
        tone="info"
        title="ブログを増やすのに、コードは書きません"
        reason="13 の質問に答えると、設計図のデータが 1 本増えます。画面もルートも、いま並んでいるブログと同じものが使われます。"
        action={<Link href="/admin/sites/new">新しいブログを作る</Link>}
      />

      {list.value.total === 0 ? (
        <Card>
          <EmptyView
            title="ブログがありません"
            body={list.value.emptyReason ?? "まだブログがありません。"}
          />
        </Card>
      ) : (
        <>
          <Callout
            tone={blocked.length === 0 ? "info" : "warn"}
            title={
              blocked.length === 0
                ? `${list.value.total}本すべて、公開に必要な固定ページが揃っています`
                : `${blocked.length}本に、公開に必要な固定ページが足りません`
            }
            reason={
              blocked.length === 0
                ? "どのブログも同じ画面と同じ部品で動いています。増やすときに書き足すのは設定値だけです。"
                : "広告表記の説明先が無い記事を公開させないため、固定ページが揃うまで公開できません。"
            }
          />

          {list.value.items.map((site) => (
            <Card key={site.slug}>
              <SectionHeading level={2}>
                <Link href={`/admin/sites/${encodeURIComponent(site.slug)}`}>{site.name}</Link>
              </SectionHeading>
              <p className={styles.sectionLead}>
                {site.patternLabel} / {site.genre} / 収益の形: {site.revenueModelLabel}
              </p>
              <DefinitionList
                items={[
                  { term: "色の組み合わせ", description: site.brandTheme },
                  // 元から寄せの指定が無い。器を替えるついでに付け足さないこと
                  // ——見た目の判断は器の付け替えとは別の話で、混ぜると
                  // 「いつ誰が決めたのか」が差分から読めなくなる。
                  { term: "カテゴリー", description: `${site.categoryCount}件` },
                  { term: "出す画面", description: `${site.routeCount}種類` },
                ]}
              />
              {site.launchBlockedReason === null ? null : (
                <Callout
                  tone="warn"
                  title="いまは公開できません"
                  reason={site.launchBlockedReason}
                  action={
                    <Link href={`/admin/sites/${encodeURIComponent(site.slug)}`}>
                      足りないページを見る
                    </Link>
                  }
                />
              )}
              <Note>
                読者が見る画面: <Link href={`/s/${encodeURIComponent(site.slug)}`}>/s/{site.slug}</Link>
              </Note>
            </Card>
          ))}
        </>
      )}

      <Card>
        <SectionHeading level={2}>ブログどうしの違い</SectionHeading>
        <p className={styles.sectionLead}>
          扱う商品が近いブログが増えると、言い換えただけの記事になります。10
          個の観点のうち 3 個以上が違えば、別のブログとして成立していると見なします。
        </p>
        {!diff.ok ? (
          <ErrorView
            title="比較できませんでした"
            body={diff.error.message}
            suggestedAction={diff.error.suggestedAction ?? null}
          />
        ) : diff.value.pairs.length === 0 ? (
          <EmptyView
            title="比べる相手がいません"
            body={diff.value.emptyReason ?? "ブログが 1 本しかありません。"}
          />
        ) : (
          <StackedList>
            {diff.value.pairs.map((pair) => (
              <StackedRow key={`${pair.a}-${pair.b}`}>
                <Callout
                  tone={pair.sufficient ? "info" : "warn"}
                  title={`${pair.aName} と ${pair.bName}：違う観点 ${pair.differentAxisLabels.length}個`}
                  reason={
                    pair.sufficient
                      ? `違うのは ${pair.differentAxisLabels.join(" / ")} です。`
                      : `違うのは ${pair.differentAxisLabels.join(" / ") || "どの観点でもありません"} だけです。このままだと似た記事が並びます。`
                  }
                />
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
      currentPath="/admin/sites"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "サイト" }]}
      actions={<Link href="/admin/sites/new">新しいブログを作る</Link>}
    >
      <Page
        title="サイト"
        lead="運用しているブログの一覧です。増やすときに書き足すのは設定値だけで、画面のコードは共通のまま使います。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
