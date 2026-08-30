import { FormValue } from "../primitives/form-value";
import { Button } from "../primitives/button";
import { HumanOnlyForm } from "../primitives/human-only-form";
import styles from "./patterns.module.css";

/**
 * 1 商品から複数ブログへ、コンセプト別の文章を作らせる導線 (A5)。
 *
 * **切り口を人が毎回入力しない。** ブログの設計図は既に 10 軸の違いを持っている。
 * 同じことを画面でもう一度聞くのは、答えてある質問を聞き直すのと同じで、
 * しかも聞き直すたびに設計図と食い違う余地が増える。
 *
 * 画面に出すのは 10 軸のうち 3 つだけにする。ここで人がする判断は
 * 「どのブログに書き分けるか」であって「切り口を決め直すこと」ではない。
 * 2 本選べば 10 軸は 20 項目になり、読む量が判断の量を追い越す。
 */

/** 画面に出す切り口。設計図の 10 軸から、選ぶ判断に要る 3 つだけを取る。 */
export type ConceptAxes = {
  /** 誰に向けて書くか。 */
  readonly audience: string;
  /** どんな検索意図に応えるか。 */
  readonly searchIntent: string;
  /** 結論でどちらの立場を取るか。 */
  readonly stance: string;
};

/**
 * 設計図の 10 軸のうち、この部品が読む 3 つ。
 *
 * ドメインの型を import しない。共通部品が業務のきまりを持ち込むと、
 * 設計図に軸が増えるたびに部品の側も動くことになる。
 * 設計図はこの形に構造的に当てはまるので、画面はそのまま渡せる。
 */
type ConceptAxesSource = {
  readonly targetReader: string;
  readonly searchIntent: string;
  readonly conclusionStance: string;
};

/**
 * 設計図の 10 軸から画面用の 3 軸へ。**選ぶのはここ 1 か所だけ**にする。
 *
 * 部品ではなく変換なので `const` で置く（見本帳に並べても確かめる物が無い）。
 */
export const toConceptAxes = (axes: ConceptAxesSource): ConceptAxes => {
  return {
    audience: axes.targetReader,
    searchIntent: axes.searchIntent,
    stance: axes.conclusionStance,
  };
};

export type ConceptMatrixSite = {
  readonly id: string;
  readonly name: string;
  readonly differentiation: ConceptAxes;
};

export type ConceptMatrixProduct = {
  readonly id: string;
  readonly name: string;
};

/** 今回だけ切り口を変えたいときの差し替え。触った軸だけを持つ。 */
export type ConceptOverride = Partial<ConceptAxes>;

export type ConceptMatrixLauncherProps = {
  readonly product: ConceptMatrixProduct;
  readonly sites: readonly ConceptMatrixSite[];
  /** 書き分ける先。既定は空 = まだ選んでいない。 */
  readonly selectedSiteIds?: readonly string[];
  /**
   * どの企画から書き分けるか。送り先はこれを受け取って記事の枠を作る。
   *
   * 商品 id と別に運ぶ。同じ商品でも企画が違えば読者像も目的も変わり、
   * 商品 id から企画を引き直させると、引き直した先が 1 つに定まらない。
   */
  readonly packageId?: string;
  /** ブログ id ごとの差し替え。渡した軸だけが設計図より優先される。 */
  readonly overrides?: Readonly<Record<string, ConceptOverride>>;
  /**
   * 送り先。省略時は押しても飛ばない (見本表示のため)。
   *
   * 文字列と関数の両方を受ける。見本帳は URL を渡し、画面は
   * server action を渡す。片方しか受けない形にすると、
   * 見本帳のためだけの API route が 1 本増える。
   */
  readonly action?: string | ((formData: FormData) => void | Promise<void>);
};

/** 軸の見出し。画面ごとに書き換えないよう、ここを正本にする。 */
const AXIS_LABEL: Readonly<Record<keyof ConceptAxes, string>> = {
  audience: "誰に向けて",
  searchIntent: "どんな検索意図に",
  stance: "結論の立場",
};

