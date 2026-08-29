/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AffiliateLink, DisclosureNotice } from "@/presentation/ui/patterns/disclosure";
import { RankingTable, type CriterionView } from "@/presentation/ui/patterns/ranking-table";
import { ComparisonTable } from "@/presentation/ui/patterns/comparison-table";
import { ApprovalFlow } from "@/presentation/ui/patterns/approval";
import { ChannelBadge } from "@/presentation/ui/patterns/channel-status";
import { StubNotice } from "@/presentation/ui/patterns/stub-notice";
import { EvidenceList } from "@/presentation/ui/patterns/evidence";
import { FactSourceBadge, FactualityBadge } from "@/presentation/ui/patterns/factuality";

/**
 * パターン部品が「実際に何を出力するか」の確認。
 *
 * 型が通ることと、法令要件を満たす HTML が出ることは別。
 * rel="sponsored" が消えていても型は通る。だから出力を見る。
 */

const criteria: readonly CriterionView[] = [
  { key: "quiet", label: "静音性", weight: 0.4, measurement: "1m 地点の騒音値（dB）" },
  { key: "value", label: "価格性能比", weight: 0.6, measurement: "総合点 ÷ 実売価格" },
];

describe("成果リンク", () => {
  it("rel に sponsored が必ず入る", () => {
    const html = renderToStaticMarkup(
      <AffiliateLink href="https://example.com/a?id=1">見る</AffiliateLink>,
    );
    expect(html).toContain('rel="sponsored nofollow noopener"');
  });

  it("ASP が発行した URL を改変しない", () => {
    const href = "https://example.com/click?aid=123&pid=456&sid=789";
    const html = renderToStaticMarkup(<AffiliateLink href={href}>見る</AffiliateLink>);
    // & は HTML エスケープされるので戻してから比べる
    expect(html.replace(/&amp;/g, "&")).toContain(`href="${href}"`);
  });
});

describe("広告表示", () => {
  it("広告であることが読者に分かる文言を出す", () => {
    const html = renderToStaticMarkup(<DisclosureNotice />);
    expect(html).toContain("広告");
    expect(html).toContain("報酬");
  });

  it("順位を含む記事では報酬を順位に使っていないことも出す", () => {
    const html = renderToStaticMarkup(<DisclosureNotice showRankingNote />);
    expect(html).toContain("順位づけに報酬額は使用していません");
  });
});

describe("順位表", () => {
  it("評価基準と「報酬は順位に使わない」を必ず併記する", () => {
    const html = renderToStaticMarkup(
      <RankingTable
        caption="動画編集向けノートパソコンの順位"
        criteria={criteria}
        rows={[
          { productId: "p1", rank: 1, productName: "機種A", totalScore: 82, criterionScores: [80, 84] },
        ]}
        updatedAt="2026-03-01"
      />,
    );
    expect(html).toContain("静音性");
    expect(html).toContain("1m 地点の騒音値");
    expect(html).toContain("順位づけに報酬額は使用していません");
  });

  it("選外は理由つきで出す（黙って消さない）", () => {
    const html = renderToStaticMarkup(
      <RankingTable
        caption="順位"
        criteria={criteria}
        rows={[
          { productId: "p1", rank: 1, productName: "機種A", totalScore: 82, criterionScores: [80, 84] },
        ]}
        excluded={[{ productId: "p9", productName: "機種Z", reason: "販売終了のため" }]}
        updatedAt="2026-03-01"
      />,
    );
    expect(html).toContain("機種Z");
    expect(html).toContain("販売終了のため");
  });

  it("0 件のときに無言の空白を出さない", () => {
    const html = renderToStaticMarkup(
      <RankingTable caption="順位" criteria={criteria} rows={[]} updatedAt="2026-03-01" />,
    );
    expect(html).toContain("まだ何もありません");
  });

  /**
   * 順位表の買う導線。
   *
   * ここが無いあいだ、**順位記事のクリックは 1 件も数えられていなかった**。
   * 型の上では `affiliateHref` を渡せても、表が読まなければ画面には出ない。
   * 出力そのものを見ないと、この壊れ方は見つからない。
   */
  it("転送の入口を通す成果リンクを、順位の行から出す", () => {
    const html = renderToStaticMarkup(
      <RankingTable
        caption="順位"
        criteria={criteria}
        rows={[
          {
            productId: "p1",
            rank: 1,
            productName: "機種A",
            totalScore: 82,
            criterionScores: [80, 84],
            affiliateHref: "/go/abc123",
          },
        ]}
        updatedAt="2026-03-01"
      />,
    );
    expect(html).toContain('href="/go/abc123"');
    // 部品を通しているので、申告と計測の印が付いてくる。
    expect(html).toContain('rel="sponsored nofollow noopener"');
    expect(html).toContain('data-tel-kind="affiliate_link"');
    expect(html).toContain('data-tel-placement="順位表"');
  });

  it("提携が無い行は空欄にせず、理由を出す", () => {
    const html = renderToStaticMarkup(
      <RankingTable
        caption="順位"
        criteria={criteria}
        rows={[
          {
            productId: "p1",
            rank: 1,
            productName: "機種A",
            totalScore: 82,
            criterionScores: [80, 84],
            affiliateHref: "/go/abc123",
          },
          { productId: "p2", rank: 2, productName: "機種B", totalScore: 70, criterionScores: [70, 70] },
        ]}
        updatedAt="2026-03-01"
      />,
    );
    // 空欄だと「1 行だけ貼り忘れた」と読まれる。
    expect(html).toContain("案内できる販売先がありません");
  });

  it("提携が 1 つも無い表には、買う導線の列を足さない", () => {
    const html = renderToStaticMarkup(
      <RankingTable
        caption="順位"
        criteria={criteria}
        rows={[
          { productId: "p1", rank: 1, productName: "機種A", totalScore: 82, criterionScores: [80, 84] },
        ]}
        updatedAt="2026-03-01"
      />,
    );
    // 全部が「販売先がありません」で埋まる列は、読者に何も伝えない。
    expect(html).not.toContain("販売ページ");
    expect(html).not.toContain("案内できる販売先がありません");
  });
});

