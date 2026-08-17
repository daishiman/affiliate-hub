import { createExplainTelemetryUseCase } from "@/application/usecases/analytics/explain-telemetry";
import { readerActor } from "@/presentation/composition";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref } from "@/presentation/site/view-model";
import { readConsentChoice } from "@/presentation/telemetry/consent-server";
import { PolicyView, SitePage } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 計測についての説明（読者向け）。
 *
 * 中身は**計測の登録表そのもの**から作る。画面に一覧を書き写さない。
 * 書き写すと、計測を 1 つ足したときにここだけ古いまま残る。
 * 「説明しているつもりで、説明していない」が最も起きやすい形なので、
 * 出どころを 1 つにしてある。
 */
export default async function MeasurementPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  const consent = await readConsentChoice();
  const result = await createExplainTelemetryUseCase().execute(readerActor(), { consent });

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, "/measurement")}
      trail={[{ label: "計測について" }]}
    >
      {() => {
        if (!result.ok) {
          return (
            <SitePage title="計測について">
              <PolicyView paragraphs={[result.error.message]} />
            </SitePage>
          );
        }
        const v = result.value;
        const paragraphs = [
          `いまの状態: ${v.consentLabel}`,
          "",
          "【記録していること】",
          ...v.rows.map(
            (r) =>
              `・${r.label}（${r.categoryLabel}）… ${r.why} ${r.consentLabel}。${r.retentionDays} 日で消します。記録する項目: ${r.fieldNames.join("、")}`,
          ),
          "",
          "【記録しないこと】",
          ...v.neverRecorded.map((n) => `・${n}`),
          "",
          "【保存する期間】",
          ...v.retentionSummary.map((n) => `・${n}`),
          "",
          "【取り消す方法】",
          v.howToWithdraw,
        ];
        return (
          <SitePage
            title="計測について"
            lead="記事の直しどころを探すために、読まれ方を記録しています。何を記録し、何を記録しないかをすべて書いています。"
          >
            <PolicyView paragraphs={paragraphs} />
          </SitePage>
        );
      }}
    </SiteFrame>
  );
}
