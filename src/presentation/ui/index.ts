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
export { FormValue, type FormValueProps } from "./primitives/form-value";
export { DescriptionTime, type DescriptionTimeProps } from "./primitives/description-time";
export { Select, type SelectProps, type SelectOption } from "./primitives/select";
export { CheckboxGroup, type CheckboxGroupProps } from "./primitives/checkbox-group";
export { Checkbox, type CheckboxProps } from "./primitives/checkbox";
export { TextArea, type TextAreaProps } from "./primitives/textarea";
export { ToolForm } from "./primitives/tool-form";
// ToolForm の対。AI から呼べない操作は素の <form> ではなくこちらを使う。
// 素の <form> だと「決めた」と「忘れた」が同じ見た目になる。
export { HumanOnlyForm } from "./primitives/human-only-form";
export { ActionButton } from "./primitives/action-button";
export { Callout, type CalloutTone } from "./primitives/callout";
export { ActionNote } from "./primitives/action-note";
export { LoadingView, EmptyView, ErrorView, IdealView, PartialView, SlowView } from "./primitives/state-view";
export { Icon, type IconName, type IconSize } from "./primitives/icon";
/* 節の見出し。`level` は必須で、文書階層 2〜4 をそのまま渡す。 */
export { SectionHeading, type SectionHeadingLevel } from "./primitives/heading";
export { proseParagraphs } from "./primitives/prose-paragraphs";
/*
  本文の断片を描く部品 (`ProseBody` / `ProseEditor` / `ProseSection`) はここから出さない。
  `@/domain/blogops` を読むので共通UIの決まりに当たらない。置き場は
  `@/presentation/prose`（同ディレクトリの README に理由）。
*/
/* 注記の段落。余白も `className` も持たない。寄せてはいけないものは `note.tsx` の doc。 */
export { Note } from "./patterns/note";
/* 「続きはあちら」の行き先 1 本。`Note` と見た目は同じで役が違う（`see-also.tsx` の doc）。 */
export { SeeAlso } from "./patterns/see-also";
/* 見ている対象の切り替え。文ではなく操作なので押しどころの下限を持つ（`scope-switch.tsx` の doc）。 */
export { ScopeSwitch } from "./patterns/scope-switch";

