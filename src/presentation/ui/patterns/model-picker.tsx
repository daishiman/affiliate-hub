import { Callout } from "../primitives/callout";
import styles from "./patterns.module.css";

/**
 * どのモデルで書くかを選ぶ欄。
 *
 * --- 既定値を選ばない ---
 * 未選択のままの選択肢を先頭に置き、`required` を付けて送らせない。
 * 「いちばん安いもの」や「前に使ったもの」を初期値にすると、
 * **選んだ覚えのないモデルで記事ができる**。しかも記録には
 * そのモデル名だけが残るので、あとから見た人には
 * 「利用者が選んだ」ようにしか見えない。
 *
 * --- 選べないものを隠さない ---
 * 鍵が入っていない提供元も一覧に出し、`disabled` と理由を添える。
 * 隠すと、画面には「Anthropic しかない」ようにしか見えず、
 * ほかの 3 社が使えるはずだと知らないまま終わる。
 *
 * --- 単価をその場に出す ---
 * 選ぶ時点でしか意味がない情報である。押したあとに出しても、
 * 高いほうを選んだことに気づくのは請求のときになる。
 *
 * 送信は普通のフォーム（GET）。JavaScript が動かなくても選べる。
 */
export type ModelPickerModel = {
  readonly modelId: string;
  readonly label: string;
  readonly inputPricePerMillionMinor: number;
  readonly outputPricePerMillionMinor: number;
  readonly currency: string;
};

export type ModelPickerGroup = {
  readonly providerId: string;
  readonly label: string;
  readonly models: readonly ModelPickerModel[];
  /** 選べない理由。選べるときは `null`。 */
  readonly unavailableReason: string | null;
};

export function ModelPicker({
  action,
  fieldName,
  separator,
  groups,
  selected,
  emptyReason,
  hiddenFields = [],
  submitLabel,
}: {
  readonly action: string;
  readonly fieldName: string;
  /** 提供元とモデルを 1 つの値で運ぶときの区切り。 */
  readonly separator: string;
  readonly groups: readonly ModelPickerGroup[];
  /** いま選ばれている値（`提供元::モデル`）。未選択は空文字。 */
  readonly selected: string;
  /** 1 つも選べないときの理由。選べるものがあれば `null`。 */
  readonly emptyReason: string | null;
  /** 選択と一緒に送り直す値（いまの試し方など）。 */
  readonly hiddenFields?: readonly { readonly name: string; readonly value: string }[];
  readonly submitLabel: string;
}) {
  return (
    <div className={styles.materialForm}>
      <form method="get" action={action}>
        {hiddenFields.map((f) => (
          <input key={f.name} type="hidden" name={f.name} value={f.value} />
        ))}
        <label className={styles.materialLabel} htmlFor="model-picker-select">
          どのモデルで書くか
        </label>
        <select
          id="model-picker-select"
          name={fieldName}
          defaultValue={selected}
          required
          disabled={emptyReason !== null}
          className={styles.materialInput}
          aria-describedby="model-picker-hint"
        >
          {/* 既定を置かない。選ばずに送ると、ここで止まる。 */}
          <option value="">選んでください</option>
          {groups.map((group) => (
            <optgroup
              key={group.providerId}
              label={
                group.unavailableReason === null
                  ? group.label
                  : `${group.label}（いまは選べません）`
              }
              disabled={group.unavailableReason !== null}
            >
              {group.models.length === 0 ? (
                /*
                  値を空にしない。空にすると「選んでください」と同じ値の
                  選択肢が複数になり、**最後のものが初期選択になる**
                  （単一選択の select では後の `selected` が勝つ）。
                  結果、開いた直後の表示が「選べるモデルがありません」になる。
                  この値は区切りだけなので、送られても選択としては通らない。
                */
                <option value={`${group.providerId}${separator}`} disabled>
                  選べるモデルがありません
                </option>
              ) : (
                group.models.map((m) => (
                  <option
                    key={m.modelId}
                    value={`${group.providerId}${separator}${m.modelId}`}
                    disabled={group.unavailableReason !== null}
                  >
                    {m.label}（100 万トークンあたり 入力 {m.inputPricePerMillionMinor} / 出力{" "}
                    {m.outputPricePerMillionMinor} {m.currency}）
                  </option>
                ))
              )}
            </optgroup>
          ))}
        </select>
        <p className={styles.materialHint} id="model-picker-hint">
          既定のモデルは置いていません。選ばずに押しても始まりません（選んだ覚えのないモデルで書かれた記事が、選んで書いたものと同じ形で残るのを避けるためです）。選んだ提供元とモデルは、できた記事の版に残ります。
        </p>
        <button type="submit" className={styles.filterSubmit} disabled={emptyReason !== null}>
          {submitLabel}
        </button>
      </form>

      {emptyReason !== null && (
        <Callout tone="warn" title="いま選べるモデルがありません" reason={emptyReason} />
      )}

      {groups.some((g) => g.unavailableReason !== null) && (
        <ul className={styles.filterUnavailable}>
          {groups
            .filter((g) => g.unavailableReason !== null)
            .map((g) => (
              <li key={g.providerId}>
                {g.label}: {g.unavailableReason}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
