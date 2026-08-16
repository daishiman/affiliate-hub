import type { ChannelPublishInput, ManualExportPort, PortResult } from "@/application/ports";
import type { ChannelKind } from "@/domain/distribution";
import { CHANNEL_CAPABILITIES } from "@/domain/distribution";
import { ok } from "@/domain/shared";

/**
 * 公式 API が無いチャネル向けの下書き書き出し。
 *
 * note が該当する。note には公開された投稿用 API が存在しないため、
 * 本システムは投稿を代行しない。下書きを作り、貼り付け手順を添える。
 *
 * ここに非公式 API を呼ぶ実装を足してはならない
 * (規約違反であり、予告なく壊れる)。
 *
 * これはスタブではない。書き出しは今の実装で完結している。
 */
export function createManualExport(kind: ChannelKind): ManualExportPort {
  const capability = CHANNEL_CAPABILITIES[kind];

  return {
    async buildDraft(input: ChannelPublishInput): PortResult<{ markdown: string; instructions: string }> {
      const parts: string[] = [];

      if (input.title !== null) parts.push(`# ${input.title}`, "");

      // 広告表記は本文の先頭に置く。貼り付ける人が消せてしまわないよう、手順にも書く。
      parts.push(input.disclosureText, "");
      parts.push(input.body);

      if (input.imageKeys.length > 0) {
        parts.push("", "---", "## 添付する画像", ...input.imageKeys.map((k, i) => `${i + 1}. ${k}`));
      }

      const instructions = [
        `${capability.label} には外部から投稿するための公開APIがありません。次の手順でご自身で投稿してください。`,
        "",
        `1. ${capability.label} を開き、新しい記事を作成します。`,
        "2. 下の本文をそのまま貼り付けます。",
        "3. **先頭の広告表記は消さないでください。** 消すと法令上の表示義務を満たせなくなります。",
        input.imageKeys.length > 0 ? "4. 添付画像の一覧に従って、画像をアップロードします。" : null,
        input.scheduledAt !== null
          ? `5. 公開日時を ${input.scheduledAt.toLocaleString("ja-JP")} に設定します。`
          : null,
        "",
        "投稿後、公開されたURLをこの画面に登録すると、成果の集計に反映されます。",
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      return ok({ markdown: parts.join("\n"), instructions });
    },
  };
}
