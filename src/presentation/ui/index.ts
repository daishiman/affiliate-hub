/**
 * 共通UI部品の入口。
 *
 * 画面からは必ずここ経由で読む (`@/presentation/ui`)。
 * 個別ファイルを直接指すと、部品を差し替えたとき参照元を全部直すことになる。
 *
 * --- 3 段構成 ---
 *   primitives … 意味を持たない土台。ボタン・入力欄・状態表示。
 *   patterns   … 仕様固有の意味を持つ組み合わせ。順位表・比較表・広告表示など。
 *   templates  … 画面の骨格。ナビゲーションと余白の取り方。
 *
 * 依存の向きは primitives ← patterns ← templates の一方向。
 * patterns が primitives を読むのはよいが、逆は禁止。
 * 逆流すると「比較表を直したらボタンが壊れる」状態になる。
 *
 * 部品はすべて**表示だけ**を行う。
 * データ取得と業務判断を持たせない（それは application 層の仕事）。
 */

/* --- 言葉（画面に出す文言の正本） ------------------------------------- */
export { TERMS, UI_COPY, term, fill, DEFAULT_LOCALE, type Locale, type TermKey } from "./copy";

/* --- primitives -------------------------------------------------------- */
export { Button, type ButtonProps, type ButtonTone } from "./primitives/button";
export { Field, type FieldProps } from "./primitives/field";
export { ToolForm } from "./primitives/tool-form";
export { Callout, type CalloutTone } from "./primitives/callout";
export { LoadingView, EmptyView, ErrorView } from "./primitives/state-view";

/* --- patterns（仕様固有。画面ごとに書き起こさない） --------------------- */
export { FactualityBadge, ClaimStatement, type Factuality } from "./patterns/factuality";
export { EvidenceList, ProvenanceNote, type EvidenceView } from "./patterns/evidence";
export { DisclosureNotice, AffiliateLink } from "./patterns/disclosure";
export {
  RankingTable,
  CriteriaDisclosure,
  type RankingRow,
  type CriterionView,
  type ExcludedProduct,
} from "./patterns/ranking-table";
export {
  ComparisonTable,
  type ComparisonColumn,
  type ComparisonRow,
  type ComparisonCell,
} from "./patterns/comparison-table";
export {
  ApprovalFlow,
  ApprovalBlockedNotice,
  AiCannotApproveNotice,
  APPROVAL_STEPS,
  type ApprovalState,
} from "./patterns/approval";
export { StubNotice, StubLabel } from "./patterns/stub-notice";

/* --- templates --------------------------------------------------------- */
export {
  AppShell,
  Page,
  Card,
  ADMIN_NAV,
  type NavItem,
  type Breadcrumb,
} from "./templates/app-shell";
