import { CHANNEL_CAPABILITIES } from "@/domain/distribution/channel";
import {
  ActionNote,
  ChannelBadge,
  ChannelStatusList,
  ConceptMatrixLauncher,
  NavCollapseToggle,
  Prose,
  toConceptAxes,
} from "@/presentation/ui";
import styles from "../admin.module.css";

/**
 * 配信先・切り口・押す物の隣の一文の見本。
 *
 * 見本の値は**能力表そのもの**から作る。手で書き写すと、
 * 表を直したときに見本だけが古くなり、見本帳が嘘をつく。
 */

/** 出稿の進み具合を、失敗も含めて 1 通りずつ出す。 */
export function ChannelStatusSamples() {
  return (
    <div className={styles.catalogStack}>
      <ChannelStatusList
        entries={[
          { capability: CHANNEL_CAPABILITIES.x, state: "done", href: "/admin/distribution" },
          { capability: CHANNEL_CAPABILITIES.note, state: "scheduled" },
          {
            capability: CHANNEL_CAPABILITIES.instagram,
            state: "not_started",
          },
          {
            capability: CHANNEL_CAPABILITIES.wordpress,
            state: "failed",
            failureReason: "接続の期限が切れています。設定の画面でつなぎ直してください。",
          },
          // 理由を渡し忘れた失敗。部品が代わりの 1 文を出すことを見本でも示す。
          { capability: CHANNEL_CAPABILITIES.youtube, state: "failed" },
        ]}
      />
      <Prose>札だけを狭い場所に置くとこうなります。</Prose>
      <div className={styles.catalogRow}>
        <ChannelBadge capability={CHANNEL_CAPABILITIES.x} state="sending" />
        <ChannelBadge capability={CHANNEL_CAPABILITIES.newsletter} state="done" />
        <ChannelBadge capability={CHANNEL_CAPABILITIES.tiktok} state="not_started" />
      </div>
      <ChannelStatusList entries={[]} />
    </div>
  );
}

/** 見本用のブログ 2 本。設計図の 10 軸のうち 3 つだけを取る道筋も見せる。 */
const SAMPLE_SITES = [
  {
    id: "site-hikaku",
    name: "比べて選ぶブログ",
    differentiation: toConceptAxes({
      targetReader: "はじめて買う人",
      searchIntent: "どれを買えばいいか知りたい",
      conclusionStance: "1 つに絞って薦める",
      // 残りの 7 軸は部品が読まない。渡しても捨てられる。
    }),
  },
  {
    id: "site-tsukaikata",
    name: "使い方を深掘るブログ",
    differentiation: toConceptAxes({
      targetReader: "すでに持っている人",
      searchIntent: "うまく使う方法を知りたい",
      conclusionStance: "用途ごとに分けて示す",
    }),
  },
] as const;

/** 1 商品を、選んだブログの切り口で書き分ける導線。 */
export function ConceptMatrixSamples() {
  return (
    <div className={styles.catalogStack}>
      <ConceptMatrixLauncher
        product={{ id: "prod-sample", name: "静音キーボード A" }}
        sites={SAMPLE_SITES}
        selectedSiteIds={["site-hikaku", "site-tsukaikata"]}
        overrides={{ "site-tsukaikata": { stance: "今回だけ: 買い替えを勧めない" } }}
      />
      {/* 何も選んでいないとき。押せない理由をボタンの文言そのものに出す。 */}
      <ConceptMatrixLauncher
        product={{ id: "prod-sample", name: "静音キーボード A" }}
        sites={SAMPLE_SITES}
      />
    </div>
  );
}

/** 押す物の隣に置く 1 文と、案内を畳むボタン。 */
export function ActionNoteSamples() {
  return (
    <div className={styles.catalogStack}>
      <ActionNote>
        ここで配信が 1 件登録されます。実際の投稿は登録した日時に行われます。
      </ActionNote>
      <ActionNote tone="danger">
        消したブログは元に戻せません。公開済みの記事も同時に見えなくなります。
      </ActionNote>
      <Prose>
        案内を畳むボタン。畳むのは見た目だけで、項目の名前も行き先も残ります。
        ここで押すと、いま開いている管理画面の案内も畳まれます。
      </Prose>
      <NavCollapseToggle />
    </div>
  );
}
