import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  adminOperation,
  adminOperationRouteId,
} from "@/presentation/admin/admin-operation-manifest";
import { contentUseCases, currentActor, editorialContentNotice } from "@/presentation/composition";
import {
  Callout,
  EmptyView,
  ErrorView,
  ListView,
  Section,
  StorageNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事の進行。
 *
 * 段階ごとに何本あるかを一望する画面。
 * 段階の並びと「次に進める先」は domain の遷移表から来る。
 * 画面側で段階を並べ直さない（並べ直すと、実際には進めない先を出してしまう）。
 */
export default async function ContentPage() {
  const operation = adminOperation("content.list");
  const actor = await currentActor();
  const uc = await contentUseCases();

  const [board, overdue] = await Promise.all([
    uc.listBoard.execute(actor, {}),
    uc.listReviewOverdue.execute(actor, {}),
  ]);

  // 1 本も無い段階は出さない。12 個の空欄が並ぶと、何を見る画面か分からなくなる。
  const used = board.ok ? board.value.columns.filter((c) => c.items.length > 0) : [];

  return (
    <AdminShell
      routeId={adminOperationRouteId(operation)}
      title="記事"
      lead="どの段階に何本あるかを見ます。"
      actions={
        <>
          <TextLink href="/admin/content/new">記事を作る</TextLink>
          <TextLink href="/admin/content/published">公開済み記事</TextLink>
          <TextLink href="/admin">ホームへ戻る</TextLink>
        </>
      }
    >
      {!board.ok ? (
        <ErrorView
          title="記事の一覧を出せませんでした"
          body={board.error.message}
          suggestedAction={board.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await editorialContentNotice()} />

          <Callout
            tone="info"
            title="承認と公開は人の操作が必要です"
            reason="承認・公開予約・公開へは、AI だけでは進められません。担当者が内容を確認してから操作します。"
            action={<TextLink href="/admin/rankings">評価基準を見る</TextLink>}
          />

          <Callout
            tone="info"
            title="どの組み合わせを作るか決める"
            reason="1 つの企画から、誰に向けて・どの切り口で・どの媒体へ出すかを表で選べます。全部を作らず、目的が重ならない代表だけを作ります。"
            action={<TextLink href="/admin/content/matrix">生成マトリクスを見る</TextLink>}
          />

          {board.value.total === 0 ? (
            <Section title="記事">
              <EmptyView
                title="記事がありません"
                body={board.value.emptyReason ?? "まだ記事がありません。"}
                action={<TextLink href="/admin/products">商品から企画を始める</TextLink>}
              />
            </Section>
          ) : (
            used.map((column) => (
              <Section
                key={column.state}
                title={`${column.label}（${column.items.length}本）`}
                lead={`${
                  column.nextStates.length === 0
                    ? "ここから進める先はありません。"
                    : `ここから進める先: ${column.nextStates.map((n) => n.label).join(" / ")}`
                }${
                  column.humanOnlyNext.length > 0
                    ? "（このうち承認・予約・公開は人の操作が必要です）"
                    : ""
                }`}
              >
                <ListView
                  rows={column.items.map((item) => ({
                    key: item.variantId,
                    label: item.title,
                    href: `/admin/content/${encodeURIComponent(item.variantId)}`,
                    note: `${item.channel} / ${item.summary}`,
                  }))}
                />
              </Section>
            ))
          )}

          <Section title="見直しの時期が来た記事">
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
              <ListView
                rows={overdue.value.items.map((item) => ({
                  key: item.variantId,
                  label: item.title,
                  href: `/admin/content/${encodeURIComponent(item.variantId)}`,
                  note: item.summary,
                }))}
              />
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
