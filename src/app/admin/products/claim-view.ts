import type { Factuality } from "@/presentation/ui";

/**
 * 主張の種類を「事実／推測／意見」の 3 区分に落とす対応表。
 *
 * **画面ごとに書かない。** 商品ページと根拠ページで区分が食い違うと、
 * 同じ内容が片方では事実、片方では推測に見える。
 *
 * `inference`（複数の根拠から導いた判断）だけが推測。
 * `commercial`（価格・販売先）は測った事実ではなく取得値なので意見扱いにはせず、
 * 由来（いつ・どこから取ったか）とあわせて事実として出す。
 */
const FACTUALITY_BY_CLAIM_TYPE: Readonly<Record<string, Factuality>> = {
  official: "fact",
  measured: "fact",
  experience: "fact",
  external: "fact",
  commercial: "fact",
  inference: "inference",
};

export function factualityOf(claimType: string): Factuality {
  // 対応表に無い種類が来たら、事実に倒さず「意見」に倒す。
  // 分からないものを事実として出す方が害が大きい。
  return FACTUALITY_BY_CLAIM_TYPE[claimType] ?? "opinion";
}

export function formatDate(value: Date | null): string {
  if (value === null) return "期限なし";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(value);
}
