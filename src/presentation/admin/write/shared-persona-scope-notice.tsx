import { Callout } from "@/presentation/ui";

/**
 * site 配下から見ている書き手・読者像の保存範囲を正直に示す。
 *
 * 現在の保存先は site 単位ではなく workspace 単位である。各画面へ同じ注意を
 * 書き写すと、片方だけ site 保存へ移った日に古い説明が残るため、この部品を正本にする。
 */
export function SharedPersonaScopeNotice({
  resourceLabel,
  siteName,
}: {
  readonly resourceLabel: "書き手" | "読者像";
  readonly siteName: string;
}) {
  return (
    <Callout
      title={`${resourceLabel}は全ブログで共通です`}
      reason={`いまは「${siteName}」から見ています。ここで登録した${resourceLabel}は、このブログだけでなく、この作業場所のすべてのブログで使われます。`}
    />
  );
}
