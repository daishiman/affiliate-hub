import { ScopeSwitch, TextLink } from "@/presentation/ui";

/**
 * 「いまどのブログを見ているか」と、切り替えの行き先。
 *
 * `select` にしないのは、**切り替えが URL に残る**ようにするため。
 * 版面を直しているときに別の画面へ寄り道して戻ると、`select` だと
 * 選び直しになる。リンクなら戻るボタンで同じブログに帰れる。
 * ブログが 1 本しか無いときは、切り替え先が無いので何も出さない。
 *
 * 入れ物が `Note` から `ScopeSwitch` に変わっている（2026-08-27）。
 * **これは操作であって注記ではない**——押し間違えると別のブログの版面を
 * 直しはじめる。理由と経緯は `scope-switch.tsx` の doc。
 */
export function BlogSiteSwitch({
  basePath,
  current,
  options,
}: {
  readonly basePath: `/admin/${string}`;
  readonly current: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}) {
  if (options.length <= 1) return null;
  return (
    <ScopeSwitch label="ブログ:">
      {options.map((option) =>
        option.value === current ? (
          <strong key={option.value}>{option.label.trim()}</strong>
        ) : (
          <TextLink key={option.value} href={`${basePath}?site=${encodeURIComponent(option.value)}`}>
            {option.label.trim()}
          </TextLink>
        ),
      )}
    </ScopeSwitch>
  );
}
