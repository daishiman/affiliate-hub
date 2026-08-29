import { AdminShell } from "@/presentation/admin/admin-shell";
import { ListView, Prose, Section } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログの版面と中身の索引。
 *
 * この画面自体は何も保存しない。**行き先を選ぶだけ**の画面である。
 * 6 つの入口を 1 枚に集めているのは、どれも「読者が見る 1 本のブログ」を
 * 別の角度から触る操作で、どれから手を付けるかを先に決める必要があるため。
 */
export default async function BlogIndexPage() {
  return (
    <AdminShell
      routeId="blog"
      title="ブログの版面"
      lead="読者が見る 1 本のブログを、どの角度から直すか選びます。"
    >
      <Section title="どこを直しますか">
        <Prose>
          上の 3 つは「どこに何が出るか」の話、下の 3 つは「何が出るか」の話です。
          どちらか片方だけを直しても、読者の画面は変わらないことがあります。
        </Prose>
        <ListView
          rows={[
            {
              key: "layout",
              label: "版面の枠と帯",
              href: "/admin/blog/layout",
              note: "ヘッダー・サイドバー・フッターの枠と、トップに並ぶ帯の出し入れ。",
            },
            {
              key: "delivery",
              label: "配信の部品",
              href: "/admin/blog/delivery",
              note: "feed・sitemap など、機械が読む経路の出し入れ。",
            },
            {
              key: "pages",
              label: "固定ページ",
              href: "/admin/blog/pages",
              note: "運営者情報・広告表記など、運営が示すべきページ。",
            },
            {
              key: "articles",
              label: "記事",
              href: "/admin/blog/articles",
              note: "記事を作る・直す・公開する。",
            },
            {
              key: "tags",
              label: "タグ",
              href: "/admin/blog/tags",
              note: "記事をまとめる単位を整える。",
            },
            {
              key: "evaluate",
              label: "読者の評価",
              href: "/admin/blog/evaluate",
              note: "評価と鮮度から、次に手を入れる記事を選ぶ。",
            },
          ]}
        />
      </Section>
    </AdminShell>
  );
}
