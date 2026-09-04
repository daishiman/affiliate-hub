import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BadgeDollarSign,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleDollarSign,
  Component,
  ExternalLink,
  FileOutput,
  FileText,
  FlaskConical,
  Globe2,
  HandCoins,
  Heading3,
  Home,
  Image,
  Inbox,
  Info,
  Landmark,
  LayoutPanelTop,
  Lightbulb,
  List,
  ListOrdered,
  MessageCircle,
  MessageSquareMore,
  Minus,
  Network,
  Package,
  PenLine,
  Pilcrow,
  Plus,
  Quote,
  RadioTower,
  SearchCheck,
  Send,
  Settings,
  Table,
  Trash2,
  TrendingUp,
  TriangleAlert,
  UserRound,
  UsersRound,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * 画面で使えるアイコンの正本。
 *
 * Lucide の部品名を画面へ直接広げず、アプリ内の意味で名前を付ける。
 * これにより、線幅や絵柄を変えるときもここだけを差し替えればよい。
 */
const ICONS = {
  home: Home,
  product: Package,
  evidence: SearchCheck,
  ranking: ListOrdered,
  article: FileText,
  audience: UsersRound,
  writing: PenLine,
  generation: Workflow,
  site: Globe2,
  distribution: RadioTower,
  affiliate: HandCoins,
  inbox: Inbox,
  analytics: ChartNoAxesColumnIncreasing,
  aiUsage: CircleDollarSign,
  improvement: TrendingUp,
  feedback: MessageSquareMore,
  tool: Wrench,
  component: Component,
  settings: Settings,
  fact: BadgeCheck,
  inference: Lightbulb,
  opinion: MessageCircle,
  official: Landmark,
  measured: FlaskConical,
  experience: UserRound,
  external: ExternalLink,
  commercial: BadgeDollarSign,
  publish: Send,
  schedule: CalendarClock,
  siteNetwork: Network,
  blogLayout: LayoutPanelTop,
  export: FileOutput,
  complete: Check,
  /* 本文の断片 (`/` メニューと公開面) — 絵文字は使わない。線幅と色を 1 か所で揃えるため。 */
  proseHeading: Heading3,
  proseBulletList: List,
  proseOrderedList: ListOrdered,
  proseQuote: Quote,
  proseCallout: Info,
  proseProductCard: Package,
  proseTable: Table,
  proseImage: Image,
  proseDivider: Minus,
  calloutInfo: Info,
  calloutTip: Lightbulb,
  calloutWarn: TriangleAlert,
  calloutNote: Quote,
  /* 編集の操作 — ここも絵文字を使わない。読み上げ名は呼び出し側の aria-label が持つ。 */
  proseParagraph: Pilcrow,
  moveUp: ArrowUp,
  moveDown: ArrowDown,
  removeItem: Trash2,
  addItem: Plus,
} as const satisfies Readonly<Record<string, LucideIcon>>;

export type IconName = keyof typeof ICONS;
export type IconSize = "sm" | "md";

const ICON_SIZE: Readonly<Record<IconSize, number>> = {
  sm: 16,
  md: 20,
};

/**
 * 単色・同一線幅の装飾アイコン。
 *
 * 意味は必ず隣の文字が持つ。アイコン単独の操作には使わせず、
 * 二重読み上げを避けるため支援技術から常に隠す。
 */
export function Icon({ name, size = "sm", className }: {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly className?: string;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      aria-hidden="true"
      className={className}
      focusable="false"
      size={ICON_SIZE[size]}
      strokeWidth={1.75}
    />
  );
}
