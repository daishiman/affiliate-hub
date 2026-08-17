import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import { actorNotice, createToolCatalog, currentActor, dashboardUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  EmptyView,
  ErrorView,
  Page,
  WorkBoard,
} from "@/presentation/ui";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 管理画面のホーム (§22.1)。
 *
 * ここに並ぶ 11 個の数字は、どれも
 * 「値」「その数が何を意味するか」「解消できる画面」の 3 点セットで出す。
 * 数字だけを並べた画面は、見ても次の操作が決まらないので誰も見なくなる。
 *
 * 数え方は application 層の 1 つのユースケースが持っている。
 * 同じ答えが AI からも `get_dashboard` で返るため、
 * 「画面では 3 件なのに AI は 5 件と言う」が起きない。
 */
export default async function AdminHome() {
  const actor = await currentActor();
  const tools = createToolCatalog();
  const board = await dashboardUseCases().getDashboard.execute(actor, {});

  return (
    <AdminShell currentPath="/admin" breadcrumbs={[{ label: "ホーム" }]}>
      <Page
        title="管理"
        lead="商品を調べ、根拠を集め、評価基準で並べ、記事にして配信するまでをここで行います。"
      >
        <Callout
          tone="warn"
          title="たたき台です"
          reason={await actorNotice()}
          action={<Link href="/admin/settings">設定を見る</Link>}
        />

        <Card>
          <h2 className={styles.sectionTitle}>いま手当てが要ること</h2>
          {!board.ok ? (
            <ErrorView
              title="いまの状況を出せませんでした"
              body={board.error.message}
              suggestedAction={board.error.suggestedAction ?? null}
              action={<Link href="/admin/settings">設定を見る</Link>}
            />
          ) : (
            <>
              <p className={styles.sectionLead}>
                {board.value.period} 時点の状況です。数字を押すと、そこで手当てできる画面へ移ります。
              </p>

              {board.value.allClearReason === null ? (
                <Callout
                  tone="warn"
                  title={`${board.value.attentionCount}件の数字に手当てが要ります`}
                  reason="下の枠のうち、色が付いているものが対象です。上から順に片付ければ、公開が止まっている原因はなくなります。"
                />
              ) : (
                <EmptyView title="手当てが要るものはありません" body={board.value.allClearReason} />
              )}

              {board.value.unavailableCount === 0 ? null : (
                <Callout
                  tone="info"
                  title={`${board.value.unavailableCount}件は、まだ数えられません`}
                  reason="保存先の接続か、見る権限がまだ揃っていないためです。0 件とは書かず「いま数えられません」と出しています。"
                />
              )}

              <WorkBoard
                caption="いま手当てが要ることの一覧"
                items={board.value.widgets.map((w) => ({
                  key: w.key,
                  label: w.label,
                  valueLabel: w.valueLabel,
                  reason: w.reason,
                  tone: w.tone,
                  href: w.href,
                  actionLabel: w.actionLabel,
                  unavailableReason: w.unavailableReason,
                }))}
                renderLink={(href, label) => <Link href={href}>{label}</Link>}
              />
            </>
          )}
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>いま試せること</h2>
          <ul className={styles.linkList}>
            <li>
              <Link href="/admin/sites/new">新しいブログを作る</Link>
              <span className={styles.linkNote}>
                13 の質問に答えると、コードを書かずにブログが 1 本増えます。
              </span>
            </li>
            <li>
              <Link href="/admin/rankings">評価基準で商品を並べる</Link>
              <span className={styles.linkNote}>
                同じ結果が、画面からも AI からも返ることを確かめられます。
              </span>
            </li>
            <li>
              <Link href="/admin/ui-catalog">部品の見本帳を見る</Link>
              <span className={styles.linkNote}>
                すべての画面で使う部品と、その状態の見え方をまとめてあります。
              </span>
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>AI から使える操作</h2>
          <p className={styles.sectionLead}>
            下の操作は、この画面と同じ計算をそのまま使っています。
            画面と AI で違う答えが返ることはありません。
          </p>
          <ul className={styles.linkList}>
            {tools.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                <span className={styles.linkNote}>{tool.description}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Page>
    </AdminShell>
  );
}
