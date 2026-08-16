import Link from "next/link";
import {
  AffiliateLink,
  ApprovalFlow,
  Button,
  Callout,
  Card,
  ClaimStatement,
  ComparisonTable,
  CriteriaDisclosure,
  DisclosureNotice,
  EmptyView,
  ErrorView,
  EvidenceList,
  FactualityBadge,
  LoadingView,
  AppShell,
  Page,
  RankingTable,
  StubLabel,
  StubNotice,
  UI_COPY,
  type CriterionView,
} from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-static";

/**
 * 部品の見本帳。
 *
 * 「どんな部品があるか」を探すために画面を読み歩かせない。
 * 新しい画面を作るとき、まずここを見て**すでにある部品を使う**。
 * ここに無いものだけを新しく作る。
 *
 * 状態を全部並べてあるのは、実装漏れが一番出やすいのが
 * 「空」と「失敗」だから。並べておけば、抜けが目で分かる。
 *
 * 表示専用の画面なので、データは固定値でよい。
 */

const criteria: readonly CriterionView[] = [
  { key: "quiet", label: "静音性", weight: 0.3, measurement: "1m 地点の騒音値（dB）" },
  { key: "speed", label: "書き出し速度", weight: 0.4, measurement: "同一素材の書き出し時間（秒）" },
  { key: "value", label: "価格性能比", weight: 0.3, measurement: "総合点 ÷ 実売価格" },
];

