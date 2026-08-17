import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { contentUseCases, currentActor, editorialContentNotice } from "@/presentation/composition";
import {
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
 * 記事の進行。
 *
 * 段階ごとに何本あるかを一望する画面。
 * 段階の並びと「次に進める先」は domain の遷移表から来る。
 * 画面側で段階を並べ直さない（並べ直すと、実際には進めない先を出してしまう）。
 */
export default async function ContentPage() {
  const actor = await currentActor();
  const uc = contentUseCases();

  const [board, overdue] = await Promise.all([
    uc.listBoard.execute(actor, {}),
    uc.listReviewOverdue.execute(actor, {}),
  ]);

  if (!board.ok) {
    return (
      <Shell>
        <ErrorView
          title="記事の一覧を出せませんでした"
          body={board.error.message}
          suggestedAction={board.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  // 1 本も無い段階は出さない。12 個の空欄が並ぶと、何を見る画面か分からなくなる。
  const used = board.value.columns.filter((c) => c.items.length > 0);

  return (
    <Shell>
      <StubNotice
        what="記事の保存先"
        blockedBy="content_packages / content_variants / personas テーブルの追加とマイグレーション"
        stubId="persistence:content-editorial-sample"
      >
        <span>{editorialContentNotice()}</span>
      </StubNotice>

      <Callout
        tone="info"
        title="承認と公開は人の操作が必要です"
        reason="承認・公開予約・公開へは、AI だけでは進められません。担当者が内容を確認してから操作します。"
        action={<Link href="/admin/rankings">評価基準を見る</Link>}
      />

      <Callout
        tone="info"
        title="どの組み合わせを作るか決める"
        reason="1 つの企画から、誰に向けて・どの切り口で・どの媒体へ出すかを表で選べます。全部を作らず、目的が重ならない代表だけを作ります。"
        action={<Link href="/admin/content/matrix">生成マトリクスを見る</Link>}
      />

      {board.value.total === 0 ? (
        <Card>
          <EmptyView
            title="記事がありません"
            body={board.value.emptyReason ?? "まだ記事がありません。"}
            action={<Link href="/admin/products">商品から企画を始める</Link>}
          />
        </Card>
      ) : (
        used.map((column) => (
          <Card key={column.state}>
            <h2 className={styles.sectionTitle}>
              {column.label}（{column.items.length}本）
            </h2>
            <p className={styles.sectionLead}>
              {column.nextStates.length === 0
                ? "ここから進める先はありません。"
                : `ここから進める先: ${column.nextStates.map((n) => n.label).join(" / ")}`}
              {column.humanOnlyNext.length > 0
                ? "（このうち承認・予約・公開は人の操作が必要です）"
                : ""}
            </p>
            <ul className={styles.linkList}>
              {column.items.map((item) => (
                <li key={item.variantId}>
                  <Link href={`/admin/content/${encodeURIComponent(item.variantId)}`}>
                    {item.title}
                  </Link>
                  <span className={styles.linkNote}>
                    {item.channel} / {item.summary}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <Card>
        <h2 className={styles.sectionTitle}>見直しの時期が来た記事</h2>
        {!overdue.ok ? (
          <ErrorView
            title="見直し対象を出せませんでした"
            body={overdue.error.message}
            suggestedAction={overdue.error.suggestedAction ?? null}
          />
        ) : overdue.value.items.length === 0 ? (
          <EmptyView
            title="見直しが必要な記事はありません"
            body={overdue.value.emptyReason ?? "期日を過ぎた記事はありません。"}
          />
        ) : (
          <ul className={styles.linkList}>
            {overdue.value.items.map((item) => (
              <li key={item.variantId}>
                <Link href={`/admin/content/${encodeURIComponent(item.variantId)}`}>
                  {item.title}
                </Link>
                <span className={styles.linkNote}>{item.summary}</span>
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
      currentPath="/admin/content"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "記事" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="記事"
        lead="いま何本がどの段階にあるかを見て、次に手を付けるものを決めます。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
