import {
  THUMBNAIL_ASPECT,
  type ThumbnailSeed,
  thumbnailHeightFor,
} from "@/domain/blogops/thumbnail";

/**
 * 画像を持たない記事の 16:9 代替図版（SVG）を組み立てる。
 *
 * ==========================================================================
 * なぜ外へ 1 回も接続しないのか
 * ==========================================================================
 *
 * 代替図版は「画像が無い記事」に必ず付く。つまり **一覧 1 画面で 20 枚以上**
 * 要ることがある。外部の画像生成に頼ると、その 20 回が全部ネットワーク待ちになり、
 * 相手が落ちた日にサムネイルだけ全滅する。生成に使う材料は
 * タイトル・カテゴリー名・配色名と seed だけで、fetch も環境変数も読まない。
 *
 * ==========================================================================
 * なぜ色値をここに書いているのか（トークンに寄せないのか）
 * ==========================================================================
 *
 * 画面の中の色は `data-brand-theme` の CSS トークンが解く。しかしこの SVG は
 * **単体の画像として配られる**（OGP 画像・`<img src>`）ので、ページの CSS 変数が
 * 届かない。届かない場所で `var(--color-accent-default)` と書くと、
 * どのブラウザでも黒 1 色の画像になる。だから実際の色値をここが持つ。
 *
 * 値は `src/presentation/ui/tokens/primitives.css` の同名 primitive と同じもので、
 * ずれると「画面の色と共有画像の色が違う」状態になる。ずれを人が見張らずに済むよう、
 * `tests/thumbnail/fallback-cover-palette.test.ts` が CSS 側と突き合わせる。
 *
 * 参考にした外部サイトの色値・写真・ロゴ・書体資産は 1 つも使っていない。
 */

/** 1 テーマぶんの色。背景・図形・文字の 3 役だけを持つ。 */
type CoverPalette = {
  /** 図版の地の色。 */
  readonly surface: string;
  /** 主となる図形の色。 */
  readonly primary: string;
  /** 添える図形の色。 */
  readonly secondary: string;
  /** 地の上に置く文字の色。 */
  readonly onSurface: string;
};

/**
 * 配色名 → 色。
 *
 * `Record` ではなく引き当て関数を通すのは、保存済みのブログが
 * 知らない配色名を持っていても図版が出せるようにするため。
 * 知らない名前を弾いて画像を落とすより、既定の色で出す方が害が小さい。
 */
const COVER_PALETTES: Readonly<Record<string, CoverPalette>> = {
  "graphite-amber": {
    surface: "#16171a",
    primary: "#f59e0b",
    secondary: "#3d3f47",
    onSurface: "#e0e1e5",
  },
  "indigo-teal": {
    surface: "#12102e",
    primary: "#a5b4fc",
    secondary: "#0f766e",
    onSurface: "#e0e7ff",
  },
  "teal-clay": { surface: "#04211f", primary: "#5eead4", secondary: "#b23c33", onSurface: "#ccfbf1" },
  "indigo-clay": {
    surface: "#12102e",
    primary: "#a5b4fc",
    secondary: "#b23c33",
    onSurface: "#e0e7ff",
  },
  blue: { surface: "#12224a", primary: "#93c5fd", secondary: "#0f766e", onSurface: "#dbeafe" },
  pink: { surface: "#350b22", primary: "#f9a8d4", secondary: "#b45309", onSurface: "#fce7f3" },
  white: { surface: "#e0e1e5", primary: "#3d3f47", secondary: "#a3a5ae", onSurface: "#1e1f23" },
  gray: { surface: "#1e1f23", primary: "#a3a5ae", secondary: "#3d3f47", onSurface: "#e0e1e5" },
  green: { surface: "#0d2c19", primary: "#86efac", secondary: "#15803d", onSurface: "#dcfce7" },
  purple: { surface: "#26043f", primary: "#d8b4fe", secondary: "#7e22ce", onSurface: "#f3e8ff" },
};

const DEFAULT_PALETTE_NAME = "graphite-amber";

export function coverPaletteFor(brandTheme: string): CoverPalette {
  return COVER_PALETTES[brandTheme] ?? COVER_PALETTES[DEFAULT_PALETTE_NAME];
}

/** 図版の既定の大きさ。OGP が求める 1200px 以上を満たす 16:9。 */
export const COVER_WIDTH = 1280;
export const COVER_HEIGHT = thumbnailHeightFor(COVER_WIDTH);

/**
 * XML として安全な文字にする。
 *
 * 記事タイトルは利用者が自由に書ける。`&` や `<` をそのまま入れると
 * SVG が壊れて **画像が 1 枚も出なくなる**。壊れ方が「全滅」なので、
 * 生成の直前に必ずここを通す。
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 図版に載せる行に切る。
 *
 * 日本語は単語の切れ目が無いので、幅ではなく **文字数** で折る。
 * 折った結果が `maxLines` を超えたら最後の行の末尾を「…」にする。
 * 全部載せようとして字を小さくすると、一覧の小さいカードで読めなくなる。
 */
