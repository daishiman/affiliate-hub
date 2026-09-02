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
  const platform = await platformUseCases();
  const result = await platform.getSite.execute(actor, { siteSlug });
  // 設計図が無い場合は、公開投影を追加で読まない。
  const composition = result.ok
    ? await platform.inspectComposition.execute(actor, { siteSlug })
    : null;

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
          <TextLink href="/admin/sites">ブログの一覧へ戻る</TextLink>
        </>
      }
    >
      {/*
        「開けるか」を設計図より**前**に出す。後ろに置くと、設計図が緑に見えたところで
        読み終える人がいて、開けないブログがそのまま読者に見え続ける。
      */}
      {composition?.ok ? (
        <SiteReachability value={composition.value} />
      ) : composition === null ? null : (
        <ErrorView
          title="このブログが読者に届くか、確かめられませんでした"
          body={composition.error.message}
          suggestedAction={composition.error.suggestedAction ?? null}
          action={null}
        />
      )}

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

type CompositionView = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof platformUseCases>>["inspectComposition"]["execute"]>
>;

/**
 * 「このブログは、いま読者から開けるのか」だけを答える節。
 *
 * ここに出る数は**設計図ではなく保存先を数え直したもの**である。
 * 設計図の側（下の節）は「そう作るつもりだった」を、ここは
 * 「実際にそう置かれている」を出す。この 2 つを 1 つの節に混ぜていたのが、
 * 13 問すべてに答えて緑の成功表示が出るのに `/s/<URL名>` が 404、
 * という食い違いの正体だった。
 *
 * 並びは「開けるか → 足りないもの → 内訳」。逆にすると、
 * 数字の表を読み解いた人だけが開けないことに気付ける形になる。
 */
function SiteReachability({
  value,
}: {
  readonly value: CompositionView;
}) {
  const 不足理由 =
    value.gaps.length === 0
      ? "読者に見せる構成を確認できませんでした。"
      : value.gaps.map((gap) => `${gap.label}がありません。${gap.remedy}`).join(" ");
  const warning = !value.reachable
    ? { title: "いま開いても 404 になります", reason: 不足理由 }
    : !value.contentReady
      ? { title: "読者から開けますが、公開準備は未完了です", reason: 不足理由 }
      : null;

  return (
    <Section
      title="このブログは読者に届くか"
      lead="設計図の予定数ではなく、読者向け画面が実際に使う公開内容を確認しています。"
    >
      {warning === null ? (
        <ActionNote>
          読者から開けます。固定ページ・版面・カテゴリー・記事も、公開画面に実在しています。
        </ActionNote>
      ) : (
        <Callout
          tone="warn"
          title={warning.title}
          reason={warning.reason}
        />
      )}

      {/*
        住所は 2 通りある。片方だけ出すと、基底ドメインを設定したのに
        管理画面はパスだけを案内し続ける、という食い違いに気付けない。
      */}
      <FactList
        rows={[
          { key: "path", label: "住所（パス）", value: value.readerPath },
          {
            key: "host",
            label: "住所（サブドメイン）",
            value: value.readerHost ?? "未設定（SITE_BASE_DOMAIN が空です）",
          },
        ]}
      />

      {/*
        足りない要素も**この表の中で**名指しする。表の外にもう 1 つ注意書きを置くと、
        同じことが 2 か所に書かれ、片方だけ直した状態が作れる。
      */}
      <DataTable
        caption="ブログを組み立てている要素と、いま置かれている数"
        columns={[
          { key: "label", label: "要素" },
          { key: "count", label: "件数" },
          { key: "severity", label: "無いときの状態" },
          { key: "remedy", label: "足りないときの直し方" },
          { key: "manage", label: "直す場所" },
        ]}
        rows={value.elements.map((element) => ({
          key: element.element,
          cells: [
            element.label,
            element.count === 0 ? "0（空）" : String(element.count),
            element.severity === "blocking" ? "読者画面が開かない" : "公開準備が未完了",
            element.remedy ?? "足りています",
            element.manageHref === null ? (
              "作り直すしかありません"
            ) : (
              <TextLink key={element.element} href={element.manageHref}>
                直しに行く
              </TextLink>
            ),
          ],
        }))}
      />

      {/*
        できたブログを**この画面の中で**見せる。別のタブで開かせると、
        直す画面と見る画面が行き来になり、直した結果を見ないまま次へ進む。
        開けないときは出さない（404 の枠を見せても直し方は分からない）。
      */}
      {value.reachable ? (
        <iframe
          src={value.readerPath}
          title="できたブログの下見"
          style={{ width: "100%", height: "32rem", border: "1px solid currentColor" }}
        />
      ) : null}
    </Section>
  );
}

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

      {/*
        公開できるかは「このブログは読者に届くか」の節へ移した。
        開けるか（保存先の行）と公開できるか（固定ページ）は同じ問いの裏表で、
        別々の注意書きにすると片方だけ緑という並びが作れる。
      */}

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
