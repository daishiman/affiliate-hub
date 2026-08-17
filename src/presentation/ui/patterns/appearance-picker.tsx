"use client";

import { useState } from "react";
import {
  APPEARANCE_ATTR,
  APPEARANCE_COOKIE,
  APPEARANCE_COOKIE_MAX_AGE,
  type AppearanceValues,
  appearanceAttributes,
} from "../appearance";
import { Select, type SelectOption } from "../primitives/select";
import styles from "./patterns.module.css";

/**
 * 見た目の選択（配色 × 明暗）。
 *
 * **管理画面用と読者用で二重に作らない。** ここ 1 つを両方が使う。
 * 違いは「どの軸を出すか」だけで、`schemeOptions` を渡すかどうかで決まる。
 *   管理画面: 配色も明暗も選べる（自分の作業環境なので）
 *   読者側  : 明暗だけ選べる（配色はブログが決めたブランドのため）
 * 二重に作ると、明暗の切り替え方が管理画面と読者側で食い違い、
 * 「どちらかだけ直っている」状態が生まれる。
 *
 * **選択肢は渡してもらう。** ここで配色の一覧を持たない。
 * 持つと、配色を 1 つ足すたびにこの部品も直すことになる。
 *
 * --- 切り替えのやり方（再マウントもチラつきも起こさない） ---
 * React の状態でテーマを持ち回すと、切り替えのたびに木全体が描き直され、
 * 入力途中の値が飛ぶ。ここでは **一番外側の要素の属性を書き換えるだけ**にする。
 * 色は CSS カスタムプロパティで解決されるため、属性が変わった瞬間に色だけが変わる。
 *
 * --- 次に開いたときも同じ見た目にする ---
 * 選択は cookie に入れ、最初の描画（サーバー側）で当てる。
 * 実際に当てているのは `src/app/layout.tsx` の 1 箇所。
 *
 * 正直な限界: cookie は端末ごとに保存される。
 * 別の端末で開くと既定に戻る。アカウントに紐づけて持ち回す仕組みは
 * ログインが入ってからで、いまは無い。
 */

/** 見た目の設定を書き留める。他サイトへは送らない。 */
function persist(name: string, value: string): void {
  // SameSite=Lax: 外部サイトからの遷移でこの値が送られないようにする。
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${APPEARANCE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** 一番外側（<html>）の属性を書き換える。 */
function applyToDocument(next: AppearanceValues): void {
  const attrs = appearanceAttributes(next);
  const root = document.documentElement;
  for (const key of [APPEARANCE_ATTR.scheme, APPEARANCE_ATTR.mode]) {
    const value = attrs[key];
    if (value === undefined) root.removeAttribute(key);
    else root.setAttribute(key, value);
  }
}

export function AppearancePicker({
  current,
  schemeOptions,
  modeOptions,
  legend = "画面の見た目",
  description,
}: {
  readonly current: AppearanceValues;
  /** 渡さない画面では配色を選べない（読者向けブログ）。 */
  readonly schemeOptions?: readonly SelectOption[];
  readonly modeOptions: readonly SelectOption[];
  readonly legend?: string;
  readonly description?: string;
}) {
  const [values, setValues] = useState<AppearanceValues>(current);

  const change = (next: AppearanceValues, cookie: string, value: string): void => {
    persist(cookie, value);
    setValues(next);
    applyToDocument(next);
  };

  return (
    <fieldset className={styles.appearancePicker}>
      <legend className={styles.appearanceLegend}>{legend}</legend>
      {description !== undefined && <p className={styles.appearanceNote}>{description}</p>}

      <div className={styles.appearanceFields}>
        {schemeOptions !== undefined && (
          <Select
            label="配色"
            value={values.brandTheme}
            options={schemeOptions}
            hint="押せるものの色と、注意の色が変わります。文字の読みやすさはどの配色でも同じ基準を満たしています。"
            onValueChange={(brandTheme) => {
              if (!schemeOptions.some((o) => o.value === brandTheme)) return;
              change({ ...values, brandTheme }, APPEARANCE_COOKIE.scheme, brandTheme);
            }}
          />
        )}

        <Select
          label="明るさ"
          value={values.colorMode}
          options={modeOptions}
          hint="「端末の設定に合わせる」を選ぶと、夜間モードの切り替わりにも付いていきます。"
          onValueChange={(colorMode) => {
            if (!modeOptions.some((o) => o.value === colorMode)) return;
            change({ ...values, colorMode }, APPEARANCE_COOKIE.mode, colorMode);
          }}
        />
      </div>
    </fieldset>
  );
}
