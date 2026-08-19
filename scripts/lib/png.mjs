/**
 * PNG を読み解いて、2 枚の絵を画素で比べる。
 *
 * ## なぜ自前で書くか
 *
 * 画像比較の道具（pixelmatch / pngjs / Playwright の toHaveScreenshot）は
 * どれも新しい依存を連れてくる。**この検査は「依存が増えたから入らなかった」で
 * 止まるのがいちばん困る種類のもの**なので、Node の `zlib` だけで済ませる。
 * 読むのは Chrome が吐いた PNG に限られるため、仕様の全部は要らない。
 *
 * 対応しているのは **ビット深度 8・非インターレース・色種別 2(RGB) と 6(RGBA)** だけ。
 * 他が来たら**黙って通さず投げる**。読めないものを「差分 0 件」として通すと、
 * 比べていないことが緑として現れる。この検査でいちばん避けたい壊れ方はそれである。
 *
 * ## 「差分 0 件」の意味を守る仕掛け
 *
 * ここが正しく動いていることは、`tests/visual/visual-regression.test.ts` の
 * **陽性対照**（1px ずらした絵が赤くなること）で毎回確かめる。
 * 陽性対照が無いと、差分 0 件が「差が無い」なのか「比べる側が死んでいる」なのか
 * 区別できず、この道具は**常に緑を出す飾り**になる。
 */

import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * @typedef {object} Raster
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} rgba 画素を RGBA の順に並べたもの（長さ = width * height * 4）
 */

/**
 * PNG を RGBA の並びに開く。
 *
 * @param {Buffer | Uint8Array} bytes
 * @returns {Raster}
 */
export function decodePng(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("PNG ではありません（先頭の印が違います）");
  }

  let offset = 8;
  /** @type {{ width: number, height: number, bitDepth: number, colorType: number, interlace: number } | null} */
  let header = null;
  /** @type {Buffer[]} */
  const data = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length; // 長さ(4) + 種別(4) + 中身 + CRC(4)

    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === "IDAT") {
      data.push(body);
    } else if (type === "IEND") {
      break;
    }
  }

  if (header === null) throw new Error("PNG に IHDR がありません");
  if (header.bitDepth !== 8) {
    throw new Error(`ビット深度 ${header.bitDepth} は読めません（8 だけ対応）`);
  }
  if (header.interlace !== 0) {
    throw new Error("インターレース PNG は読めません");
  }
  if (header.colorType !== 2 && header.colorType !== 6) {
    throw new Error(`色種別 ${header.colorType} は読めません（2 か 6 だけ対応）`);
  }

  const channels = header.colorType === 6 ? 4 : 3;
  const { width, height } = header;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(data));
  const expected = (stride + 1) * height;
  if (raw.length < expected) {
    throw new Error(`中身が足りません（${raw.length} / ${expected} バイト）`);
  }

  // 行ごとの「絞り」を戻す。前の行と左の画素を使うので、上から順にしか解けない。
  const flat = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const line = flat.subarray(y * stride, y * stride + stride);
    const up = y === 0 ? null : flat.subarray((y - 1) * stride, y * stride);
    unfilter(filter, src, line, up, channels);
  }

  // 透明度の無い絵も、比べる側から見て同じ形にそろえる。
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i += 1, j += channels) {
    rgba[i * 4] = flat[j];
    rgba[i * 4 + 1] = flat[j + 1];
    rgba[i * 4 + 2] = flat[j + 2];
    rgba[i * 4 + 3] = channels === 4 ? flat[j + 3] : 255;
  }

  return { width, height, rgba };
}

/**
 * 1 行分の「絞り」を戻す。PNG 仕様 9.2 のそのまま。
 *
 * @param {number} filter
 * @param {Uint8Array} src
 * @param {Uint8Array} out
 * @param {Uint8Array | null} up
 * @param {number} bpp 1 画素のバイト数
 */
function unfilter(filter, src, out, up, bpp) {
  const n = src.length;
  const left = (i) => (i >= bpp ? out[i - bpp] : 0);
  const above = (i) => (up === null ? 0 : up[i]);
  const upperLeft = (i) => (up === null || i < bpp ? 0 : up[i - bpp]);

  switch (filter) {
    case 0:
      out.set(src);
      return;
    case 1:
      for (let i = 0; i < n; i += 1) out[i] = (src[i] + left(i)) & 0xff;
      return;
    case 2:
      for (let i = 0; i < n; i += 1) out[i] = (src[i] + above(i)) & 0xff;
      return;
    case 3:
      for (let i = 0; i < n; i += 1) {
        out[i] = (src[i] + ((left(i) + above(i)) >> 1)) & 0xff;
      }
      return;
    case 4:
      for (let i = 0; i < n; i += 1) out[i] = (src[i] + paeth(left(i), above(i), upperLeft(i))) & 0xff;
      return;
    default:
      throw new Error(`知らない絞りです: ${filter}`);
  }
}

