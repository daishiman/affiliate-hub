import { Note, TextLink } from "@/presentation/ui";

/**
 * 「いまどのブログを見ているか」と、切り替えの行き先。
 *
 * `select` にしないのは、**切り替えが URL に残る**ようにするため。
 * 版面を直しているときに別の画面へ寄り道して戻ると、`select` だと
 * 選び直しになる。リンクなら戻るボタンで同じブログに帰れる。
 * ブログが 1 本しか無いときは、切り替え先が無いので何も出さない。
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
    <Note>
      ブログ:{" "}
      {options.map((option, index) => (
        <span key={option.value}>
          {index === 0 ? null : " / "}
          {option.value === current ? (
            <strong>{option.label.trim()}</strong>
          ) : (
            <TextLink href={`${basePath}?site=${encodeURIComponent(option.value)}`}>
              {option.label.trim()}
            </TextLink>
          )}
        </span>
      ))}
    </Note>
  );
}
