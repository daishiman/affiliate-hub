import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  currentActor,
  productDisplayName,
  rankingScreenTarget,
  rankingTool,
} from "@/presentation/composition";
import { invokeTool } from "@/presentation/tools/tool-definition";
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
} from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 順位の画面。
 *
 * **AI 用の操作と同じ入口を通している。**
 * この画面は `rank_products` をそのまま呼ぶ。
 * 画面用に別の計算を書くと、画面と AI の答えがずれる
 * （仕様が禁じている「WebMCP 内に独自のランキング式を実装」と同じ壊れ方）。
 */
export default async function RankingsPage() {
  const actor = await currentActor();
  const target = rankingScreenTarget();
  const result = await invokeTool(rankingTool(), actor, target);

  if (!result.ok) {
    return (
      <Shell>
        <ErrorView
          title="順位を出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
        />
      </Shell>
    );
  }

  const ranking = result.value;

  return (
    <Shell>
      <Callout
        tone="info"
        title="順位の決め方"
        reason="報酬額・広告主の予算・販売実績は、順位の計算に入れていません（入れられない作りです）。"
        action={<a href="#criteria">評価基準を見る</a>}
      />

      <Card>
        <SectionHeading level={2}>順位</SectionHeading>
        <p className={styles.sectionLead}>
          {ranking.audience}向け・評価方法 {ranking.modelVersion}
        </p>

        {ranking.ranked.length === 0 ? (
          <EmptyView
            title="順位に載る商品がありません"
            body="すべての商品が合格ラインを下回りました。評価の記録か合格ラインを見直してください。"
          />
        ) : (
          <DataTable
            caption={`${ranking.audience}向けの順位。総合点の高い順で、点の内訳もそのまま出す。`}
            columns={[
              {
                key: "rank",
                header: "順位",
                cell: (row) => <span className={styles.rankBadge}>{row.rank}</span>,
              },
              {
                key: "product",
                header: "商品",
                rowHeader: true,
                cell: (row) => (
                  <>
                    {productDisplayName(row.productId)}
                    <ul className={styles.breakdown}>
                      {row.breakdown.map((b) => (
                        <li key={b.key}>
                          {criterionLabel(b.key)} {formatScore(b.rawScore)}（重み{" "}
                          {formatPercent(b.weight)}）
                        </li>
                      ))}
                    </ul>
                  </>
                ),
              },
              {
                key: "total",
                header: "総合点",
                align: "numeric",
                cell: (row) => formatScore(row.totalScore),
              },
              {
                key: "testedAt",
                header: "最後に検証した日",
                cell: (row) => formatDate(row.testedAt),
              },
            ]}
            rows={ranking.ranked}
            rowKey={(row) => row.productId}
          />
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>選外になった商品</SectionHeading>
        {ranking.excluded.length === 0 ? (
          <EmptyView title="選外はありません" body="すべての商品が合格ラインを満たしています。" />
        ) : (
          <StackedList>
            {ranking.excluded.map((row) => (
              <StackedRow key={row.productId} note={row.reason}>
                {productDisplayName(row.productId)}
                
              </StackedRow>
            ))}
          </StackedList>
        )}
      </Card>

      <Card>
        <SectionHeading level={2} id="criteria">
          評価基準
        </SectionHeading>
        <p className={styles.sectionLead}>
          読者に見せるものと同じ内容です。どう測ったかを隠しません。
        </p>
        <DefinitionList
          items={ranking.criteriaDisclosure.map((c) => ({
            term: `${criterionLabel(c.key)}（重み ${formatPercent(c.weight)}）`,
            description: c.measurement,
          }))}
        />
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/rankings"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "評価基準と順位" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="評価基準と順位"
        lead="決めた評価基準で商品を並べ、なぜその順になったかを確かめます。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}

/** 内部の指標キーをそのまま画面に出さない。読み手の言葉に直す。 */
const CRITERION_LABEL: Readonly<Record<string, string>> = {
  measured_performance: "実測性能",
  specification: "仕様",
  usability: "使いやすさ",
  durability: "耐久性",
  support: "サポート",
  price_value: "価格に対する価値",
};

function criterionLabel(key: string): string {
  return CRITERION_LABEL[key] ?? key;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: Date | null): string {
  if (value === null) return "未検証";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(value);
}