const AXIS_ORDER: readonly (keyof ConceptAxes)[] = ["audience", "searchIntent", "stance"];

/** 設計図の既定に差し替えを重ねる。差し替えの無い軸は設計図のまま。 */
function resolveAxes(site: ConceptMatrixSite, override: ConceptOverride | undefined): ConceptAxes {
  if (!override) return site.differentiation;
  return {
    audience: override.audience ?? site.differentiation.audience,
    searchIntent: override.searchIntent ?? site.differentiation.searchIntent,
    stance: override.stance ?? site.differentiation.stance,
  };
}

export function ConceptMatrixLauncher({
  product,
  sites,
  selectedSiteIds = [],
  packageId,
  overrides,
  action,
}: ConceptMatrixLauncherProps) {
  // 並び順は渡されたブログの順に従う。選んだ順に並べ替えると、
  // 選び直すたびに画面上の位置が動いて、読み直しが必要になる。
  const targets = sites.filter((site) => selectedSiteIds.includes(site.id));
  const nothingChosen = targets.length === 0;

  return (
    // method は送り先が URL のときだけ付ける。server action に method を添えると、
    // React が組み立てる送信経路と食い違う。
    <HumanOnlyForm
      className={styles.conceptMatrix}
      action={action}
      method={typeof action === "string" ? "post" : undefined}
      reason={
        "どの切り口でどのブログに書き分けるかを決めることは、編集方針そのものである。" +
        "目録の get_generation_matrix は読み取り専用で、その説明にも" +
        "「表を見て決めるのは人で、AI は表を作るところまで」と書いてある。" +
        "ここを AI から呼べるようにすると、その境界が画面の側から破れる。"
      }
    >
      <h2 className={styles.conceptTitle}>{product.name} を、選んだブログの切り口で書く</h2>

      {nothingChosen ? (
        <p className={styles.conceptEmpty}>
          書き分ける先をまだ選んでいません。ブログを選ぶと切り口が出ます。
        </p>
      ) : (
        <ul className={styles.conceptList}>
          {targets.map((site) => {
            const axes = resolveAxes(site, overrides?.[site.id]);
            const changed = overrides?.[site.id];
            return (
              <li key={site.id} className={styles.conceptItem}>
                <h3 className={styles.conceptSiteName}>{site.name}</h3>
                <dl className={styles.conceptAxes}>
                  {AXIS_ORDER.map((axis) => (
                    <div key={axis} className={styles.conceptAxis}>
                      <dt className={styles.conceptAxisLabel}>{AXIS_LABEL[axis]}</dt>
                      {/* 既定は文字として出す。入力欄にすると「入力を求められている」と読める。 */}
                      <dd className={styles.conceptAxisValue}>
                        {axes[axis]}
                        {changed?.[axis] !== undefined ? (
                          <span className={styles.conceptChanged}>今回だけ変更</span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
                {/*
                  差し替えは隠し値で運ぶ。**入力欄は置かない。**
                  常に開いた入力欄があると、変えなくてよい人にも「ここを埋めるのか」と読ませる。
                  変えたい人は先の画面 (切り口の見直し) で変える。
                */}
                {AXIS_ORDER.map((axis) => (
                  <FormValue key={axis} name={`concept[${site.id}][${axis}]`} value={axes[axis]} />
                ))}
              </li>
            );
          })}
        </ul>
      )}

      <FormValue name="productId" value={product.id} />
      {packageId === undefined ? null : <FormValue name="contentPackageId" value={packageId} />}
      {/*
        押す物は primitive を使う。ここで独自の配色を書くと、
        配色の組み合わせが増えたときにこのボタンだけ検査から外れる。
      */}
      <Button type="submit" tone="primary" disabled={nothingChosen}>
        {nothingChosen ? "ブログを選ぶと始められます" : `${targets.length} 本のブログ向けに書く`}
      </Button>
    </HumanOnlyForm>
  );
}
