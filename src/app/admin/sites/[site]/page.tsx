import { BRAND_THEME_LABELS, COLOR_MODE_LABELS } from "@/domain/authoring/site-blueprint";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { adminOperation } from "@/presentation/admin/admin-operation-manifest";
import { DeleteConfirm } from "@/presentation/admin/delete-confirm";
import { deleteManagedSiteAction } from "@/presentation/admin/delete-form-action";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import {
  currentActor,
  platformUseCases,
  publicBlogAppearance,
  siteSampleNotice,
} from "@/presentation/composition";
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
          {/*
            固定ページ（運営者情報・各方針・規約・特商法表記）へ入る口。
            ここに置かないと、埋まっていない固定ページに気付けるのは
            フッターのリンクを踏んで 404 を見た読者だけになる。
          */}
          <TextLink href={`/admin/sites/${encodeURIComponent(siteSlug)}/documents`}>
            固定ページ
          </TextLink>
          {/*
            **見せ方と掲載の口を、ここに出す（P08 の移行）。**

            この 2 画面は P05 で足されたが、入口はどこにも無かった。
            住所を知っている人だけが開ける状態で、`/admin/sites/[site]` から
            辿れないので、配色を変えたい運営者はこの画面の「色の組み合わせ」を
            見て、それが読めない値だと気付かないまま引き返していた。
          */}
          <TextLink href={`/admin/sites/${encodeURIComponent(siteSlug)}/appearance`}>
            見せ方と配色
          </TextLink>
          <TextLink href={`/admin/sites/${encodeURIComponent(siteSlug)}/placements`}>
            掲載の台帳
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

/**
 * **設計図の配色をそのまま出さない（P08 の移行）。**
 *
 * 2026-08-30 まで、この画面は `blueprint.theme` の 4 項目を「このブログの配色」
 * として出していた。P05 が `blog_theme` / `page_theme_override` を足し、
 * 公開面はそちらを読むようになった時点で、**この画面の数字は読者に効かなくなった**。
 * それでも同じ場所に同じ顔で出ていたので、見分けはつかなかった。
 *
 * 読者に効いている値を読む口（`publicBlogAppearance`）を通す。管理画面から
 * 読んでも安全なのは、あれが読み取りだけで能力を要求しないためである。
 * 保存先が無い実行では `resolved: false` で設計図の値へ落ちる——そのときは
 * 「落ちた」と画面に書く。落ちたことを黙ると、また同じ取り違えが起きる。
 */
async function SiteBody({ siteSlug, value }: { readonly siteSlug: string; readonly value: SiteView }) {
  const operation = adminOperation("site.delete");
  const { summary, blueprint, routes, axes } = value;
  const emptyAxes = axes.filter((a) => a.value.trim() === "");
  const appearancePath = `/admin/sites/${encodeURIComponent(siteSlug)}/appearance`;
  const appearance = await publicBlogAppearance({
    siteSlug,
    pagePath: "/",
    fallback: {
      brandTheme: blueprint.theme.brandTheme,
      colorMode: blueprint.theme.colorScheme,
    },
  });

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
            {
              key: "llms",
              label: "AI 向けの案内ファイル",
              value: blueprint.emitLlmsTxt ? "出す" : "出さない",
            },
          ]}
        />
      </Section>

      {/*
        **配色は独立した節にする（P08 の移行）。**

        上の「位置づけ」に混ぜていたのが取り違えの原因だった。位置づけの項目は
        設計図に書いてあるものがそのまま読者に効くが、配色だけは
        `blog_theme` / `page_theme_override` を解決した結果が効く。
        出所の違う値を同じ表に並べると、片方だけ古いことに気付けない。
      */}
      <Section
        title="読者に出ている配色"
        lead="ここは設計図ではなく、保存された配色（ブログ既定とページ単位の例外）を解いた結果です。"
      >
        {/*
          **注意書き（Callout）にしない。** この画面の常時表示の注意書きは
          上限 2 個で（`tests/ui/uiux-spacing-and-copy.test.ts`）、既に
          「公開できません」と「観点が空欄」が使っている。3 個目を足すと、
          金銭と公開に関わる警告の重みが薄まる。ここは事実の断り書きなので
          値の並びの前に地の文で置く。
        */}
        {appearance.resolved ? null : (
          <Prose>
            保存された配色をまだ読めていません（保存先につながっていないか、このブログの配色を
            1 度も保存していない）。下の値は設計図の既定で、保存先のある実行では別の色が出ます。
          </Prose>
        )}
        <FactList
          rows={[
            {
              key: "brandTheme",
              label: "色の組み合わせ",
              value: BRAND_THEME_LABELS[appearance.appearance.brandTheme],
            },
            {
              key: "colorMode",
              label: "明暗の切り替え",
              value: COLOR_MODE_LABELS[appearance.appearance.colorMode],
            },
            /*
              余白と角丸は 2 層の対象外で、設計図の値がそのまま効く。
              **同じ表に置くが、出所を値の側に書く。** 書かないと
              「配色を変えたのに余白が変わらない」の理由が画面から消える。
            */
            {
              key: "density",
              label: "余白の詰め方",
              value: `${blueprint.theme.density === "compact" ? "詰める" : "ゆったり"}（設計図）`,
            },
            { key: "radius", label: "角の丸み", value: `${blueprint.theme.radius}（設計図）` },
          ]}
        />
        <Prose>
          変えるには <TextLink href={appearancePath}>見せ方と配色</TextLink> を開きます。
          この画面からは変えられません（同じものを 2 か所で直せると、後から書いたほうが
          静かに勝ちます）。
        </Prose>
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
