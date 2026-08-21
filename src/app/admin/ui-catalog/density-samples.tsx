import type { ReactNode } from "react";
import styles from "../admin.module.css";

/**
 * 「詰まり具合の見比べ」の中身（見本帳の 22 番）。
 *
 * 見本帳の 1 節をわざわざ別ファイルにしているのは、**ここだけを外から描くため**である。
 * `scripts/write-static-preview.tsx` が、ログインの要らない 1 枚の HTML へ焼くときに
 * 同じものを描く。ページごと描こうとすると、その画面が持っている
 * 「いま操作している人」の取得まで一緒に付いてきて、外からは描けない。
 *
 * **写しを作らない**ためでもある。焼く側で似たものを書き起こすと、
 * 見てもらった見た目と実物が、片方だけ直したときに黙ってずれる。
 * 同じ部品を描いていれば、ずれようがない。
 */
export function DensitySamples() {
  return (
    <>
      <p className={styles.sectionLead}>
        「詰まっている」と言われた 4 点を、直す前と直したあとで並べます。
        数字はトークンの値からの計算で、ブラウザで測った値ではありません（画像で比べる仕組みがまだ無いため）。
      </p>
      <div className={styles.catalogStack}>
        <DensityPair
          title="① 案内の 1 行の高さ 60px → 44px"
          note="行送りに指の当たり判定の 44px を使っていた。高さの下限は別に持っているので二重だった。押せる大きさは変わらない。19 項目で 304px。"
          before={
            <div className={styles.densityNavList}>
              <span className={styles.densityNavRow}>商品</span>
              <span className={styles.densityNavRow}>根拠</span>
              <span className={styles.densityNavRow}>記事</span>
            </div>
          }
          after={
            <div className={styles.densityNavList}>
              <span className={styles.densityNavRowFixed}>商品</span>
              <span className={styles.densityNavRowFixed}>根拠</span>
              <span className={styles.densityNavRowFixed}>記事</span>
            </div>
          }
        />
        <DensityPair
          title="② カードどうしの間隔 0px → 16px"
          note="カードにも注意書きにも外余白が無く、画面の器にも間隔が無かった。2 つ以上置いた画面では線どうしが接して 1 枚の板に見えていた。"
          before={
            <div className={styles.densityCards}>
              <div className={styles.densityCard}>商品</div>
              <div className={styles.densityCard}>並べて比べる</div>
            </div>
          }
          after={
            <div className={styles.densityCardsFixed}>
              <div className={styles.densityCard}>商品</div>
              <div className={styles.densityCard}>並べて比べる</div>
            </div>
          }
        />
        <DensityPair
          title="③ 読ませる文の行の長さ 上限なし → 34rem"
          note="上限が無いと、画面を広げたぶんだけ 1 行が伸びる。幅 1024px・16px の文字で 1 行 64 字。表やカードは広く使ってよいが、読ませる文だけ絞る。"
          before={<p className={styles.densityProse}>{DENSITY_SAMPLE_TEXT}</p>}
          after={<p className={styles.densityProseFixed}>{DENSITY_SAMPLE_TEXT}</p>}
        />
      </div>
      <p className={styles.sectionLead}>
        ④ 並べたカードの幅は、器の上限を 64rem（本文カラム用）から 72rem（一覧・表用）に変えました。
        ただし 1 行に並ぶ枚数は 3 枚のままで増えていません。4 枚にするにはカードの最小幅 18rem を下げることになり、
        値・その意味・行き先の 3 つを 1 枚に入れる約束が入りきらなくなるので、ここでは下げていません。
      </p>
    </>
  );
}

const DENSITY_SAMPLE_TEXT =
  "扱っている商品をさがし、仕様・根拠・検証記録を確かめます。条件を変えると一覧がその場で入れ替わり、商品名を選ぶと個別の画面に移ります。";

function DensityPair({
  title,
  note,
  before,
  after,
}: {
  readonly title: string;
  readonly note: string;
  readonly before: ReactNode;
  readonly after: ReactNode;
}) {
  return (
    <div>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <p className={styles.sectionLead}>{note}</p>
      <div className={styles.densityPair}>
        <div className={styles.densitySide}>
          <span className={styles.densityLabel}>直す前</span>
          {before}
        </div>
        <div className={styles.densitySide}>
          <span className={styles.densityLabel}>直したあと</span>
          {after}
        </div>
      </div>
    </div>
  );
}
