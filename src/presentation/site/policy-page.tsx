import { readerActor, siteUseCases } from "@/presentation/composition";
import { PolicyView, SitePage } from "@/presentation/ui";
import { NotFoundBody, SiteFrame } from "./page-frame";
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
  const result = await siteUseCases().getPolicy.execute(readerActor(), {
    siteSlug,
    key: documentKey,
  });

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
          <NotFoundBody what="この文書" siteSlug={siteSlug} />
        )
      }
    </SiteFrame>
  );
}
