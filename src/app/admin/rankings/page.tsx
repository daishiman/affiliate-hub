import Link from "next/link";
import type { ReactNode } from "react";
import {
  currentActor,
  productDisplayName,
  rankingScreenTarget,
  rankingTool,
} from "@/presentation/composition";
import { invokeTool } from "@/presentation/tools/tool-definition";
import { AppShell, Callout, Card, EmptyView, ErrorView, Page } from "@/presentation/ui";
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
        <h2 className={styles.sectionTitle}>順位</h2>
        <p className={styles.sectionLead}>
          {ranking.audience}向け・評価方法 {ranking.modelVersion}
        </p>

        {ranking.ranked.length === 0 ? (
          <EmptyView
            title="順位に載る商品がありません"
            body="すべての商品が合格ラインを下回りました。評価の記録か合格ラインを見直してください。"
          />
        ) : (
          <table className={styles.rankTable}>
            <thead>
              <tr>
                <th scope="col">順位</th>
                <th scope="col">商品</th>
                <th scope="col" className={styles.numeric}>
                  総合点
                </th>
                <th scope="col">最後に検証した日</th>
              </tr>
            </thead>
            <tbody>
              {ranking.ranked.map((row) => (
                <tr key={row.productId}>
                  <td>
                    <span className={styles.rankBadge}>{row.rank}</span>
                  </td>
                  <td>
                    {productDisplayName(row.productId)}
                    <ul className={styles.breakdown}>
                      {row.breakdown.map((b) => (
                        <li key={b.key}>
                          {criterionLabel(b.key)} {formatScore(b.rawScore)}（重み{" "}
                          {formatPercent(b.weight)}）
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={styles.numeric}>{formatScore(row.totalScore)}</td>
                  <td>{formatDate(row.testedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>選外になった商品</h2>
        {ranking.excluded.length === 0 ? (
          <EmptyView title="選外はありません" body="すべての商品が合格ラインを満たしています。" />
        ) : (
          <ul className={styles.linkList}>
            {ranking.excluded.map((row) => (
              <li key={row.productId}>
                {productDisplayName(row.productId)}
                <span className={styles.linkNote}>{row.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle} id="criteria">
          評価基準
        </h2>
        <p className={styles.sectionLead}>
          読者に見せるものと同じ内容です。どう測ったかを隠しません。
        </p>
        <dl className={styles.criteria}>
          {ranking.criteriaDisclosure.map((c) => (
            <div key={c.key}>
              <dt>
                {criterionLabel(c.key)}（重み {formatPercent(c.weight)}）
              </dt>
              <dd>{c.measurement}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AppShell
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
    </AppShell>
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
