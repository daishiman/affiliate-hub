/**
 * 共通UI部品の入口。
 *
 * 画面からは必ずここ経由で読む (`@/presentation/ui`)。
 * 個別ファイルを直接指すと、部品を差し替えたとき参照元を全部直すことになる。
 */
export { Button, type ButtonProps, type ButtonTone } from "./button";
export { Field, type FieldProps } from "./field";
export { Callout, type CalloutTone } from "./callout";
export { LoadingView, EmptyView, ErrorView } from "./state-view";
export { AppShell, Page, Card, ADMIN_NAV, type NavItem, type Breadcrumb } from "./app-shell";
