import Link from "next/link";
import { ErrorView, PublicShell, SitePage, UI_COPY } from "@/presentation/ui";

/**
 * 無いブログを開いたときの画面。
 *
 * **ここに置いてあること自体が、この画面の役目の半分である。**
 * 以前は `SiteFrame` の中で同じ内容を描いていたが、それだと通信の答えは 200 のままだった。
 * 読者の目には同じでも、検索エンジンには「実在するページ」として載り、
 * 公開後の見張り（スモークテスト）からも壊れと区別が付かなかった。
 * `notFound()` を投げてこのファイルに来ることで、404 と noindex が付く。
 *
 * 素っ気ない画面にして解決しない。行き止まりを作らないのは元の設計判断であり、
 * 変えたのは状態コードだけ。見出し・戻り先・言い直しの案内はそのまま残す。
 */
export default function SiteNotFound() {
  return (
    <PublicShell title="affiliate-hub">
      <SitePage title={UI_COPY.siteMissing.title}>
        <ErrorView
          title={UI_COPY.siteMissing.detailTitle}
          body={UI_COPY.siteMissing.body}
          suggestedAction={UI_COPY.siteMissing.suggestedAction}
          action={<Link href="/">{UI_COPY.siteMissing.backToList}</Link>}
        />
      </SitePage>
    </PublicShell>
  );
}
