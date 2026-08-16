import { UI_COPY } from "../copy";
import { telemetryAttrs } from "../telemetry-attrs";
import styles from "./patterns.module.css";

/**
 * 広告表示（ステマ規制対応）と成果リンク。
 *
 * **法令に関わる表示なので、画面ごとに書かせない。**
 * 景品表示法のステルスマーケティング告示（2023-10-01 施行）により、
 * 広告であることを一般の読者が判別できる表示が必要になる。
 * 実装が画面ごとに散ると、要件が変わったときの直し漏れが必ず出る。
 *
 * 文言の正本は copy.ts の UI_COPY.disclosure。ここでも直書きしない。
 */

export function DisclosureNotice({
  /** 順位づけを含む記事では、報酬を順位に使っていないことも併せて出す。 */
  showRankingNote = false,
  /**
   * 設定で組み立てた文言。省略時は既定の文言。
   *
   * **画面が自由に書ける欄ではない。** 渡してよいのは
   * ドメインの `buildVisibleMessage()` が作った文字列だけ。
   * 設定画面が「読者に出るのと同じ見た目」で確認するために開けてある。
   */
  message,
  methodologyHref,
  policyHref,
}: {
  readonly showRankingNote?: boolean;
  readonly message?: string;
  readonly methodologyHref?: string;
  readonly policyHref?: string;
}) {
  return (
    // role="note" ではなく region + 見出しにして、読み上げでも飛ばせるようにする。
    <aside className={styles.disclosure} aria-label={UI_COPY.disclosure.bannerTitle}>
      <span className={styles.disclosureTitle}>{UI_COPY.disclosure.bannerTitle}</span>
      <span>{message ?? UI_COPY.disclosure.bannerBody}</span>
      {showRankingNote && <span>{UI_COPY.disclosure.rankingNote}</span>}
      {(methodologyHref !== undefined || policyHref !== undefined) && (
        <span className={styles.disclosureLinks}>
          {methodologyHref !== undefined && (
            <a href={methodologyHref}>{UI_COPY.disclosure.methodologyLink}</a>
          )}
          {policyHref !== undefined && <a href={policyHref}>{UI_COPY.disclosure.policyLink}</a>}
        </span>
      )}
    </aside>
  );
}

/**
 * 成果リンク。
 *
 * 2 つの決まりを部品側で強制する。
 *   1. `rel` に sponsored を必ず含める（検索エンジンへの申告）
 *   2. ASP が発行した URL を**改変しない**（パラメータの付け足しをしない）
 *
 * href をそのまま渡すだけの薄い部品に見えるが、
 * `rel` の指定を呼び出し側に任せた時点で付け忘れが起きる。
 */
export function AffiliateLink({
  href,
  children,
  onNavigate,
  linkId,
  productId,
  placement = "本文",
}: {
  /** ASP が発行した URL。**ここで加工しない。** */
  readonly href: string;
  readonly children: React.ReactNode;
  /** 計測用。リンク先は変えない。 */
  readonly onNavigate?: () => void;
  /** どのリンクか。省略しても数えるが、内訳が出せなくなる。 */
  readonly linkId?: string;
  readonly productId?: string;
  /** 記事のどこに置いたリンクか。 */
  readonly placement?: string;
}) {
  return (
    <a
      href={href}
      rel="sponsored nofollow noopener"
      target="_blank"
      onClick={onNavigate}
      data-affiliate="true"
      // 計測の印。**部品側で必ず付ける**ので、画面が付け忘れることがない。
      // URL そのものは印にしない（ASP のパラメータを記録に持ち込まない）。
      {...telemetryAttrs({
        kind: "affiliate_link",
        id: linkId ?? productId ?? "(リンクID未設定)",
        placement,
      })}
    >
      {children}
    </a>
  );
}
