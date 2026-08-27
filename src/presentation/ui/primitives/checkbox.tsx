import styles from "./ui.module.css";

/**
 * はい / いいえ を 1 つだけ聞く欄。
 *
 * --- `CheckboxGroup` と分けている理由 ---
 * あちらは「複数から選ぶ」欄で、`fieldset` + `legend` が要る。
 * 聞きたいことが 1 つしか無いときにあれを使うと、
 * 読み上げで「見出し 1 つ・項目 1 つ」という空回りの入れ子が読まれる。
 *
 * --- 素の `<input type="checkbox">` を画面へ直に置かない理由 ---
 * 素で置くと**押しどころが下限（`--tap-target-min`）に届かない**。
 * チェック升そのものは 13px 前後しかなく、指で押すには小さい。
 * `.choiceItem` を持つ `<label>` で包むと、升と文字の両方が押しどころになる。
 * `tests/ui/screen-hit-and-current.test.tsx` が見ているのはここである。
 *
 * 見た目の値は新しく作っていない。`CheckboxGroup` の各項目と同じ `.choiceItem` を使う。
 * 別の値にすると、同じ「選ぶ」操作が画面によって違う大きさになる。
 */
export type CheckboxProps = {
  readonly name: string;
  /** 何に「はい」と答えることになるのかを、そのまま書く。 */
  readonly label: string;
  readonly defaultChecked?: boolean;
  /** この欄が AI から見て何の値かの説明 (WebMCP)。 */
  readonly toolParamDescription?: string;
};

export function Checkbox({ name, label, defaultChecked = false, toolParamDescription }: CheckboxProps) {
  return (
    <label className={styles.choiceItem} toolparamdescription={toolParamDescription}>
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
      {label}
    </label>
  );
}
