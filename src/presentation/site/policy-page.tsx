import { readerActor, siteUseCases } from "@/presentation/composition";
import { PolicyView, SitePage } from "@/presentation/ui";
import { ReadFailureBody, SiteFrame, stopIfMissing } from "./page-frame";
import { siteHref } from "./view-model";

/**
 * 方針などの固定文書の画面。
 *
 * 評価方法・編集方針・広告方針・AI の使い方・個人情報・利用規約の 6 本が
 * すべてこれを使う。**文言を画面に直接書かない。**
 * 書くと、広告方針の言い回しを直したときに記事側の表示と食い違う。
 */
export async function PolicyPage({
  siteSlug,
  documentKey,
  path,
}: {
  readonly siteSlug: string;
  readonly documentKey: string;
  readonly path: string;
}) {
  const result = await (await siteUseCases()).getPolicy.execute(readerActor(), {
    siteSlug,
    key: documentKey,
  });

  /*
    文書の鍵は 6 本のルートに直書きなので、通常ここは通らない。それでも他の 4 箇所と
    同じに書くのは、**ここだけ書き方が違うと「この画面は例外でよい」の前例になる**ため。
    設計図から方針を消せる日が来たとき、この 1 行の有無で 200 に戻る。（項目 36）
  */
  if (!result.ok) stopIfMissing(result.error);

  return (
    <SiteFrame
      siteSlug={siteSlug}
      currentPath={siteHref(siteSlug, path)}
      trail={[{ label: result.ok ? result.value.title : "文書" }]}
    >
      {() =>
        result.ok ? (
          <SitePage title={result.value.title}>
            <PolicyView paragraphs={result.value.body} />
          </SitePage>
        ) : (
          <ReadFailureBody what="この文書" siteSlug={siteSlug} />
        )
      }
    </SiteFrame>
  );
}
