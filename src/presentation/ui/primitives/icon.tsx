import type { ReactNode } from "react";

/**
 * 記号（アイコン）。
 *
 * **アイコンフォントを読み込まない。** 外部フォントにすると、
 * 読み込みが終わるまでサイドバーの行の高さが決まらず、
 * 目次や案内が一瞬ずれてから収まる（読者には故障に見える）。
 * ここでは形を直接書き、往復を 0 にする。
 *
 * --- 色を持たせない理由 ---
 * 参考にした作りでは項目ごとに違う色を付けていた。ここではやらない。
 * このブログの配色は `tokens/semantic.css` が「信号の色を増やさない」方針で
 * 組んであり、さらに読者が高コントラスト表示を選んだときには
 * トークンをまとめて置き換えて可読性を守っている。
 * アイコンだけ直接の色を書くと、その置き換えを素通りする。
 *
 * **区別は形で付ける。** 形なら色覚の違いに関わらず同じだけ伝わる。
 *
 * --- 読み上げについて ---
 * すべて `aria-hidden`。アイコンは必ず文字の隣に置く前提で、
 * 読み上げに同じ意味を 2 回言わせない。
 * 文字を伴わない場所では使わない（押せるものは文字で名乗る）。
 */

import { type IconName } from "./icon-name";

export { ICON_NAMES, pickCategoryIcon, type IconName } from "./icon-name";

/**
 * 形の定義。すべて 24×24 の枠に、太さ 1.75 の線だけで描く。
 *
 * 塗りを混ぜない。塗りと線が混ざると、暗い画面に切り替えたときに
 * 片方だけが背景と同化する。
 */
const SHAPES: Readonly<Record<IconName, ReactNode>> = {
  smartphone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="2.5" y="14" width="4.5" height="7" rx="1.5" />
      <rect x="17" y="14" width="4.5" height="7" rx="1.5" />
    </>
  ),
  plug: (
    <>
      <path d="M9 2v6M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v5" />
    </>
  ),
  battery: <path d="M13 2 4 14h6.5L10 22l9-12h-6.5z" />,
  laptop: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
    </>
  ),
  speaker: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="15" r="3.5" />
      <circle cx="12" cy="6.5" r="1.2" />
    </>
  ),
  appliance: (
    <>
      <path d="M12 3v9" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </>
  ),
  projector: (
    <>
      <rect x="2" y="5" width="13" height="14" rx="2" />
      <path d="M15 10.5 22 6v12l-7-4.5z" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 8.5a15 15 0 0 1 19 0" />
      <path d="M5.5 12.5a10 10 0 0 1 13 0" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="20" r="1" />
    </>
  ),
  shield: <path d="M12 2.5 4 5.5V11c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5.5z" />,
  gamepad: (
    <>
      <rect x="2" y="7" width="20" height="11" rx="4" />
      <path d="M7 10.5v4M5 12.5h4" />
      <circle cx="15.5" cy="11.5" r="1" />
      <circle cx="18" cy="14" r="1" />
    </>
  ),
  shoe: (
    <>
      <path d="M3 10.5v6.5h15.5a2.5 2.5 0 0 0 0-5c-2 0-3.6-.7-4.9-2L11.5 8.5 9 11z" />
      <path d="M3 17h18" />
    </>
  ),
  /*
    椅子・机・照明は、参考にした作り（ガジェットのブログ）には無かった。
    このプラットフォームで最初に動いているブログが在宅の机まわりを扱っており、
    その 3 つのカテゴリーだけ記号が無いまま既定に落ちていたので足す。
  */
  chair: (
    <>
      <rect x="8" y="2.5" width="8" height="8.5" rx="2" />
      <rect x="4.5" y="11" width="15" height="3.5" rx="1.5" />
      <path d="M7 14.5v6M17 14.5v6" />
    </>
  ),
  desk: (
    <>
      <path d="M2.5 8.5h19" />
      <path d="M4.5 8.5v11.5M19.5 8.5v11.5" />
      <rect x="7" y="11" width="7" height="4" rx="1" />
    </>
  ),
  lamp: (
    <>
      <path d="M12 2.5a6 6 0 0 1 3.5 10.9V15h-7v-1.6A6 6 0 0 1 12 2.5z" />
      <path d="M9.5 18h5M10.5 21h3" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8h13l1 13h-15z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  home: (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M6 10v10h12V10" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  camera: (
    <>
      <path d="M3 7h3.5l1.5-2.5h8L17.5 7H21v13H3z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  watch: (
    <>
      <circle cx="12" cy="12" r="5.5" />
      <path d="M9 6.8 9.5 2h5l.5 4.8M9 17.2l.5 4.8h5l.5-4.8" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </>
  ),
  car: (
    <>
      <path d="M3 14l2-6h14l2 6v4H3z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  tag: (
    <>
      <path d="M3 3h8.5L21 12.5 12.5 21 3 11.5z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h7" />
      <circle cx="5" cy="6" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="5" cy="18" r="1" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
};

export function Icon({ name, className }: { readonly name: IconName; readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      /* 隣に必ず文字がある。読み上げに同じことを 2 回言わせない。 */
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
