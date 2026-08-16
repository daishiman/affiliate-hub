import Link from "next/link";
import { actorNotice, createToolCatalog } from "@/presentation/composition";
import { AppShell, Callout, Card, Page } from "@/presentation/ui";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 管理画面のホーム。
 *
 * ここで見せるのは「いま何ができるか」だけ。
 * 数字の羅列を並べない（見ても次の操作が決まらないため）。
 */
export default function AdminHome() {
  const tools = createToolCatalog();

  return (
    <AppShell currentPath="/admin" breadcrumbs={[{ label: "ホーム" }]}>
      <Page
        title="管理"
        lead="商品を調べ、根拠を集め、評価基準で並べ、記事にして配信するまでをここで行います。"
      >
        <Callout
          tone="warn"
          title="たたき台です"
          reason={actorNotice()}
          action={<Link href="/admin/settings">設定を見る</Link>}
        />

        <Card>
          <h2 className={styles.sectionTitle}>いま試せること</h2>
          <ul className={styles.linkList}>
            <li>
              <Link href="/admin/rankings">評価基準で商品を並べる</Link>
              <span className={styles.linkNote}>
                同じ結果が、画面からも AI からも返ることを確かめられます。
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
    </AppShell>
  );
}