/* --- patterns（仕様固有。画面ごとに書き起こさない） --------------------- */
export {
  FactualityBadge,
  ClaimStatement,
  FactSourceBadge,
  FACT_SOURCES,
  type Factuality,
  type FactSource,
} from "./patterns/factuality";
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
export {
  Conversation,
  SPEAKERS,
  SPEAKER_LABEL,
  type ConversationLine,
  type Speaker,
} from "./patterns/conversation";
export { ProductCard, type ProductCardSpec } from "./patterns/product-card";
/*
  AffiliatePreviewCard はここから公開しない。管理面限定の部品で、
  `src/presentation/admin/earn/affiliate-preview-card.tsx` が所有する。
  読者面の部品と同じ棚から出すと、読者面のページが金額付きの確認カードを
  そのまま import できてしまう（理由は product-card.tsx の priceNote と同じ）。
*/
export { DiagramFallback } from "./patterns/diagram-fallback";
export { StubNotice, StubLabel, StorageNotice } from "./patterns/stub-notice";
export type { StorageStatus } from "./patterns/stub-notice";
export { AppearancePicker } from "./patterns/appearance-picker";
export {
  APPEARANCE_ATTR,
  APPEARANCE_COOKIE,
  appearanceAttributes,
  type AppearanceValues,
} from "./appearance";
export { WorkBoard, type WorkBoardItem } from "./patterns/work-board";
export { SummaryStrip, type SummaryMetric } from "./patterns/summary-strip";
export { BarChart, type BarChartPoint } from "./patterns/bar-chart";
export {
  DecisionStatus,
  type DecisionStatusKind,
} from "./patterns/decision-status";
export { FilterBar, type FilterAxis } from "./patterns/filter-bar";
export { FormResult, type FormOutcome } from "./patterns/form-result";
export { useDraft } from "./patterns/use-draft";
export { MaterialReview, type MaterialFinding } from "./patterns/material-review";
export {
  ModelPicker,
  type ModelPickerGroup,
  type ModelPickerModel,
} from "./patterns/model-picker";
export {
  ScheduleCalendar,
  type ScheduleCalendarDay,
  type ScheduleCalendarEntry,
} from "./patterns/schedule-calendar";
export {
  ChannelStatusList,
  ChannelBadge,
  type ChannelStatusEntry,
} from "./patterns/channel-status";
export { NavCollapseToggle, NAV_COLLAPSED_ATTR } from "./patterns/nav-collapse-toggle";
export {
  ConceptMatrixLauncher,
  toConceptAxes,
  type ConceptAxes,
  type ConceptMatrixSite,
  type ConceptMatrixProduct,
  type ConceptOverride,
  type ConceptMatrixLauncherProps,
} from "./patterns/concept-matrix";
export { ConsentBanner } from "./patterns/consent-banner";
export { FeedbackButton, type FeedbackSubmission } from "./patterns/feedback-button";
export {
  CaptureCanvas,
  CANVAS_TOOLS,
  CANVAS_COLORS,
  type BurnedCapture,
  type CanvasTool,
  type CanvasColor,
} from "./patterns/capture-canvas";
export {
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE,
  type ConsentAnswer,
} from "./consent";
export {
  TELEMETRY_ATTR,
  TELEMETRY_ELEMENT_KINDS,
  TELEMETRY_SECTION_KINDS,
  telemetryAttrs,
  telemetrySectionAttrs,
  type TelemetryAttributes,
  type TelemetryElementKind,
  type TelemetryMark,
  type TelemetrySectionKind,
  type TelemetrySectionMark,
} from "./telemetry-attrs";
export { WebMcpProvider } from "./webmcp-provider";
export {
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_ROUTE_METADATA,
  resolveAdminRoute,
  type AdminBreadcrumb,
  type AdminNavGroupId,
  type AdminRouteId,
  type AdminRouteMetadata,
  type ResolvedAdminRoute,
} from "./admin-route-metadata";
export {
  ADMIN_SCREEN_STATE_CONTRACTS,
  ADMIN_SCREEN_STATES,
  adminScreenStateContract,
  type AdminScreenStateContract,
  type OperationalScreenState,
  type ScreenStateInstruction,
} from "./admin-screen-state-contract";
export { ADMIN_CARD_ROUTE_IDS, type AdminCardRouteId } from "./admin-card-contract";
export {
  ADMIN_DISCLOSURE_CONTRACTS,
  adminDisclosureContract,
  type AdminDisclosureContract,
} from "./admin-disclosure-contract";

/* --- templates --------------------------------------------------------- */
export {
  AppShell,
  Page,
  Card,
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  UNGROUPED_NAV_HREFS,
  visibleNav,
  groupedNav,
  currentNavHref,
  type NavItem,
  type NavGroup,
  type GroupedNav,
  type Breadcrumb,
} from "./templates/app-shell";
export {
  Section,
  SubSection,
  Prose,
  ListView,
  StepList,
  DataTable,
  FactList,
  RowSummary,
  Foldable,
  Figure,
  RowSelector,
  TextLink,
  ExternalLink,
  Code,
  CodeBlock,
  Stack,
  Row,
  type ListRow,
  type TableColumn,
  type TableRow,
  type FactRow,
} from "./templates/screen-parts";
export {
  SiteShell,
  SitePage,
  SiteSection,
  SiteHomeHero,
  CategoryDirectory,
  CategoryArticleGroups,
  PublicShell,
  FocusedTask,
  type SiteChrome,
  type SiteNavItem,
  type CategoryDirectoryItem,
  type CategoryArticleGroupView,
} from "./templates/site-shell";
export {
  ArticleView,
  ArticleTableOfContents,
  ArticleList,
  ARTICLE_SPEAKABLE_SELECTORS,
  PersonView,
  PolicyView,
  CorrectionList,
  type ArticleViewModel,
  type ArticleCardView,
  type ClaimView,
  type SectionView,
  type ConversationLineView,
  type CorrectionView,
} from "./templates/article-view";
