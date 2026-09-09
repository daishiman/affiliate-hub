import Link from "next/link";
import { ErrorView, SitePage } from "@/presentation/ui";

/**
 * 知らないブログの住所を開いたときの画面。
 *
 * **`AppShell` を描かない。** 描くと、サイドバーにこのワークスペースの
 * 全ブログ名が並ぶ。「そのブログは無い」と答えながら、
 * 他のブログの存在を教えることになる (A4 の後半)。
 *
 * `SitePage` だけを使い、`AdminShell` も `PublicShell` も通さない。
 * 見出しの太さを CSS Modules から受け取るためで、裸の `<h1>` を書くと
 * Preflight に潰されて段落と同じ形で出る (`heading-is-visible.test.ts`)。
 *
 * 見た目が他の管理画面と違うのは意図である。ここは「入れなかった」報せであって、
 * 管理画面の中の 1 ページではない。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md §2.2
 */
export default function AdminSiteNotFound() {
  return (
    <SitePage title="このブログは開けません">
      <ErrorView
        title="指定されたブログが見つかりません"
        body="住所が古いか、いまのワークスペースのものではありません。"
        suggestedAction="ブログを選び直してください。"
        action={<Link href="/admin/sites">ブログを選ぶ</Link>}
      />
    </SitePage>
  );
}
