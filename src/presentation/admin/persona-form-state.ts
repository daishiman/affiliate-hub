import type { Tone } from "@/domain/authoring";
import { parseNonEmptyLines } from "./non-empty-lines";
import type { AdminActionState } from "./use-case-result";

/**
 * 書き手・読者像を登録する画面の状態。
 *
 * `persona-form-action.ts` から分けてあるのは `product-form-state.ts` と同じ理由で、
 * `"use server"` を付けたファイルは**非同期の関数しか外へ出せない**（型も初期値も置けない）。
 *
 * 書き手と読者像で 1 つの型にしてある。入れる項目はまるで違うが、
 * 押した後に知りたいことは「通ったか」「どの欄が悪いか」「どこへ行けるか」の 3 つで同じ。
 */

export type PersonaFormState = AdminActionState & {
  /** できた書き手・読者像を見に行く先。成功したときだけ入る。 */
  readonly personaListPath?: string;
};

export const INITIAL_PERSONA_FORM_STATE: PersonaFormState = { status: "idle", message: "" };

/**
 * 一覧の欄の書式。**1 行 1 件。**
 *
 * カンマ区切りにしていない。得意分野にも禁止表現にも読点は普通に出てくるので、
 * 区切り文字を本文に出る文字にすると「区切ったつもりのない場所」で切れる。
 * 空行は落とす。落とさないと、空の項目が比較表の列や禁止語として登録される。
 */
export const parseLines = parseNonEmptyLines;

/** 保存済みの一覧を、上の書式へ戻す。直す画面の初期値に使う。 */
export function formatLines(values: readonly string[]): string {
  return values.join("\n");
}

/** 文体の 6 軸の呼び名。内部のキーをそのまま出しても、何を決める欄か分からない。 */
export const TONE_AXIS_LABELS: Readonly<Record<keyof Tone, string>> = {
  formality: "かたさ（敬語の度合い）",
  analytical: "理屈っぽさ（根拠を並べる度合い）",
  emotional: "感情の出し方",
  assertiveness: "言い切りの強さ",
  humor: "くだけた言い回し",
  emojiUsage: "絵文字の多さ",
};

export const TONE_AXES = Object.keys(TONE_AXIS_LABELS) as readonly (keyof Tone)[];

/**
 * 文体の既定値。**6 軸とも「まんなか」にする。**
 *
 * 0 でも 1 でもないのは、未入力を端に寄せると「決めていない」が
 * 「極端に決めた」として生成へ渡るため。まんなかなら、決めていないことが
 * 文章の偏りとして現れない。
 */
export const DEFAULT_TONE_VALUE = 0.5;

/**
 * 文体の 1 軸を読む。空欄はまんなか。
 *
 * 範囲の検査はここでしない。0.0〜1.0 の判定は `createAuthorPersona` が持っていて、
 * 画面にも同じ判定を置くと、片方だけ直したときに通る値が食い違う。
 * ここがするのは「数として読めなければまんなかに倒す」ところまで。
 */
export function parseToneValue(raw: FormDataEntryValue | null): number {
  const text = String(raw ?? "").trim();
  if (text === "") return DEFAULT_TONE_VALUE;
  const value = Number(text);
  return Number.isFinite(value) ? value : DEFAULT_TONE_VALUE;
}
