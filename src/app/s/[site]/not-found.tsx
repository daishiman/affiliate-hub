import Link from "next/link";
import { ErrorView, PublicShell, SitePage, UI_COPY } from "@/presentation/ui";

/**
 * 読者側で「無いもの」を開いたときの画面。
 *
 * **ここに置いてあること自体が、この画面の役目の半分である。**
 * 以前は `SiteFrame` の中で同じ内容を描いていたが、それだと通信の答えは 200 のままだった。
 * 読者の目には同じでも、検索エンジンには「実在するページ」として載り、
 * 公開後の見張り（スモークテスト）からも壊れと区別が付かなかった。
 * `notFound()` を投げてこのファイルに来ることで、404 と noindex が付く。
 *
 * 受け先は **`s/[site]` 配下すべてで 1 枚**。無いブログ名（項目 32）だけでなく、
 * 実在するブログの中の無い記事・商品・書き手・監修者・カテゴリー・道具（項目 36）も
 * ここへ来る。`[site]` を受け取れない以上、どちらが無かったのかを書き分けると
 * 必ずどちらかで嘘になるので、文言は `UI_COPY.pageMissing` に 1 つだけ置く。
 *
 * 素っ気ない画面にして解決しない。行き止まりを作らないのは元の設計判断であり、
 * 変えたのは状態コードだけ。見出し・戻り先・言い直しの案内はそのまま残す。
 */
export default function SiteNotFound() {
  return (
    <PublicShell title="affiliate-hub">
      <SitePage title={UI_COPY.pageMissing.title}>
        <ErrorView
          title={UI_COPY.pageMissing.detailTitle}
          body={UI_COPY.pageMissing.body}
          suggestedAction={UI_COPY.pageMissing.suggestedAction}
          action={<Link href="/">{UI_COPY.pageMissing.backToList}</Link>}
        />
      </SitePage>
    </PublicShell>
  );
}
