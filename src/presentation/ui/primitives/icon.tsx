import {
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
  Home,
  Inbox,
  Landmark,
  Lightbulb,
  ListOrdered,
  MessageCircle,
  MessageSquareMore,
  Package,
  PenLine,
  RadioTower,
  SearchCheck,
  Send,
  Settings,
  TrendingUp,
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
  export: FileOutput,
  complete: Check,
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
