import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  affiliateUseCases,
  currentActor,
  productSampleNotice,
  productUseCases,
  rankingScreenTarget,
} from "@/presentation/composition";
import {
  Callout,
  Card,
  ClaimStatement,
  EmptyView,
  ErrorView,
  EvidenceList,
  Page,
  StubNotice,
  type EvidenceView,
} from "@/presentation/ui";
import styles from "../../admin.module.css";
import { factualityOf, formatDate } from "../claim-view";

export const dynamic = "force-dynamic";

/**
 * 商品 1 件の画面。
 *
 * 1 画面に 4 つの問いを並べている。
 *   1. どんな仕様か（get_product）
 *   2. 何が言えるか・その根拠は何か（get_evidence）
 *   3. 編集部は実際に測ったか（list_test_runs）
 *   4. なぜその順位なのか（explain_ranking）
 *   5. ほかに候補はあるか（find_alternatives）
 *
 * どれも AI 用の道具と**同じユースケース**を呼ぶ。
 * 画面側で計算し直すと、人が見る答えと AI が返す答えがずれる。
 */
export default async function ProductDetailPage({
  params,
}: {
  // Next.js 16 では params は Promise。
  readonly params: Promise<{ readonly product: string }>;
}) {
  const { product: productId } = await params;
  const actor = await currentActor();
  const uc = productUseCases();

  const detail = await uc.getProduct.execute(actor, { productId });
  if (!detail.ok) {
    return (
      <Shell title="商品">
        <ErrorView
          title="この商品を表示できませんでした"
          body={detail.error.message}
          suggestedAction={detail.error.suggestedAction ?? null}
          action={<Link href="/admin/products">商品の一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { product, specifications, retrievedAt, validUntil } = detail.value;
  const target = rankingScreenTarget();

  const [evidence, testRuns, alternatives, explained, links] = await Promise.all([
    uc.getEvidence.execute(actor, { productId }),
    uc.listTestRuns.execute(actor, { productId }),
    uc.findAlternatives.execute(actor, { productId }),
    uc.explainRanking.execute(actor, { ...target, productId }),
    // 提携リンクは商業の区分。上の順位の計算とは別のつなぎ目から取る。
    affiliateUseCases().listProductLinks.execute(actor, { productId }),
  ]);

  return (
    <Shell title={`${product.brand} ${product.name}`}>
      <StubNotice
        what="商品データの保存先"
        blockedBy="products / claims / evidence / test_runs テーブルの追加とマイグレーション"
        stubId="persistence:product-sample"
      >
        <span>{productSampleNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>仕様</h2>
        <p className={styles.sectionLead}>
          {product.description ?? "説明はまだ登録されていません。"}
          （{formatDate(retrievedAt)}時点の情報 / 有効期限: {formatDate(validUntil)}）
        </p>
        {specifications.length === 0 ? (
          <EmptyView
            title="仕様がまだ登録されていません"
            body="仕様が無いと比較表の列を作れません。メーカー公式の値を登録してください。"
          />
        ) : (
          <dl className={styles.criteria}>
            {specifications.map((s) => (
              <div key={s.key}>
                <dt>{s.key}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>この商品について言えること</h2>
        <p className={styles.sectionLead}>
          測った内容と、そこから導いた判断を分けて出します。判断には必ず印が付きます。
        </p>
        {!evidence.ok ? (
          <ErrorView
            title="根拠を読み出せませんでした"
            body={evidence.error.message}
            suggestedAction={evidence.error.suggestedAction ?? null}
          />
        ) : evidence.value.items.length === 0 ? (
          <EmptyView
            title="登録された内容がありません"
            body={evidence.value.emptyReason ?? "この商品にはまだ何も登録されていません。"}
            action={<Link href="/admin/evidence">根拠の一覧を見る</Link>}
          />
        ) : (
          <div className={styles.catalogStack}>
            {evidence.value.items.map((item) => (
              <ClaimStatement
                key={String(item.claim.id)}
                kind={factualityOf(item.claim.type)}
                statement={item.claim.statement}
              >
                {item.expiredNote === null ? null : (
                  <Callout tone="warn" reason={item.expiredNote} />
                )}
                <EvidenceList
                  items={item.evidence.map(toEvidenceView)}
                  emptyAction={<Link href="/admin/evidence">根拠を登録する画面へ</Link>}
                />
              </ClaimStatement>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>編集部の検証記録</h2>
        <p className={styles.sectionLead}>
          ここに記録がある項目だけ、記事で「実際に使ってみた」と書けます。
        </p>
        {!testRuns.ok ? (
          <ErrorView
            title="検証記録を読み出せませんでした"
            body={testRuns.error.message}
            suggestedAction={testRuns.error.suggestedAction ?? null}
          />
        ) : testRuns.value.runs.length === 0 ? (
          <EmptyView
            title="検証記録がありません"
            body={testRuns.value.emptyReason ?? "この商品はまだ編集部で実測していません。"}
          />
        ) : (
          <ul className={styles.linkList}>
            {testRuns.value.runs.map((run) => (
              <li key={String(run.id)}>
                測定方法 {run.methodVersion}（{formatDate(run.completedAt)}）
                <span className={styles.linkNote}>
                  {Object.entries(run.rawResults)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(" / ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>この順位になった理由</h2>
        {!explained.ok ? (
          <ErrorView
            title="順位の理由を出せませんでした"
            body={explained.error.message}
            suggestedAction={explained.error.suggestedAction ?? null}
            action={<Link href="/admin/rankings">評価基準と順位を見る</Link>}
          />
        ) : explained.value.excludedReason !== null ? (
          <EmptyView
            title="この商品は順位に入っていません"
            body={explained.value.excludedReason}
            action={<Link href="/admin/rankings">評価基準を確認する</Link>}
          />
        ) : (
          <>
            <p className={styles.sectionLead}>
              評価方法 {explained.value.modelVersion} で {explained.value.rank}位（総合{" "}
              {explained.value.totalScore.toFixed(2)}）。内訳は次のとおりです。
            </p>
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th scope="col">評価項目</th>
                  <th scope="col">どう測ったか</th>
                  <th scope="col" className={styles.numeric}>
                    重み
                  </th>
                  <th scope="col" className={styles.numeric}>
                    点数
                  </th>
                  <th scope="col" className={styles.numeric}>
                    総合への寄与
                  </th>
                </tr>
              </thead>
              <tbody>
                {explained.value.contributions.map((c) => (
                  <tr key={c.key}>
                    <td>{c.key}</td>
                    <td>{c.measurement}</td>
                    <td className={styles.numeric}>{Math.round(c.weight * 100)}%</td>
                    <td className={styles.numeric}>{c.score.toFixed(2)}</td>
                    <td className={styles.numeric}>{c.contribution.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>この商品の提携リンク</h2>
        <p className={styles.sectionLead}>
          リンクは発行されたままの形で使います。
          計測用の印を足すと多くの提携先で規約違反になり、成果が付かなくなるためです。
          ここに出る内容は、上の順位の計算には一切入りません。
        </p>
        {!links.ok ? (
          <ErrorView
            title="提携リンクを出せませんでした"
            body={links.error.message}
            suggestedAction={links.error.suggestedAction ?? null}
            action={<Link href="/admin/affiliate">提携と成果を見る</Link>}
          />
        ) : links.value.items.length === 0 ? (
          <EmptyView
            title="提携リンクがありません"
            body={links.value.emptyReason ?? "この商品につながる提携リンクはまだありません。"}
            action={<Link href="/admin/affiliate">提携と成果を見る</Link>}
          />
        ) : (
          <ul className={styles.linkList}>
            {links.value.items.map((l) => (
              <li key={l.linkId}>
                {l.url}
                <span className={styles.linkNote}>
                  {l.usable ? "使えます" : (l.blockedReason ?? "使えません")}
                  {l.alterationProhibited ? " / 改変禁止" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>ほかの候補</h2>
        {!alternatives.ok ? (
          <ErrorView
            title="ほかの候補を出せませんでした"
            body={alternatives.error.message}
            suggestedAction={alternatives.error.suggestedAction ?? null}
          />
        ) : alternatives.value.alternatives.length === 0 ? (
          <EmptyView
            title="ほかの候補がありません"
            body={alternatives.value.emptyReason ?? "同じ用途の商品がまだ登録されていません。"}
            action={<Link href="/admin/products">商品の一覧を見る</Link>}
          />
        ) : (
          <ul className={styles.linkList}>
            {alternatives.value.alternatives.map((a) => (
              <li key={a.productId}>
                <Link href={`/admin/products/${encodeURIComponent(a.productId)}`}>
                  {a.brand} {a.name}
                </Link>
                <span className={styles.linkNote}>{a.oneLine}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

function toEvidenceView(e: {
  readonly id: unknown;
  readonly title: string;
  readonly urlOrAssetId: string;
  readonly capturedAt: Date;
}): EvidenceView {
  return {
    id: String(e.id),
    sourceLabel: e.title,
    // 社内保管の資料（sample:// など）は開けないので、リンクにしない。
    // リンクにして開けない方が、無いことより分かりにくい。
    url: e.urlOrAssetId.startsWith("http") ? e.urlOrAssetId : undefined,
    checkedAt: formatDate(e.capturedAt),
  };
}

function Shell({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/products"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "商品", href: "/admin/products" },
        { label: title },
      ]}
      actions={<Link href="/admin/products">商品の一覧へ戻る</Link>}
    >
      <Page title={title} lead="仕様・根拠・検証記録・順位の理由をまとめて確かめます。">
        {children}
      </Page>
    </AdminShell>
  );
}