/**
 * @param {number} a 左
 * @param {number} b 上
 * @param {number} c 左上
 * @returns {number}
 */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * 1 画素とみなす差の大きさ。
 *
 * 0 にすると、同じ機械・同じ Chrome でも字の縁の丸めが 1 ずれただけで赤くなり、
 * **赤が日常になって誰も見なくなる**。逆に大きくすると、色の取り違えのような
 * 実際の崩れを飲み込む。8/255（約 3%）は「見て分かる差」のかなり下側で、
 * 丸め由来のゆらぎより上にある。
 *
 * **上げて緑にすることを禁じる。** 上げるときは日付と理由を
 * `tests/visual/baseline-updates.jsonl` と同じ粒度で残すこと。
 */
export const CHANNEL_TOLERANCE = 8;

/**
 * @typedef {object} CompareResult
 * @property {boolean} same 大きさも中身も同じか
 * @property {string} [sizeMismatch] 大きさが違うときだけ、その説明
 * @property {number} changedPixels 違った画素の数
 * @property {number} totalPixels 比べた画素の数
 * @property {number} ratio 違った割合（0〜1）
 * @property {Buffer} [diffPng] 違った場所を赤く塗った絵（大きさが同じときだけ）
 */

/**
 * 2 枚を画素で比べる。
 *
 * 大きさが違ったら**その時点で違い**とする。引き伸ばして比べると、
 * 「高さが 20px 伸びた」という最もよくある崩れ方が差分 0 件になる。
 *
 * @param {Raster} baseline 見本
 * @param {Raster} current いま撮ったもの
 * @param {number} [tolerance]
 * @returns {CompareResult}
 */
export function comparePng(baseline, current, tolerance = CHANNEL_TOLERANCE) {
  if (baseline.width !== current.width || baseline.height !== current.height) {
    const total = baseline.width * baseline.height;
    return {
      same: false,
      sizeMismatch: `大きさが違います（見本 ${baseline.width}x${baseline.height} / いま ${current.width}x${current.height}）`,
      changedPixels: total,
      totalPixels: total,
      ratio: 1,
    };
  }

  const { width, height } = baseline;
  const total = width * height;
  const diff = new Uint8Array(total * 4);
  let changed = 0;

  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    const dr = Math.abs(baseline.rgba[o] - current.rgba[o]);
    const dg = Math.abs(baseline.rgba[o + 1] - current.rgba[o + 1]);
    const db = Math.abs(baseline.rgba[o + 2] - current.rgba[o + 2]);
    const da = Math.abs(baseline.rgba[o + 3] - current.rgba[o + 3]);
    if (dr > tolerance || dg > tolerance || db > tolerance || da > tolerance) {
      changed += 1;
      diff[o] = 0xff;
      diff[o + 1] = 0x00;
      diff[o + 2] = 0x66;
      diff[o + 3] = 0xff;
    } else {
      // 同じところは薄い灰色に落とす。赤がどこに載っているか分かるようにするため。
      const grey = Math.round(
        (baseline.rgba[o] * 0.3 + baseline.rgba[o + 1] * 0.59 + baseline.rgba[o + 2] * 0.11) * 0.25 + 191,
      );
      diff[o] = grey;
      diff[o + 1] = grey;
      diff[o + 2] = grey;
      diff[o + 3] = 0xff;
    }
  }

  return {
    same: changed === 0,
    changedPixels: changed,
    totalPixels: total,
    ratio: total === 0 ? 0 : changed / total,
    diffPng: encodePng({ width, height, rgba: diff }),
  };
}

/**
 * RGBA の並びを PNG に戻す。差分の絵を人が見られる形で残すためだけに使う。
 *
 * 絞りは掛けない（0 = None）。大きさより読みやすさを取る。
 *
 * @param {Raster} raster
 * @returns {Buffer}
 */
export function encodePng({ width, height, rgba }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * @param {string} type
 * @param {Buffer} body
 * @returns {Buffer}
 */
function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/**
 * @param {Buffer} bytes
 * @returns {number}
 */
function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
