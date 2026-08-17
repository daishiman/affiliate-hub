import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
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
  ErrorView,
  Page,
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
    MATRIX_ROW_AXES.find((a) => a === requestedAxis) ?? "audience";
  const limit = LIMIT_CHOICES.find((l) => String(l) === requestedLimit) ?? 12;

  const result = await generationMatrixUseCases().getMatrix.execute(await currentActor(), {
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
        what="企画と記事の保存先"
        blockedBy="content_packages / content_variants テーブルの追加と D1 への接続"
        stubId="persistence:content-editorial-sample"
      >
        <span>見本の企画 1 件を読んでいます。この画面から生成を実行することはまだできません。</span>
      </StubNotice>

      <Callout
        tone="info"
        title="この表の読み方"
        reason="行は「誰に・どう切り出して・どの段階で」、列は出す先の媒体です。全部の組み合わせを作ると数が多くなりすぎるため、目的が重ならない代表だけを選びます。"
      />

      <Card>
        <h2 className={styles.sectionTitle}>この企画で達成したいこと</h2>
        <p className={styles.sectionLead}>{matrix.objective}</p>

        <dl className={styles.criteria}>
          <div>
            <dt>組み合わせの総数</dt>
            <dd className={styles.numeric}>{matrix.totalCombinations}通り</dd>
          </div>
          <div>
            <dt>今回作る本数の上限</dt>
            <dd className={styles.numeric}>{matrix.limit}本</dd>
          </div>
          <div>
            <dt>今回作る</dt>
            <dd className={styles.numeric}>{matrix.plannedCount}本</dd>
          </div>
          <div>
            <dt>すでにある</dt>
            <dd className={styles.numeric}>{matrix.generatedCount}本</dd>
          </div>
        </dl>

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
        <h2 className={styles.sectionTitle}>表の並べ方</h2>
        <p className={styles.sectionLead}>行に何を並べるかを選べます。列は媒体で固定です。</p>
        <ul className={styles.linkList}>
          {MATRIX_ROW_AXES.map((a) => (
            <li key={a}>
              {a === matrix.rowAxis ? (
                <span>{MATRIX_ROW_AXIS_LABEL[a]}で並べる（表示中）</span>
              ) : (
                <Link href={`/admin/content/matrix?axis=${a}&limit=${matrix.limit}`}>
                  {MATRIX_ROW_AXIS_LABEL[a]}で並べる
                </Link>
              )}
            </li>
          ))}
        </ul>

        <h3 className={styles.sectionTitle}>今回作る本数の上限</h3>
        <ul className={styles.linkList}>
          {LIMIT_CHOICES.map((l) => (
            <li key={l}>
              {l === matrix.limit ? (
                <span>{l}本まで（選択中）</span>
              ) : (
                <Link href={`/admin/content/matrix?axis=${matrix.rowAxis}&limit=${l}`}>
                  {l}本までにする
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>
          {matrix.rowAxisLabel} × 媒体
        </h2>
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
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>行ごとの意味</h2>
        <dl className={styles.criteria}>
          {matrix.rows.map((row) => (
            <div key={row.rowId}>
              <dt>{row.label}</dt>
              <dd>{row.note}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>媒体ごとの制約</h2>
        <p className={styles.sectionLead}>
          同じ内容でも、媒体によって書ける長さも、リンクの置き方も変わります。
        </p>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">媒体</th>
              <th scope="col">出し方</th>
              <th scope="col">本文の上限</th>
              <th scope="col">本文にリンク</th>
              <th scope="col">成果リンク</th>
            </tr>
          </thead>
          <tbody>
            {matrix.channels.map((channel) => (
              <tr key={channel.channel}>
                <th scope="row">{channel.label}</th>
                <td>{channel.publishNote}</td>
                <td className={styles.numeric}>
                  {channel.maxBodyLength === null ? "上限なし" : `${channel.maxBodyLength}字`}
                </td>
                <td>{channel.allowsBodyLinks ? "置けます" : "置けません"}</td>
                <td>{channel.allowsAffiliateLinks ? "使えます" : "使えません"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>各セルの理由</h2>
        <p className={styles.sectionLead}>
          なぜその状態なのかを 1 件ずつ書き出しています。表だけでは理由が読み取れないためです。
        </p>
        {matrix.rows.map((row) => (
          <div key={row.rowId} className={styles.catalogStack}>
            <h3 className={styles.sectionTitle}>{row.label}</h3>
            <dl className={styles.criteria}>
              {row.cells.map((cell) => (
                <div key={`${row.rowId}:${cell.channel}:reason`}>
                  <dt>
                    {cell.channelLabel}: {cell.stateLabel}
                  </dt>
                  <dd>{cell.reason}</dd>
                </div>
              ))}
            </dl>
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