export default function UiCatalogPage() {
  return (
    <AppShell
      currentPath="/admin/ui-catalog"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "部品の見本帳" }]}
    >
      <Page
        title="部品の見本帳"
        lead="新しい画面を作るときは、まずここにある部品を使ってください。ここに無いものだけを新しく作ります。"
      >
        <Callout
          tone="info"
          title="この画面の役割"
          reason="部品の一覧と、それぞれが取りうる状態をまとめて確認するための画面です。ここに出ているものは全画面で同じ見た目・同じ操作になります。"
          action={<Link href="/admin">ホームへ戻る</Link>}
        />

        <Card>
          <h2 className={styles.sectionTitle}>1. ボタン</h2>
          <p className={styles.sectionLead}>
            主操作は 1 画面に 1 つだけ。並べる順は「主 → 副 → 取り消し」で固定します。
          </p>
          <div className={styles.catalogRow}>
            <Button tone="primary">{UI_COPY.action.save}</Button>
            <Button tone="secondary">{UI_COPY.action.edit}</Button>
            <Button tone="quiet">{UI_COPY.action.cancel}</Button>
            <Button tone="danger">{UI_COPY.action.remove}</Button>
            <Button tone="primary" busy>
              {UI_COPY.action.saving}
            </Button>
            <Button tone="primary" disabled>
              {UI_COPY.action.publish}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>2. 4 つの状態</h2>
          <p className={styles.sectionLead}>
            一覧・詳細・検索結果は必ずこの 4 つを持ちます。どの状態にも文言が要ります。
          </p>
          <div className={styles.catalogStack}>
            <LoadingView label="商品を読み込んでいます" />
            <EmptyView
              title="まだ商品がありません"
              body="最初の 1 件を登録すると、ここに表示されます。"
              action={<Link href="/admin/products">商品を登録する</Link>}
            />
            <ErrorView
              title="商品を読み込めませんでした"
              body="通信が途切れた可能性があります。もう一度お試しください。"
              action={<Button tone="secondary">{UI_COPY.action.retry}</Button>}
            />
            <Callout
              tone="warn"
              title="編集できません"
              reason="確定済みの月のため編集できません。"
              action={<Link href="/admin/affiliate">確定を解除する</Link>}
            />
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>3. 事実と推測の区別</h2>
          <p className={styles.sectionLead}>
            色だけで区別しません。記号と文字を必ず添えます。
          </p>
          <div className={styles.catalogRow}>
            <FactualityBadge kind="fact" />
            <FactualityBadge kind="inference" />
            <FactualityBadge kind="opinion" />
          </div>
          <div className={styles.catalogStack}>
            <ClaimStatement kind="fact" statement="この機種の動作音は 1m 地点で 32dB です。">
              <EvidenceList
                items={[
                  {
                    id: "e1",
                    sourceLabel: "メーカー公式仕様",
                    url: "https://example.com/spec",
                    checkedAt: "2026-03-01",
                  },
                  { id: "e2", sourceLabel: "自社検証（騒音計 A）", checkedAt: "2026-03-04" },
                ]}
              />
            </ClaimStatement>
            <ClaimStatement kind="inference" statement="長時間の書き出しでも音は気になりにくいと考えられます。" />
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>4. 根拠が無いとき</h2>
          <p className={styles.sectionLead}>0 件のときに黙りません。必ず理由と導線を出します。</p>
          <EvidenceList
            items={[]}
            emptyAction={<Link href="/admin/evidence">根拠を登録する</Link>}
          />
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>5. 広告表示</h2>
          <p className={styles.sectionLead}>
            法令に関わる表示です。画面ごとに書かず、必ずこの部品を使います。
          </p>
          <div className={styles.catalogStack}>
            <DisclosureNotice />
            <DisclosureNotice showRankingNote methodologyHref="/methodology" policyHref="/policy" />
            <p>
              成果リンクの例:{" "}
              <AffiliateLink href="https://example.com/click?aid=123&pid=456">
                販売ページを見る
              </AffiliateLink>
            </p>
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>6. 順位</h2>
          <p className={styles.sectionLead}>
            順位は採点表から機械的に決まります。この部品に並べ替えの機能はありません。
          </p>
          <RankingTable
            caption="動画編集向けノートパソコンの順位"
            criteria={criteria}
            rows={[
              { productId: "p1", rank: 1, productName: "機種A", totalScore: 84, criterionScores: [80, 88, 83] },
              { productId: "p2", rank: 2, productName: "機種B", totalScore: 79, criterionScores: [72, 85, 79] },
              { productId: "p3", rank: 3, productName: "機種C", totalScore: 71, criterionScores: [90, 60, 66] },
            ]}
            excluded={[{ productId: "p9", productName: "機種Z", reason: "販売終了のため" }]}
            updatedAt="2026-03-01"
          />
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>7. 比較</h2>
          <p className={styles.sectionLead}>
            列は配列で受け取ります。列を足すときにセルの記述を書き足す必要はありません。
          </p>
          <ComparisonTable
            caption="主要な仕様の比較"
            columns={[
              { key: "weight", label: "重さ", numeric: true, unit: "kg" },
              { key: "battery", label: "電池の持ち", numeric: true, unit: "時間" },
              { key: "port", label: "映像出力" },
            ]}
            rows={[
              {
                id: "p1",
                label: "機種A",
                cells: {
                  weight: { value: "1.32", factuality: "fact", checkedAt: "2026-03-01" },
                  battery: { value: "18", factuality: "fact", checkedAt: "2026-03-01" },
                  port: { value: "HDMI 2.1", factuality: "fact", checkedAt: "2026-03-01" },
                },
              },
              {
                id: "p2",
                label: "機種B",
                cells: {
                  weight: { value: "1.60", factuality: "fact", checkedAt: "2026-03-01" },
                  battery: { value: "12", factuality: "inference", checkedAt: "2026-02-20" },
                },
              },
            ]}
          />
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>8. 評価基準の開示</h2>
          <CriteriaDisclosure criteria={criteria} />
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>9. 承認の流れ</h2>
          <div className={styles.catalogStack}>
            <ApprovalFlow current="draft" />
            <ApprovalFlow current="review" />
            <ApprovalFlow current="published" />
            <ApprovalFlow current="archived" />
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>10. 見本（まだ中身が無いもの）</h2>
          <p className={styles.sectionLead}>
            中身の無い画面を、動いているように見せません。使えるようになる条件を必ず添えます。
          </p>
          <div className={styles.catalogStack}>
            <StubNotice
              what="A8.net との接続"
              blockedBy="A8.net のパートナー審査の通過と、審査後に発行される接続情報の登録"
              stubId="asp-a8"
            />
            <p>
              一覧の行に付ける小さな印: 機種D <StubLabel stubId="product-import" />
            </p>
          </div>
        </Card>
      </Page>
    </AppShell>
  );
}
