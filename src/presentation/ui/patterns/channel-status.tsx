import styles from "./patterns.module.css";

/**
 * 配信先ごとの出稿状態。
 *
 * **この部品は配信先の種別で分岐しない。** 分岐を 1 つでも持つと、
 * SNS を足すたびにその分岐を全部探して直すことになり、
 * 「プロバイダ実装の追加だけで完了する」(A4) が崩れる。
 *
 * 分岐を持たずに済むのは、表示に要る値をすべて能力表
 * (`CHANNEL_CAPABILITIES`) が持っているため。
 *
 *   何と呼ぶか   … `label`
 *   状態の言い方 … `statusLabels[state]`（方式ごとに違う）
 *   見分けの色   … `accentToken`（生の色値でなくトークン名）
 *   絵柄         … `iconName`（投稿方式ごとの 3 種）
 *
 * 状態の言い方を配信先が持つ理由が最も重い。公式 API の無い配信先に
 * 「送信中」と出すと嘘になる。人が貼り付けるまで、こちらは何もしていない。
 */

/**
 * 投稿方式。ドメインの同名の型と**同じ字面**にしてある。
 *
 * ドメインを import しないのは、共通部品が業務のきまりを持ち込まないため。
 * ドメインの能力表はこの形に構造的に当てはまるので、画面はそのまま渡せる。
 * 逆に、部品が要らない項目（規約の根拠・上限文字数など）は受け取らない。
 */
export type ChannelPublishMode = "api_publish" | "api_schedule" | "manual_export";

/** 出稿の進み具合。 */
export type ChannelPublishState =
  | "not_started"
  | "scheduled"
  | "sending"
  | "done"
  | "failed";

/** 表示に要る分だけの配信先。ここに項目を足す前に、本当に画面が使うか確かめる。 */
export type ChannelView = {
  readonly kind: string;
  readonly label: string;
  readonly accentToken: string;
  readonly iconName: ChannelPublishMode;
  readonly statusLabels: Readonly<Record<ChannelPublishState, string>>;
};

export type ChannelStatusEntry = {
  readonly capability: ChannelView;
  readonly state: ChannelPublishState;
  /**
   * 失敗の理由。`state === "failed"` のときは必ず渡す。
   *
   * 理由の無い失敗表示は、見た人に何もできることを与えない。
   * 渡し忘れたときに黙って消えないよう、部品側で代わりの 1 文を出す。
   */
  readonly failureReason?: string;
  /** 出稿先の詳細への行き先。無い配信先もあるので任意。 */
  readonly href?: string;
};

/** 絵柄の見た目。**投稿方式ごとの 3 種だけ**で、配信先ごとに増やさない。 */
const MODE_GLYPH = {
  api_publish: "▲",
  api_schedule: "◷",
  manual_export: "▤",
} as const;

/** 読み上げ向けの方式名。絵柄だけでは何も伝わらない人がいる。 */
const MODE_NAME = {
  api_publish: "自動で投稿",
  api_schedule: "予約して投稿",
  manual_export: "書き出して手で貼り付け",
} as const;

/**
 * 配信先 1 つ分の札。一覧の行や詳細の見出し脇など、狭い場所に置く。
 */
export function ChannelBadge({
  capability,
  state,
}: {
  readonly capability: ChannelView;
  readonly state: ChannelPublishState;
}) {
  return (
    <span
      className={styles.channelBadge}
      // 色は CSS 変数の名前で渡す。生値を書くと、明暗の切り替えでここだけ取り残される。
      style={{ ["--channel-accent" as string]: `var(${capability.accentToken})` }}
      data-channel={capability.kind}
      data-state={state}
    >
      <span className={styles.channelGlyph} aria-hidden="true">
        {MODE_GLYPH[capability.iconName]}
      </span>
      <span className={styles.channelName}>{capability.label}</span>
      <span className={styles.channelState}>{capability.statusLabels[state]}</span>
      {/* 絵柄の意味を読み上げにも残す。見た目だけの情報にしない。 */}
      <span className={styles.srOnly}>（{MODE_NAME[capability.iconName]}）</span>
    </span>
  );
}

/**
 * 配信先の一覧。1 記事がどこへ出ているかを 1 か所で見せる。
 *
 * 渡された順で並べる。並べ替えの判断は業務側の仕事で、部品は持たない。
 */
export function ChannelStatusList({
  entries,
  emptyMessage = "まだどこにも出していません。",
}: {
  readonly entries: readonly ChannelStatusEntry[];
  /** 0 件のときの 1 文。何も出さないと、壊れているのか空なのか分からない。 */
  readonly emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return <p className={styles.channelEmpty}>{emptyMessage}</p>;
  }
  return (
    <ul className={styles.channelList}>
      {entries.map((entry) => {
        const failed = entry.state === "failed";
        return (
          <li key={entry.capability.kind} className={styles.channelRow}>
            {entry.href !== undefined ? (
              <a href={entry.href} className={styles.channelLink}>
                <ChannelBadge capability={entry.capability} state={entry.state} />
              </a>
            ) : (
              <ChannelBadge capability={entry.capability} state={entry.state} />
            )}
            {failed && (
              // 失敗したのに理由が無い状態を、黙って空欄にしない。
              // 空欄だと「理由が無い」のか「渡し忘れ」なのか区別が付かない。
              <span className={styles.channelReason} role="status">
                {entry.failureReason ?? "理由が記録されていません。運用担当へ連絡してください。"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
