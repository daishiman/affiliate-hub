import { fallbackCoverDataUri } from "@/application/seo/fallback-cover";
import { thumbnailHeightFor, thumbnailSeed } from "@/domain/blogops/thumbnail";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  adminOperation,
  adminOperationRouteId,
} from "@/presentation/admin/admin-operation-manifest";
import { currentActor, platformUseCases, siteStorageNotice } from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  EmptyView,
  ErrorView,
  FactList,
  Figure,
  Note,
  Prose,
  Section,
  Stack,
  StorageNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/** 一覧に並べる表紙の実寸。`THUMBNAIL_WIDTHS` の最小値を使う。 */
const COVER_WIDTH = 320;

/**
 * ブログ自身の表紙を組み立てる。
 *
 * 記事と同じ `thumbnailSeed` を通すのは、**運営者が管理画面で見た絵と、
 * 読者が一覧で見る絵の作られ方を 1 つにする**ため。ここだけ別の生成規則を
 * 置くと、配色を変えた日に片方だけ古い色のままになる。
 *
 * `slug` に記事では取り得ない値を入れているのは、同じブログの記事と
 * 表紙が同じ絵にならないようにするため（seed の材料に slug が入る）。
 */
function blogCoverDataUri(site: {
  readonly slug: string;
  readonly name: string;
  readonly genre: string;
  readonly brandTheme: string;
}): string {
  return fallbackCoverDataUri(
    thumbnailSeed({
      siteSlug: site.slug,
      slug: "__blog-cover__",
      title: site.name,
      categorySlug: site.genre,
      categoryName: site.genre,
      brandTheme: site.brandTheme,
    }),
  );
}

/**
 * ブログの一覧（運営者向け）。
 *
 * この画面が示したいのは「ブログを増やすのに新しいコードは要らない」こと。
 * 並んでいるブログはどれも同じ画面・同じ部品で動いていて、
 * 違うのは設計図の設定値とテーマの名前だけ。
 */
export default async function SitesPage() {
  const operation = adminOperation("site.list");
  const actor = await currentActor();
  const uc = await platformUseCases();

  const [list, diff] = await Promise.all([
    uc.listSites.execute(actor, {}),
    uc.checkDifferentiation.execute(actor, {}),
  ]);

  return (
    <AdminShell
      routeId={adminOperationRouteId(operation)}
      title="サイト"
      lead="運用しているブログの一覧です。"
      actions={<TextLink href="/admin/sites/new">新しいブログを作る</TextLink>}
    >
      {!list.ok ? (
        <ErrorView
          title="ブログの一覧を出せませんでした"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await siteStorageNotice()} />

          {list.value.total === 0 ? (
            <Section title="ブログ">
              <EmptyView
                title="ブログがありません"
                body={list.value.emptyReason ?? "まだブログがありません。"}
                action={<TextLink href="/admin/sites/new">新しいブログを作る</TextLink>}
              />
            </Section>
          ) : (
            <>
              <Callout
                tone="info"
                title={`${list.value.total}本のブログ設計図`}
                reason="実際の公開状態と不足内容は、各ブログの詳細で確認できます。"
                action={<TextLink href="/admin/sites/new">新しいブログを作る</TextLink>}
              />

              {list.value.items.map((site) => (
                <Section
                  key={site.slug}
                  title={site.name}
                  lead={`${site.patternLabel} / ${site.genre} / 収益の形: ${site.revenueModelLabel}`}
                >
                  <Figure
                    src={blogCoverDataUri(site)}
                    alt={`${site.name}の表紙（${site.brandTheme}）`}
                    width={COVER_WIDTH}
                    height={thumbnailHeightFor(COVER_WIDTH)}
                  />
                  <FactList
                    rows={[
                      { key: "theme", label: "色の組み合わせ", value: site.brandTheme },
                      { key: "categories", label: "カテゴリー", value: `${site.categoryCount}件` },
                      { key: "routes", label: "出す画面", value: `${site.routeCount}種類` },
                    ]}
                  />
                  <Note>
                    設計図と公開状態:{" "}
                    <TextLink href={`/admin/sites/${encodeURIComponent(site.slug)}`}>
                      {site.name}の詳細を見る
                    </TextLink>
                    ／読者が見る画面:{" "}
                    <TextLink href={`/s/${encodeURIComponent(site.slug)}`}>
                      /s/{site.slug}
                    </TextLink>
                  </Note>
                </Section>
              ))}
            </>
          )}

          <Section
            title="ブログどうしの違い"
            lead="10 個の観点のうち 3 個以上が違えば、別のブログとして成立していると見なします。"
          >
            <Prose>
              扱う商品が近いブログが増えると、言い換えただけの記事になります。
            </Prose>
            {!diff.ok ? (
              <ErrorView
                title="比較できませんでした"
                body={diff.error.message}
                suggestedAction={diff.error.suggestedAction ?? null}
              />
            ) : diff.value.pairs.length === 0 ? (
              <EmptyView
                title="比べる相手がいません"
                body={diff.value.emptyReason ?? "ブログが 1 本しかありません。"}
              />
            ) : (
              <Stack>
                {diff.value.pairs.map((pair) => (
                  <ActionNote
                    key={`${pair.a}-${pair.b}`}
                    tone={pair.sufficient ? "neutral" : "danger"}
                  >
                    {`${pair.aName} と ${pair.bName}：違う観点 ${pair.differentAxisLabels.length}個。`}
                    {pair.sufficient
                      ? `違うのは ${pair.differentAxisLabels.join(" / ")} です。`
                      : `違うのは ${
                          pair.differentAxisLabels.join(" / ") || "どの観点でもありません"
                        } だけです。このままだと似た記事が並びます。`}
                  </ActionNote>
                ))}
              </Stack>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
