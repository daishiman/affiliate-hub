import Link from "next/link";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { Callout, Card, Page } from "@/presentation/ui";
import styles from "../../admin.module.css";

export default function NewContentPage() {
  return (
    <AdminShell currentPath="/admin/content" breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "記事", href: "/admin/content" }, { label: "新しい記事" }]} actions={<Link href="/admin/content">記事の一覧へ戻る</Link>}>
      <Page title="新しい記事を作る" lead="商品と根拠から原稿を作り、人の承認後にブログへ公開します。">
        <Callout tone="info" title="公開済み記事を直接複製しません" reason="新規記事は、根拠の確認・承認・公開ゲートを省略しない既存フローで作成します。" />
        <ol className={styles.creationSteps}>
          <li><Card><span>1</span><h2>素材を選ぶ</h2><p>扱う商品と、判断に必要な根拠を確かめます。</p><Link href="/admin/products">商品の一覧へ</Link></Card></li>
          <li><Card><span>2</span><h2>原稿を作る</h2><p>書き手・読者像・切り口を選び、必要な代表原稿を作ります。</p><Link href="/admin/content/matrix">生成マトリクスへ</Link></Card></li>
          <li><Card><span>3</span><h2>確認して公開する</h2><p>事実確認と承認を済ませ、配信画面でサイトとカテゴリーを選びます。</p><Link href="/admin/distribution">配信の一覧へ</Link></Card></li>
        </ol>
      </Page>
    </AdminShell>
  );
}
