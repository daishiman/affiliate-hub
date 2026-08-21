import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  DEFAULT_MATRIX_LIMIT,
  DEFAULT_MATRIX_ROW_AXIS,
  MATRIX_ROW_AXES,
  MATRIX_ROW_AXIS_LABEL,
  type MatrixRowAxis,
} from "@/application/usecases/authoring/plan-generation-matrix";
import {
  currentActor,
  generationMatrixUseCases,
  sampleContentPackageId,
} from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
  DefinitionList,
  EmptyView,
  ErrorView,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StubNotice,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

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
  readonly searchParams: Promise<{ readonly axis?: string; readonly limit?: string }>;
}) {
  const { axis: requestedAxis, limit: requestedLimit } = await searchParams;
  const axis: MatrixRowAxis =
    MATRIX_ROW_AXES.find((a) => a === requestedAxis) ?? DEFAULT_MATRIX_ROW_AXIS;
  const limit = LIMIT_CHOICES.find((l) => String(l) === requestedLimit) ?? DEFAULT_MATRIX_LIMIT;

  const result = await (await generationMatrixUseCases()).getMatrix.execute(await currentActor(), {
    packageId: sampleContentPackageId(),
    rowAxis: axis,
    limit,
  });

  if (!result.ok) {
    return (
      <Shell>
        <ErrorView
          title="生成マトリクスを出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/content">記事へ戻る</Link>}
        />
      </Shell>
    );
  }

  const matrix = result.value;

  return (
    <Shell>
      <StubNotice
        what="企画（どの組み合わせを作るかの元）の保存先"
        blockedBy="content_packages テーブルの追加と、企画を作る入口"
        stubId="persistence:content-editorial-sample"
      >
        <span>見本の企画 1 件を読んでいます。表に並ぶ記事の有無は保存先を見ています。この画面から生成を実行することはまだできません。</span>
      </StubNotice>

      <Callout
        tone="info"
        title="この表の読み方"
        reason="行は「誰に・どう切り出して・どの段階で」、列は出す先の媒体です。全部の組み合わせを作ると数が多くなりすぎるため、目的が重ならない代表だけを選びます。"
      />

      <Card>
        <SectionHeading level={2}>この企画で達成したいこと</SectionHeading>
        <p className={styles.sectionLead}>{matrix.objective}</p>

        <DefinitionList
          items={[
            {
              term: "組み合わせの総数",
              description: `${matrix.totalCombinations}通り`,
              align: "numeric",
            },
            { term: "今回作る本数の上限", description: `${matrix.limit}本`, align: "numeric" },
            { term: "今回作る", description: `${matrix.plannedCount}本`, align: "numeric" },
            { term: "すでにある", description: `${matrix.generatedCount}本`, align: "numeric" },
          ]}
        />

        {matrix.blockedReason === null ? null : (
          <Callout
            tone="warn"
            title="まだ生成できません"
            reason={`${matrix.blockedReason}（足りないもの: ${matrix.missingInputs.join(" / ")}）`}
            action={<Link href="/admin/evidence">根拠の画面へ</Link>}
          />
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>表の並べ方</SectionHeading>
        <p className={styles.sectionLead}>行に何を並べるかを選べます。列は媒体で固定です。</p>
        <StackedList>
          {MATRIX_ROW_AXES.map((a) => (
            <StackedRow key={a}>
              {a === matrix.rowAxis ? (
                <span>{MATRIX_ROW_AXIS_LABEL[a]}で並べる（表示中）</span>
              ) : (
                <Link href={`/admin/content/matrix?axis=${a}&limit=${matrix.limit}`}>
                  {MATRIX_ROW_AXIS_LABEL[a]}で並べる
                </Link>
              )}
            </StackedRow>
          ))}
        </StackedList>

        <SectionHeading level={3}>今回作る本数の上限</SectionHeading>
        <StackedList>
          {LIMIT_CHOICES.map((l) => (
            <StackedRow key={l}>
              {l === matrix.limit ? (
                <span>{l}本まで（選択中）</span>
              ) : (
                <Link href={`/admin/content/matrix?axis=${matrix.rowAxis}&limit=${l}`}>
                  {l}本までにする
                </Link>
              )}
            </StackedRow>
          ))}
        </StackedList>
      </Card>

      <Card>
        <SectionHeading level={2}>
          {matrix.rowAxisLabel} × 媒体
        </SectionHeading>
        {/*
         * 行が 0 本のとき、表そのものを出さない。
         *
         * 出すと見出し行だけの表になり、「まだ作っていない」のか
         * 「この軸では作れない」のかが区別できない。この画面が冒頭で
         * 「空欄を作らない」と決めているのと同じ理由で、空の表も作らない。
         *
         * 0 本になるのは「読者像」の軸だけ。切り口と段階は決まった一覧から
         * 作るので必ず埋まる（`rowIdsFor` を参照）。だから理由を推し量らずに
         * 「読者像が登録されていない」と言い切れる。
         *
         * **この枝は、2026-08-21 夜まで一度も描かれていなかった。いまは描かれている。**
         *
         * 朝の時点では届かなかった——`tests/ui/route-table.ts` のこの画面には `state:` が
         * 無く、既定の 1 枚しか描かれない。`?axis=audience` を渡しても届かない。見本の企画は
         * 1 本だけで、`content-editorial-sample-repository.ts:221` が読者像を全部結び付けて
         * いるため、どの軸を選んでも行は必ず埋まる。`RouteWorld` の 3 つは身元を差し替える
         * だけで見本データには触らない。**URL では作れない状態だった。**
         *
         * 夜、`tests/support/render.tsx` に `no-audience` の世界を足して通した。空にして
         * いるのは企画の `audiencePersonaIds` **1 フィールドだけ**で、0 行になるところは
         * 本物の `rowIdsFor` が計算する。確かめは `tests/ui/matrix-empty-reached.test.ts`。
         *
         * --- **書き換えるときに気をつけること** ---
         *
         * あちらは `title` の文言（「読者が 1 つも登録されていません」）を文字列で持って
         * いる。ここを言い換えたら向こうも赤くなる。**それでよい**——文言が変わったことに
         * 気づけないほうが困る。ただし `title` は上の `rowAxisLabel` を差し込むので
         * **軸ごとに変わる**のに、`body` は「読者像が結び付いていないため」と言い切って
         * いる。上の註が「0 本になるのは読者像の軸だけ」と保証しているので今は食い違わない
         * が、**その保証が崩れた日に、見出しと本文が別のことを言い出す。**
         */}
        {matrix.rows.length === 0 ? (
          <EmptyView
            title={`${matrix.rowAxisLabel}が 1 つも登録されていません`}
            body="この企画には読者像が結び付いていないため、行になるものがありません。読者像を登録するか、別の軸に切り替えてください。"
            action={<Link href="/admin/personas">読者像を見る</Link>}
          />
        ) : (
        // 横へ流す器。`tabIndex` が無いとキーボードで動かせない
        // （`DataTable` と同じ理由。`admin.module.css` の `.rankTableWrap` を読むこと）。
        <div
          className={styles.rankTableWrap}
          role="group"
          aria-label="企画と媒体の組み合わせごとの、記事の作り分け"
          tabIndex={0}
        >
        <table className={styles.rankTable}>
          <caption>
            セルには「作成済み / 今回作る / 今回は作らない / この媒体では作れません」のいずれかが入ります。
          </caption>
          <thead>
            <tr>
              <th scope="col">{matrix.rowAxisLabel}</th>
              {matrix.channels.map((channel) => (
                <th key={channel.channel} scope="col">
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.rowId}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell) => (
                  <td key={`${row.rowId}:${cell.channel}`}>
                    {cell.variantId === null ? (
                      cell.stateLabel
                    ) : (
                      <Link href={`/admin/content/${encodeURIComponent(cell.variantId)}`}>
                        {cell.variantStatusLabel}
                      </Link>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>行ごとの意味</SectionHeading>
        <DefinitionList
          items={matrix.rows.map((row) => ({ term: row.label, description: row.note }))}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>媒体ごとの制約</SectionHeading>
        <p className={styles.sectionLead}>
          同じ内容でも、媒体によって書ける長さも、リンクの置き方も変わります。
        </p>
        {/* 「本文の上限」は値だけが右寄せで、見出しは左寄せのままだった。
            `align` が列の属性になったので、見出しと値がずれる書き方ができない。 */}
        <DataTable
          caption="媒体ごとに決まっている、書ける長さとリンクの置き方"
          columns={[
            { key: "label", header: "媒体", rowHeader: true, cell: (c) => c.label },
            { key: "publishNote", header: "出し方", cell: (c) => c.publishNote },
            {
              key: "maxBodyLength",
              header: "本文の上限",
              align: "numeric",
              cell: (c) => (c.maxBodyLength === null ? "上限なし" : `${c.maxBodyLength}字`),
            },
            {
              key: "bodyLinks",
              header: "本文にリンク",
              cell: (c) => (c.allowsBodyLinks ? "置けます" : "置けません"),
            },
            {
              key: "affiliateLinks",
              header: "成果リンク",
              cell: (c) => (c.allowsAffiliateLinks ? "使えます" : "使えません"),
            },
          ]}
          rows={matrix.channels}
          rowKey={(c) => c.channel}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>各セルの理由</SectionHeading>
        <p className={styles.sectionLead}>
          なぜその状態なのかを 1 件ずつ書き出しています。表だけでは理由が読み取れないためです。
        </p>
        {matrix.rows.map((row) => (
          <div key={row.rowId} className={styles.catalogStack}>
            <SectionHeading level={3}>{row.label}</SectionHeading>
            <DefinitionList
              items={row.cells.map((cell) => ({
                term: `${cell.channelLabel}: ${cell.stateLabel}`,
                description: cell.reason,
              }))}
            />
          </div>
        ))}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/content"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "記事", href: "/admin/content" },
        { label: "生成マトリクス" },
      ]}
      actions={<Link href="/admin/content">記事へ戻る</Link>}
    >
      <Page
        title="生成マトリクス"
        lead="1 つの企画から、誰に向けて、どの切り口で、どの媒体へ出すかを決める表です。作る本数の上限はここで決めます。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
