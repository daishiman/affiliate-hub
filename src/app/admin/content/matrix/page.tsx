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
  currentActor,
  generationMatrixUseCases,
  platformUseCases,
  productDisplayName,
  sampleContentPackageId,
} from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";
import {
  Callout,
  ConceptMatrixLauncher,
  DataTable,
  ErrorView,
  FactList,
  ListView,
  Prose,
  Section,
  StubNotice,
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
  }>;
}) {
  const {
    axis: requestedAxis,
    limit: requestedLimit,
    sites: requestedSites,
    failed,
  } = await searchParams;
  const selectedSiteIds =
    requestedSites === undefined || requestedSites === "" ? [] : requestedSites.split(",");
  const axis: MatrixRowAxis =
    MATRIX_ROW_AXES.find((a) => a === requestedAxis) ?? DEFAULT_MATRIX_ROW_AXIS;
  const limit = LIMIT_CHOICES.find((l) => String(l) === requestedLimit) ?? DEFAULT_MATRIX_LIMIT;

  const actor = await currentActor();
  const result = await (await generationMatrixUseCases()).getMatrix.execute(actor, {
    packageId: sampleContentPackageId(),
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

function MatrixBody({
  matrix,
  selectedSiteIds,
  siteItems,
  sitesError,
  failed,
}: {
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
    const query = new URLSearchParams({ axis: matrix.rowAxis, limit: String(matrix.limit) });
    if (next.length > 0) query.set("sites", next.join(","));
    return `/admin/content/matrix?${query.toString()}`;
  };

  return (
    <>
      <StubNotice
        what="企画（どの組み合わせを作るかの元）の保存先"
        blockedBy="content_packages テーブルの追加と、企画を作る入口"
        stubId="persistence:content-editorial-sample"
      >
        見本の企画 1 件を読んでいます。表に並ぶ記事の有無は保存先を見ています。この画面から生成を実行することはまだできません。
      </StubNotice>

      <Callout
        tone="info"
        title="この表の読み方"
        reason="行は「誰に・どう切り出して・どの段階で」、列は出す先の媒体です。全部の組み合わせを作ると数が多くなりすぎるため、目的が重ならない代表だけを選びます。"
      />

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
        <DataTable
          caption="セルには「作成済み / 今回作る / 今回は作らない / この媒体では作れません」のいずれかが入ります。"
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