describe("比較表", () => {
  it("値の無いセルを空白にせず「—」を出す", () => {
    const html = renderToStaticMarkup(
      <ComparisonTable
        caption="仕様の比較"
        columns={[
          { key: "weight", label: "重さ", numeric: true, unit: "kg" },
          { key: "battery", label: "電池", numeric: true, unit: "時間" },
        ]}
        rows={[{ id: "p1", label: "機種A", cells: { weight: { value: "1.3", factuality: "fact", checkedAt: "2026-03-01" } } }]}
      />,
    );
    expect(html).toContain("—");
    expect(html).toContain("根拠あり");
    expect(html).toContain("2026-03-01");
  });

  it("列は配列で受け取る（列追加でセルの JSX を書き足さない）", () => {
    const columns = [
      { key: "a", label: "軸A" },
      { key: "b", label: "軸B" },
      { key: "c", label: "軸C" },
    ];
    const html = renderToStaticMarkup(
      <ComparisonTable
        caption="比較"
        columns={columns}
        rows={[{ id: "p1", label: "機種A", cells: { a: { value: "1" }, b: { value: "2" }, c: { value: "3" } } }]}
      />,
    );
    for (const col of columns) expect(html).toContain(col.label);
  });
});

describe("事実と推測の区別", () => {
  it("色だけでなく文字でも区別できる", () => {
    for (const [kind, label] of [
      ["fact", "根拠あり"],
      ["inference", "推測"],
      ["opinion", "意見"],
    ] as const) {
      const html = renderToStaticMarkup(<FactualityBadge kind={kind} />);
      expect(html).toContain(label);
      expect(html, `${kind} の目印が共通アイコンではありません`).toContain("<svg");
    }
  });

  it("利用者レビューを文字の顔ではなく共通アイコンで示す", () => {
    const html = renderToStaticMarkup(<FactSourceBadge source="external" />);
    expect(html).toContain("利用者レビュー");
    expect(html).toContain("<svg");
    expect(html).not.toContain("☺");
  });
});

describe("配信方式", () => {
  it.each([
    ["api_publish", "自動投稿"],
    ["api_schedule", "予約投稿"],
    ["manual_export", "手動投稿"],
  ] as const)("%s を共通アイコンと文字で示す", (iconName, label) => {
    const html = renderToStaticMarkup(
      <ChannelBadge
        capability={{
          kind: iconName,
          label,
          accentToken: "--color-text-muted",
          iconName,
          statusLabels: {
            not_started: "未着手",
            scheduled: "予定",
            sending: "処理中",
            done: "完了",
            failed: "失敗",
          },
        }}
        state="not_started"
      />,
    );
    expect(html).toContain(label);
    expect(html, `${iconName} の目印が共通アイコンではありません`).toContain("<svg");
  });
});

describe("根拠", () => {
  it("根拠が無いときに黙らない", () => {
    const html = renderToStaticMarkup(<EvidenceList items={[]} />);
    expect(html).toContain("根拠がまだありません");
  });

  it("出典に sponsored を付けない（広告と誤解させない）", () => {
    const html = renderToStaticMarkup(
      <EvidenceList
        items={[
          { id: "e1", sourceLabel: "メーカー公式仕様", url: "https://example.com", checkedAt: "2026-03-01" },
        ]}
      />,
    );
    expect(html).not.toContain("sponsored");
    expect(html).toContain("2026-03-01");
  });
});

describe("承認の流れ", () => {
  it("現在地が読み上げでも分かる", () => {
    const html = renderToStaticMarkup(<ApprovalFlow current="review" />);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("確認中");
    expect(html, "完了した段階の目印が共通アイコンではありません").toContain("<svg");
  });

  it("取り下げ済みは流れの中に混ぜない", () => {
    const html = renderToStaticMarkup(<ApprovalFlow current="archived" />);
    expect(html).toContain("取り下げ済み");
    expect(html).not.toContain("下書き");
  });
});

describe("見本 (スタブ) の表示", () => {
  it("見本であることと、使えるようになる条件を必ず出す", () => {
    const html = renderToStaticMarkup(
      <StubNotice what="A8.net との接続" blockedBy="A8.net のパートナー審査の通過" stubId="asp-a8" />,
    );
    expect(html).toContain("見本");
    expect(html).toContain("A8.net との接続");
    expect(html).toContain("A8.net のパートナー審査の通過");
    expect(html).toContain('data-stub="true"');
  });
});
