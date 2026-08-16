import { readerActor, siteUseCases } from "@/presentation/composition";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref, toCorrectionViews } from "@/presentation/site/view-model";
import { CorrectionList, ErrorView, SitePage } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 訂正の履歴。
 *
 * 0 件でも画面を出す。「訂正が無い」ことと「訂正の記録を残していない」ことは
 * 読者から見て別のことなので、無言にしない。
 */
export default async function CorrectionsPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  const result = await siteUseCases().listCorrections.execute(readerActor(), { siteSlug: site });

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, "/corrections")}
      trail={[{ label: "訂正" }]}
    >
      {() => (
        <SitePage
          title="訂正"
          lead="公開後に誤りが分かった箇所と、その理由をここに残しています。"
        >
          {result.ok ? (
            <CorrectionList
              corrections={toCorrectionViews(site, result.value)}
              emptyBody="これまでに訂正した箇所はありません。誤りが分かった場合はここに記録します。"
            />
          ) : (
            <ErrorView
              title="訂正の記録を読み込めませんでした"
              body={result.error.suggestedAction ?? result.error.message}
            />
          )}
        </SitePage>
      )}
    </SiteFrame>
  );
}