export function wrapCoverTitle(
  title: string,
  charsPerLine: number,
  maxLines: number,
): readonly string[] {
  const chars = [...title.trim()];
  if (chars.length === 0) return [];
  const lines: string[] = [];
  for (let i = 0; i < chars.length && lines.length < maxLines; i += charsPerLine) {
    lines.push(chars.slice(i, i + charsPerLine).join(""));
  }
  const consumed = Math.min(chars.length, charsPerLine * maxLines);
  if (consumed < chars.length) {
    const last = [...lines[lines.length - 1]];
    last.splice(-1, 1, "…");
    lines[lines.length - 1] = last.join("");
  }
  return lines;
}

/**
 * seed から図形の配置を決める。
 *
 * 4 通りの並べ方から 1 つ選ぶだけにしてある。種類を増やすほど
 * 「同じブログの中で見た目がばらける」ので、**揃って見える範囲**に留める。
 */
function shapesFor(seed: ThumbnailSeed, palette: CoverPalette): string {
  const variant = seed.hash % 4;
  const w = COVER_WIDTH;
  const h = COVER_HEIGHT;
  // 位置のゆらぎ。0.0〜1.0 を seed の別の桁から取り、同じ variant でも同じ絵が並ばないようにする。
  const drift = ((seed.hash >>> 8) % 100) / 100;

  if (variant === 0) {
    const cx = w * (0.72 + drift * 0.12);
    return [
      `<circle cx="${cx.toFixed(1)}" cy="${(h * 0.32).toFixed(1)}" r="${(h * 0.42).toFixed(1)}" fill="${palette.primary}" opacity="0.22"/>`,
      `<circle cx="${(cx - h * 0.3).toFixed(1)}" cy="${(h * 0.78).toFixed(1)}" r="${(h * 0.28).toFixed(1)}" fill="${palette.secondary}" opacity="0.35"/>`,
    ].join("");
  }
  if (variant === 1) {
    const x = w * (0.6 + drift * 0.1);
    return [
      `<rect x="${x.toFixed(1)}" y="0" width="${(w - x).toFixed(1)}" height="${h}" fill="${palette.primary}" opacity="0.18"/>`,
      `<rect x="${(x + 40).toFixed(1)}" y="${(h * 0.2).toFixed(1)}" width="${(w - x - 120).toFixed(1)}" height="${(h * 0.6).toFixed(1)}" fill="${palette.secondary}" opacity="0.4"/>`,
    ].join("");
  }
  if (variant === 2) {
    const y = h * (0.55 + drift * 0.15);
    return [
      `<polygon points="${w},0 ${w},${h} ${(w * 0.55).toFixed(1)},${h}" fill="${palette.primary}" opacity="0.2"/>`,
      `<rect x="0" y="${y.toFixed(1)}" width="${w}" height="${(h - y).toFixed(1)}" fill="${palette.secondary}" opacity="0.28"/>`,
    ].join("");
  }
  const step = h * 0.16;
  const bars = [0, 1, 2, 3]
    .map((i) => {
      const bh = step * (0.5 + ((seed.hash >>> (i * 3)) % 5) / 4);
      const bx = w * 0.62 + i * (w * 0.08);
      return `<rect x="${bx.toFixed(1)}" y="${(h * 0.72 - bh).toFixed(1)}" width="${(w * 0.05).toFixed(1)}" height="${bh.toFixed(1)}" fill="${i % 2 === 0 ? palette.primary : palette.secondary}" opacity="0.42"/>`;
    })
    .join("");
  return bars;
}

/**
 * 代替図版の SVG を作る。**同じ seed なら必ず同じ文字列を返す。**
 *
 * 返すのは完結した SVG 文書で、`image/svg+xml` としてそのまま配れる。
 * `<script>` も外部参照も含まない（含めると画像として配ったときに
 * 実行可能な文書を配ることになる）。書体は端末にあるものだけを使う。
 */
export function renderFallbackCoverSvg(seed: ThumbnailSeed): string {
  const palette = coverPaletteFor(seed.brandTheme);
  const lines = wrapCoverTitle(seed.title, 16, 3);
  const fontSize = lines.length >= 3 ? 62 : 74;
  const startY = COVER_HEIGHT / 2 - ((lines.length - 1) * fontSize * 1.3) / 2 + fontSize * 0.34;
  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="72" y="${(startY + i * fontSize * 1.3).toFixed(1)}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const category =
    seed.categoryName.length === 0
      ? ""
      : `<text x="72" y="88" font-size="34" font-weight="700" fill="${palette.primary}" font-family="system-ui, sans-serif">${escapeXml(seed.categoryName)}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}"`,
    ` viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}" role="img" aria-label="${escapeXml(seed.title)}">`,
    `<rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="${palette.surface}"/>`,
    shapesFor(seed, palette),
    category,
    `<text font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="700" fill="${palette.onSurface}">${titleTspans}</text>`,
    `<rect x="72" y="${COVER_HEIGHT - 76}" width="120" height="8" rx="4" fill="${palette.primary}"/>`,
    `</svg>`,
  ].join("");
}

/**
 * `<img src>` にそのまま置ける data URI。
 *
 * R2 へ置く前でも、置けなかったときでも同じ絵が出せるようにしておく。
 * `encodeURIComponent` を使うのは base64 より短く、日本語をそのまま運べるため。
 */
export function fallbackCoverDataUri(seed: ThumbnailSeed): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderFallbackCoverSvg(seed))}`;
}

/** 縦横比が崩れていないことを呼び出し側が確かめられるようにしておく。 */
export const COVER_ASPECT = THUMBNAIL_ASPECT;
