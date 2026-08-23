import { AdminShell } from "@/presentation/admin/admin-shell";
import { adminOperation } from "@/presentation/admin/admin-operation-manifest";
import { DeleteConfirm } from "@/presentation/admin/delete-confirm";
import { deleteManagedSiteAction } from "@/presentation/admin/delete-form-action";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import { currentActor, platformUseCases, siteSampleNotice } from "@/presentation/composition";
import { hasSiteOverrides, siteOverrideReason } from "@/presentation/sites";
import {
  ActionNote,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  FactList,
  ListView,
  Prose,
  Section,
  StubNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログ 1 本の設計図。
 *
 * 「このブログだけ特別扱いする」ための画面ではない。
 * ここに出ている項目がブログの違いのすべてであり、
 * 足りない項目があれば設計図に欄を足す。画面に分岐を足さない。
 */
export default async function SiteDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const actor = await currentActor();
  const result = await (await platformUseCases()).getSite.execute(actor, { siteSlug });

  /*
    骨格を 2 回書かない。失敗しても出す骨格は同じで、変わるのは題と中身だけ。
    早期 return で骨格ごと分けると、パンくずや戻り先を片方だけ直した状態が作れる。
  */
  const title = result.ok ? result.value.summary.name : "ブログ";

  return (
    <AdminShell
      routeId="sites/[site]"
      routeParams={{ site: siteSlug }}
      title={title}
      lead="このブログの設計図です。違いはここがすべて。"
      actions={
        <>
          <TextLink href={`/admin/sites/${encodeURIComponent(siteSlug)}/edit`}>
            このブログを直す
          </TextLink>
          <TextLink href="/admin/sites">ブログの一覧へ戻る</TextLink>
        </>
      }
    >
      {result.ok ? (
        <SiteBody siteSlug={siteSlug} value={result.value} />
      ) : (
        <ErrorView
          title="このブログを表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/sites">ブログの一覧へ戻る</TextLink>}
        />
      )}
    </AdminShell>
  );
}

type SiteView = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof platformUseCases>>["getSite"]["execute"]>
>;

function SiteBody({ siteSlug, value }: { readonly siteSlug: string; readonly value: SiteView }) {
  const operation = adminOperation("site.delete");
  const { summary, blueprint, routes, axes } = value;
  const emptyAxes = axes.filter((a) => a.value.trim() === "");

  return (
    <>
      <StubNotice
        what="ブログの設計図の保存先"
        blockedBy="site_blueprints テーブルの追加とマイグレーション"
        stubId="persistence:site-sample"
      >
        {siteSampleNotice()}
      </StubNotice>

      <Section title="このブログの位置づけ" lead={blueprint.purpose}>
        <FactList
          rows={[
            { key: "pattern", label: "型", value: summary.patternLabel },
            { key: "genre", label: "扱う分野", value: blueprint.genre },
            { key: "revenue", label: "収益の形", value: summary.revenueModelLabel },
            { key: "theme", label: "色の組み合わせ", value: blueprint.theme.brandTheme },
            {
              key: "density",
              label: "余白の詰め方",
              value: blueprint.theme.density === "compact" ? "詰める" : "ゆったり",
            },
            { key: "radius", label: "角の丸み", value: blueprint.theme.radius },
            { key: "scheme", label: "明暗の切り替え", value: blueprint.theme.colorScheme },
            {
              key: "llms",
              label: "AI 向けの案内ファイル",
              value: blueprint.emitLlmsTxt ? "出す" : "出さない",
            },
          ]}
        />
      </Section>

      {summary.launchBlockedReason === null ? (
        <ActionNote>
          公開に必要な固定ページは揃っています。広告の扱い・訂正の履歴・問い合わせ先など、読者が確かめる先がすべてあります。
        </ActionNote>
      ) : (
        <Callout tone="warn" title="いまは公開できません" reason={summary.launchBlockedReason} />
      )}

      <Section title="ほかのブログとの違い（10 個の観点）">
        {emptyAxes.length > 0 ? (
          <Callout
            tone="warn"
            title={`${emptyAxes.length}個の観点が空欄です`}
            reason={`空欄のまま記事を作ると、ほかのブログの言い換えになります（${emptyAxes
              .map((a) => a.label)
              .join(" / ")}）。`}
          />
        ) : null}
        <FactList
          rows={axes.map((axis) => ({
            key: axis.key,
            label: axis.label,
            value: axis.value.trim() === "" ? "未記入" : axis.value,
          }))}
        />
      </Section>

      {/*
        例外が積み上がっていることに、コードを読む人以外も気付ける場所。
        README はリポジトリを開く人しか見ない。運用する人の側にも同じ数字を出す。
      */}
      <Section title="このブログ専用の部品">
        <Prose>
          {hasSiteOverrides(blueprint.id)
            ? (siteOverrideReason(blueprint.id) ?? "理由が記録されていません。")
            : "ありません。共通の部品と設計図の項目だけで作られています。"}
        </Prose>
      </Section>

      <Section title={`カテゴリー（${blueprint.categories.length}件）`}>
        {blueprint.categories.length === 0 ? (
          <EmptyView
            title="カテゴリーがありません"
            body="読者の入口が無い状態です。少なくとも 1 件は必要です。"
          />
        ) : (
          <ListView
            rows={blueprint.categories.map((c) => ({
              key: c.slug,
              label: c.name,
              href: `/s/${encodeURIComponent(summary.slug)}/categories/${c.slug}`,
              note: `${c.oneLine} / 最初に作る記事: ${c.initialArticleTypes.join("・")}`,
            }))}
          />
        )}
      </Section>

      <Section
        title={`出す画面（${routes.length}種類）`}
        lead="どこから来るかを必ず書いています。どこからも辿り着けない画面を作らないためです。"
      >
        <DataTable
          caption="このブログが出す画面と、その入口"
          columns={[
            { key: "label", label: "画面" },
            { key: "path", label: "住所" },
            { key: "from", label: "どこから来るか" },
            { key: "disclosure", label: "広告表示" },
          ]}
          rows={routes.map((route) => ({
            key: route.key,
            cells: [
              route.label,
              route.path,
              route.reachedFrom,
              route.requiresDisclosure ? "必要" : "不要",
            ],
          }))}
        />
      </Section>

      <Section title="このブログを取り下げる">
        <DeleteConfirm
          action={deleteManagedSiteAction}
          toolName={operation.tool}
          toolDescription="ブログを取り下げる（読者に出ている記事が残っていれば断られる）"
          idName="siteSlug"
          idValue={siteSlug}
          label={summary.name}
          verb="取り下げる"
          consequence="読者に出ている記事が残っていれば、本数を返して断られます。先にブログを消すと、記事の側から自分がどこに載っていたか辿れなくなり、訂正も取り下げもできなくなります。"
        />
      </Section>
    </>
  );
}
