import {
  DEFAULT_MATRIX_LIMIT,
  DEFAULT_MATRIX_ROW_AXIS,
  MATRIX_ROW_AXES,
  MATRIX_ROW_AXIS_LABEL,
  type MatrixRowAxis,
} from "@/application/usecases/authoring/plan-generation-matrix";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { createConceptDraftsAction } from "@/presentation/admin/concept-drafts-action";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import {
  contentPackageUseCases,
  currentActor,
  editorialContentNotice,
  generationMatrixUseCases,
  platformUseCases,
  productDisplayName,
} from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";
import {
  Callout,
  ConceptMatrixLauncher,
  DataTable,
  EmptyView,
  ErrorView,
  FactList,
  ListView,
  Prose,
  Section,
  StorageNotice,
  type StorageStatus,
  SubSection,
  TextLink,
  toConceptAxes,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/** 上限として選べる本数。数を直に打たせず、選ばせる。 */
const LIMIT_CHOICES = [6, 12, 24, 48] as const;

/**
 * 生成マトリクス（§15.4・§22.5）。
 *
 * 同じ事実から、届け先ごとにどう書き分けるかを 1 枚で見る画面。
 *
 * **空欄を作らない。** どのセルにも状態と理由が入る。
 * 空欄にすると「まだ作っていない」のか「作れない」のかが区別できず、
 * 利用者はいつまでも待つことになる。
 */
export default async function ContentMatrixPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly axis?: string;
    readonly limit?: string;
    /** 書き分ける先。カンマ区切りのブログ slug。 */
    readonly sites?: string;
    /** 直前の書き分けが断られた理由。押した先の画面から戻ってくる。 */
    readonly failed?: string;
    /** どの企画の表を見るか。省くと一覧の先頭。 */
    readonly pkg?: string;
  }>;
}) {
  const {
    axis: requestedAxis,
    limit: requestedLimit,
    sites: requestedSites,
    failed,
    pkg: requestedPackage,
  } = await searchParams;
  const selectedSiteIds =
    requestedSites === undefined || requestedSites === "" ? [] : requestedSites.split(",");
  const axis: MatrixRowAxis =
    MATRIX_ROW_AXES.find((a) => a === requestedAxis) ?? DEFAULT_MATRIX_ROW_AXIS;
  const limit = LIMIT_CHOICES.find((l) => String(l) === requestedLimit) ?? DEFAULT_MATRIX_LIMIT;

  const actor = await currentActor();

  /*
   * どの企画の表を見るかは URL が持つ。
   * 以前はここが見本の企画の決め打ちで、企画をいくつ立てても
   * この画面はいつも同じ 1 件を映していた。
   * 知らない ID を渡されたら断らずに先頭へ落とす——URL を手で触った人が
   * 「表が出ない」ではなく「別の企画が出ている」で気づけるほうが早い。
   */
  const packages = await (await contentPackageUseCases()).listPackages.execute(actor, {});
  const packageItems = packages.ok ? packages.value.items : [];
  const selectedPackage =
    packageItems.find((p) => p.packageId === requestedPackage) ?? packageItems[0] ?? null;

  if (!packages.ok || selectedPackage === null) {
    return (
      <AdminShell
        routeId="content/matrix"
        title="生成マトリクス"
        lead="1 つの企画を、誰に・どの切り口で出すか決めます。"
        actions={<TextLink href="/admin/content">記事へ戻る</TextLink>}
      >
        {!packages.ok ? (
          <ErrorView
            title="企画の一覧を出せませんでした"
            body={packages.error.message}
            suggestedAction={packages.error.suggestedAction ?? null}
            action={<TextLink href="/admin/content">記事へ戻る</TextLink>}
          />
        ) : (
          <Section title="この企画で達成したいこと">
            <EmptyView
              title="先に企画を立てます"
              body="書き分けるもとになる企画がありません。誰に何を伝えるかが決まっていないと、行にも列にも入れるものがありません。"
              action={<TextLink href="/admin/content/packages/new">企画を立てる</TextLink>}
            />
          </Section>
        )}
      </AdminShell>
    );
  }

  const result = await (await generationMatrixUseCases()).getMatrix.execute(actor, {
    packageId: selectedPackage.packageId,
    rowAxis: axis,
    limit,
  });

  /*
   * 書き分ける先の候補。ここで一覧を 1 回だけ引く。
   * 選んだ 1 本ずつ設計図を引き直すと、問い合わせが選択本数分増えるうえ、
   * 途中で失敗した 1 本だけ切り口が空のまま並ぶ。
   */
  const sites = await (await platformUseCases()).listSites.execute(actor, {});
  const siteItems = sites.ok ? sites.value.items : [];
  const sitesError = sites.ok ? null : refusalText(sites.error);

  return (
    <AdminShell
      routeId="content/matrix"
      title="生成マトリクス"
      lead="1 つの企画を、誰に・どの切り口で出すか決めます。"
      actions={<TextLink href="/admin/content">記事へ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="生成マトリクスを出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/content">記事へ戻る</TextLink>}
        />
      ) : (
        <MatrixBody
          storage={await editorialContentNotice()}
          packageChoices={packageItems.map((p) => ({
            packageId: p.packageId,
            objective: p.objective,
            statusLabel: p.statusLabel,
          }))}
          matrix={result.value}
          selectedSiteIds={selectedSiteIds}
          siteItems={siteItems}
          sitesError={sitesError}
          failed={failed ?? null}
        />
      )}
    </AdminShell>
  );
}

