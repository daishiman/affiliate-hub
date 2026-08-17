import { cookies } from "next/headers";
import {
  type Appearance,
  modeOptions,
  resolveAppearance,
  themeOptions,
} from "@/domain/authoring/appearance";
import { APPEARANCE_COOKIE } from "@/presentation/ui/appearance";

/**
 * いまの人が選んでいる見た目を読む。
 *
 * **cookie を読む場所をここ 1 つにする。**
 * 画面ごとに読むと、cookie の名前を 1 つ直したときに直し漏れた画面だけ
 * 既定色に戻り、しかも壊れて見えないので気づけない。
 *
 * 呼ぶのは 3 箇所だけ:
 *   `src/app/layout.tsx`            全画面の一番外側に当てる
 *   `src/app/admin/settings/page.tsx` 選択欄に現在値を出す
 *   `src/presentation/site/page-frame.tsx` 読者向け 18 ルートの足元の切り替え
 */
export async function readAppearance(siteDefault?: Appearance): Promise<Appearance> {
  const cookieStore = await cookies();
  return resolveAppearance({
    // ブログの中では配色はブランドが決めるので、個人の配色は読まない。
    chosenTheme: siteDefault === undefined ? cookieStore.get(APPEARANCE_COOKIE.scheme)?.value : null,
    chosenMode: cookieStore.get(APPEARANCE_COOKIE.mode)?.value,
    siteDefault: siteDefault ?? null,
  });
}

/** 選択欄に渡す選択肢。画面は配色の一覧を持たない。 */
export function appearanceOptions(): {
  readonly schemeOptions: readonly { readonly value: string; readonly label: string }[];
  readonly modeOptions: readonly { readonly value: string; readonly label: string }[];
} {
  return { schemeOptions: themeOptions(), modeOptions: modeOptions() };
}
