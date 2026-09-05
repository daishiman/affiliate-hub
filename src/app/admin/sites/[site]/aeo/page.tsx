import { AEO_GAP_LABEL, ANSWER_UNIT_KIND_LABEL } from "@/domain/aeo/answer-unit";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  AeoExtractForm,
  AeoProfileForm,
} from "@/presentation/admin/publish/blog-improvement-form";
import { blogAeoEntry, currentActor } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * AEO（回答エンジン最適化）の画面。
 *
 * 見ているのは「この記事の中に、そのまま引用できる形の答えがあるか」で、
 * 検索順位ではない。回答エンジンは記事を丸ごとではなく、問いに答えている
 * 短い塊を取り出して使う。取り出せる塊が無い記事は、どれだけ内容が
 * 良くても引用されない。
 */
export default async function SiteAeoPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;

  const entry = await blogAeoEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="sites/[site]/aeo"
        routeParams={{ site: siteSlug }}
        breadcrumbLabels={{ "sites/[site]": "ブログ" }}
        title="AEO（回答エンジン）"
        lead="回答エンジンに引用される形になっているかを見ます。"
      >
        <ErrorView
          title="AEO を開けませんでした"
          body={entry.reason}
          suggestedAction={null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const result = await entry.manage.execute(await currentActor(), {
    action: "read",
    siteSlug,
  });

  return (
    <AdminShell
      routeId="sites/[site]/aeo"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": "ブログ" }}
      title="AEO（回答エンジン）"
      lead="回答エンジンが引用できる形になっているかを確かめ、足りない答えを補います。"
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="AEO を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : (
        <>
          {result.value.profile === null ? (
            <Callout
              tone="warn"
              title="このブログの構えをまだ決めていません"
              reason="何について誰に答えるかが決まっていないと、引用単位を取っても、それが的を射た答えかを判断できません。まず下の欄を埋めてください。"
            />
          ) : null}

          <Section title="このブログの構え">
            <AeoProfileForm siteSlug={siteSlug} profile={result.value.profile} />
          </Section>

          <Section title="引用単位を取り直す">
            <AeoExtractForm siteSlug={siteSlug} />
          </Section>

          <Section title="いま取れている引用単位">
            {result.value.units.length === 0 ? (
              <EmptyView
                title="引用できる形の答えがまだありません"
                body="記事の中に、問いとその答えが対になっている場所が見つかっていません。上から記事を指定して取り直してください。"
                action={null}
              />
            ) : (
              <>
                <Prose>
                  「足りないもの」の列が空の単位が、そのまま引用されうる形です。
                  埋まっている単位は、記事側を直さないと引用されません。
                </Prose>
                <DataTable
                  caption="記事から取れた引用単位と、その単位に足りないもの"
                  columns={[
                    { key: "article", label: "記事" },
                    { key: "kind", label: "種類" },
                    { key: "question", label: "答えている問い" },
                    { key: "position", label: "記事内の位置", numeric: true },
                    { key: "gaps", label: "足りないもの" },
                  ]}
                  rows={result.value.units.map(({ unit, gaps }) => ({
                    key: unit.id,
                    cells: [
                      unit.articleSlug,
                      ANSWER_UNIT_KIND_LABEL[unit.kind],
                      unit.question,
                      `${Math.round(unit.positionRatio * 100)}%`,
                      gaps.length === 0
                        ? "（なし）"
                        : gaps.map((gap) => AEO_GAP_LABEL[gap]).join("、"),
                    ],
                  }))}
                />
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