type Matrix = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof generationMatrixUseCases>>["getMatrix"]["execute"]>
>;
type SiteItem = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof platformUseCases>>["listSites"]["execute"]>
>["items"][number];

type PackageChoice = {
  readonly packageId: string;
  readonly objective: string;
  readonly statusLabel: string;
};

function MatrixBody({
  storage,
  packageChoices,
  matrix,
  selectedSiteIds,
  siteItems,
  sitesError,
  failed,
}: {
  readonly storage: StorageStatus;
  readonly packageChoices: readonly PackageChoice[];
  readonly matrix: Matrix;
  readonly selectedSiteIds: readonly string[];
  readonly siteItems: readonly SiteItem[];
  readonly sitesError: string | null;
  readonly failed: string | null;
}) {
  /** 表示条件を保ったまま、ブログ 1 本の選択だけを入れ替える行き先。 */
  const toggleHref = (slug: string): string => {
    const next = selectedSiteIds.includes(slug)
      ? selectedSiteIds.filter((id) => id !== slug)
      : [...selectedSiteIds, slug];
    const query = new URLSearchParams({
      axis: matrix.rowAxis,
      limit: String(matrix.limit),
      pkg: matrix.packageId,
    });
    if (next.length > 0) query.set("sites", next.join(","));
    return `/admin/content/matrix?${query.toString()}`;
  };

  /**
   * 企画を切り替える行き先。
   *
   * **表示条件（行の軸・本数の上限）は持ち越し、選んだブログは落とす。**
   * 前の企画で選んだブログをそのまま連れて行くと、企画に合わない出し先が
   * 選ばれたまま「書き分ける」を押せてしまう。
   */
  const packageHref = (packageId: string): string =>
    `/admin/content/matrix?${new URLSearchParams({
      axis: matrix.rowAxis,
      limit: String(matrix.limit),
      pkg: packageId,
    }).toString()}`;

  return (
    <>
      <StorageNotice status={storage} />

      <Callout
        tone="info"
        title="この表の読み方"
        reason="行は「誰に・どう切り出して・どの段階で」、列は出す先の媒体です。全部の組み合わせを作ると数が多くなりすぎるため、目的が重ならない代表だけを選びます。"
      />

      {packageChoices.length < 2 ? null : (
        <Section
          title="どの企画の表を見るか"
          lead="企画ごとに、行に並ぶ読者も切り口も変わります。"
        >
          <ListView
            rows={packageChoices.map((choice) => ({
              key: choice.packageId,
              label:
                choice.packageId === matrix.packageId
                  ? `${choice.objective}（表示中）`
                  : choice.objective,
              href: packageHref(choice.packageId),
              note: choice.statusLabel,
            }))}
          />
        </Section>
      )}

      <Section title="この企画で達成したいこと" lead={matrix.objective}>
        <FactList
          rows={[
            {
              key: "total",
              label: "組み合わせの総数",
              value: `${matrix.totalCombinations}通り`,
            },
            { key: "limit", label: "今回作る本数の上限", value: `${matrix.limit}本` },
            { key: "planned", label: "今回作る", value: `${matrix.plannedCount}本` },
            { key: "generated", label: "すでにある", value: `${matrix.generatedCount}本` },
          ]}
        />
        {matrix.blockedReason === null ? null : (
          <Callout
            tone="warn"
            title="まだ生成できません"
            reason={`${matrix.blockedReason}（足りないもの: ${matrix.missingInputs.join(" / ")}）`}
            action={<TextLink href="/admin/evidence">根拠の画面へ</TextLink>}
          />
        )}
      </Section>

      <Section
        title="ブログ別に書き分ける"
        lead="書き分ける先を選ぶと、そのブログの設計図にある切り口がそのまま使われます。"
      >
        {failed === null ? null : (
          <ErrorView
            title="書き分けを始められませんでした"
            body={failed}
            suggestedAction={null}
            action={<TextLink href="/admin/sites">ブログの設計図を見る</TextLink>}
          />
        )}
        {sitesError === null ? null : (
          <ErrorView
            title="ブログの一覧を出せませんでした"
            body={sitesError}
            suggestedAction={null}
            action={<TextLink href="/admin/sites">ブログへ</TextLink>}
          />
        )}

        <ListView
          rows={siteItems.map((site) => ({
            key: site.slug,
            label: selectedSiteIds.includes(site.slug)
              ? `${site.name}（選択中・外す）`
              : `${site.name}を選ぶ`,
            href: toggleHref(site.slug),
            note: site.differentiation.targetReader,
          }))}
        />

        <ConceptMatrixLauncher
          product={{
            id: matrix.primarySubjectId,
            name: productDisplayName(matrix.primarySubjectId),
          }}
          sites={siteItems.map((site) => ({
            id: site.slug,
            name: site.name,
            differentiation: toConceptAxes(site.differentiation),
          }))}
          selectedSiteIds={selectedSiteIds}
          packageId={matrix.packageId}
          action={createConceptDraftsAction}
        />
      </Section>

      <Section title="表の並べ方" lead="行に何を並べるかを選べます。列は媒体で固定です。">
        <ListView
          rows={MATRIX_ROW_AXES.map((a) =>
            a === matrix.rowAxis
              ? { key: a, label: `${MATRIX_ROW_AXIS_LABEL[a]}で並べる（表示中）` }
              : {
                  key: a,
                  label: `${MATRIX_ROW_AXIS_LABEL[a]}で並べる`,
                  href: `/admin/content/matrix?axis=${a}&limit=${matrix.limit}`,
                },
          )}
        />

        <SubSection title="今回作る本数の上限">
          <ListView
            rows={LIMIT_CHOICES.map((l) =>
              l === matrix.limit
                ? { key: String(l), label: `${l}本まで（選択中）` }
                : {
                    key: String(l),
                    label: `${l}本までにする`,
                    href: `/admin/content/matrix?axis=${matrix.rowAxis}&limit=${l}`,
                  },
            )}
          />
        </SubSection>
      </Section>

      <Section title={`${matrix.rowAxisLabel} × 媒体`}>
        {matrix.rows.length === 0 ? (
          <EmptyView
            title={`${matrix.rowAxisLabel}が 1 つも登録されていません`}
            body="この企画には読者像が結び付いていないため、行になるものがありません。読者像を登録するか、別の軸に切り替えてください。"
            action={<TextLink href="/admin/personas">読者像を見る</TextLink>}
          />
        ) : (
          <DataTable
            caption="企画と媒体の組み合わせごとの、記事の作り分け"
            columns={[
              { key: "row", label: matrix.rowAxisLabel },
              ...matrix.channels.map((channel) => ({
                key: channel.channel,
                label: channel.label,
              })),
            ]}
            rows={matrix.rows.map((row) => ({
              key: row.rowId,
              cells: [
                row.label,
                ...row.cells.map((cell) =>
                  cell.variantId === null ? (
                    cell.stateLabel
                  ) : (
                    <TextLink
                      key={cell.channel}
                      href={`/admin/content/${encodeURIComponent(cell.variantId)}`}
                    >
                      {cell.variantStatusLabel}
                    </TextLink>
                  ),
                ),
              ],
            }))}
          />
        )}
      </Section>

      <Section title="行ごとの意味">
        <FactList
          rows={matrix.rows.map((row) => ({
            key: row.rowId,
            label: row.label,
            value: row.note,
          }))}
        />
      </Section>

      <Section
        title="媒体ごとの制約"
        lead="媒体によって書ける長さも、リンクの置き方も変わります。"
      >
        <DataTable
          caption="媒体ごとの、出し方と長さとリンクの可否"
          columns={[
            { key: "channel", label: "媒体" },
            { key: "publish", label: "出し方" },
            { key: "max", label: "本文の上限", numeric: true },
            { key: "bodyLinks", label: "本文にリンク" },
            { key: "affiliate", label: "成果リンク" },
          ]}
          rows={matrix.channels.map((channel) => ({
            key: channel.channel,
            cells: [
              channel.label,
              channel.publishNote,
              channel.maxBodyLength === null ? "上限なし" : `${channel.maxBodyLength}字`,
              channel.allowsBodyLinks ? "置けます" : "置けません",
              channel.allowsAffiliateLinks ? "使えます" : "使えません",
            ],
          }))}
        />
      </Section>

      <Section title="各セルの理由">
        <Prose>
          なぜその状態なのかを 1 件ずつ書き出しています。表だけでは理由が読み取れないためです。
        </Prose>
        {matrix.rows.map((row) => (
          <SubSection key={row.rowId} title={row.label}>
            <FactList
              rows={row.cells.map((cell) => ({
                key: `${row.rowId}:${cell.channel}`,
                label: `${cell.channelLabel}: ${cell.stateLabel}`,
                value: cell.reason,
              }))}
            />
          </SubSection>
        ))}
      </Section>
    </>
  );
}
