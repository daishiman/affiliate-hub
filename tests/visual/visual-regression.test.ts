/** @tier 3 @req REQ-TS12 @types visual */

/**
 * 見た目の回帰の仕掛けそのものを見る。
 *
 * ## ここが見ているもの / 見ていないもの
 *
 * **見ている**: 比べる側が動いていること（陽性対照）、見本の上書きに
 * 理由と枚数の上限が掛かっていること、上限が下げる方向にしか動かないこと。
 * **見ていない**: 実際の画面の見た目。それは `pnpm run visual` が
 * Chrome を立ち上げて撮る（`scripts/visual-regression.tsx`、3 段の門）。
 *
 * 分けてあるのは、**ブラウザが無い機械でも上書きの門だけは効かせる**ため。
 * 撮れないことと、見本が理由なく書き換わっていることは、別々に赤くなるべきである。
 *
 * ## なぜ 3 段か
 *
 * 撮るほうは Chrome を立ち上げて 5 場面を撮るので毎 PR には置けない。
 * こちらは速いが、**同じ穴を見る検査を 2 つの段に分けると、
 * 片方だけ走った日の結果が「見た」と読まれる**ので、揃えて 3 段に置いた。
 *
 * ## ah-h57 の反転
 *
 * このファイルと `scripts/visual-regression.tsx` は、**`ah-h57`
 * 「見た目の崩れを自動で見つける手段が無いことを検査として固定する」の向きを
 * 反転したもの**である。あの検査は「手段が無い」を固定していたので、
 * 手段が足された日に赤くなるはずだった。いま手段は在るので、
 * 固定する対象は**「手段が在る」**に変わる——つまり、この仕掛けを外したり、
 * 見本を理由なく撮り直したりしたら赤くなる。
 *
 * ah-h57 の本文の書き換えは Beads 側で行う必要があるが、この作業枝の
 * Beads DB は空で `bd show ah-h57` が引けなかった。取り込む側で、
 * `bd-bridge.py --op update --bd-issue-id ah-h57` により本文を
 * 「画像比較の仕組みが外れた日・見本が理由なく書き換わった日に赤くなる」向きへ
 * 差し替えること。**まだ塞がっていない部分**（下の 2 つ）も併せて残すこと。
 *
 * 1. 見本は撮った機械に紐づく（`darwin-arm64-chrome151`）。字が機械の既定に
 *    落ちるため、別の機械の見本は別扱いになる。**CI に Chrome を積むまで、
 *    この検査は人の手元でしか走らない。**
 * 2. `visual` という種別を要件表に「必要な種別」として登録していない。
 *    登録には既存の定数を動かす必要があり、この作業の範囲外にした。
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { comparePng, decodePng, encodePng, CHANNEL_TOLERANCE } from "../../scripts/lib/png.mjs";
import {
  BASELINE_DIR,
  LIMIT_HISTORY,
  MIN_REASON_LENGTH,
  UPDATES_LEDGER,
  auditBaselineLedger,
  listBaselines,
  readAcceptLimit,
  sha256,
} from "../../scripts/lib/visual-baseline.mjs";
import { VISUAL_BASELINE_ACCEPT_MAX } from "../../quality-gates.config.mjs";

const ROOT = process.cwd();

/** 縞模様の絵を作る。1px ずらすと必ず色が変わるので、ずれが隠れない。 */
function stripes(width: number, height: number, offset = 0) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = (x + offset) % 2 === 0;
      const o = (y * width + x) * 4;
      rgba[o] = on ? 0 : 255;
      rgba[o + 1] = on ? 0 : 255;
      rgba[o + 2] = on ? 0 : 255;
      rgba[o + 3] = 255;
    }
  }
  return { width, height, rgba };
}

describe("比べる側が動いていること（陽性対照）", () => {
  /*
    **この節が無いと、この仕掛け全体が飾りになる。**
    「差分 0 件」は 2 通りの理由で出る——差が無いときと、比べる側が
    死んでいるとき。後者を区別できないと、見ていないことが緑として残る。
  */
  it("1px ずらした絵は赤くなる", () => {
    const result = comparePng(stripes(40, 20), stripes(40, 20, 1));
    expect(result.same, "1px ずらしても同じだと判定されました").toBe(false);
    expect(result.changedPixels).toBe(40 * 20);
  });

  it("同じ絵は緑になる（陰性対照。何でも赤くする仕掛けではない）", () => {
    const result = comparePng(stripes(40, 20), stripes(40, 20));
    expect(result.same).toBe(true);
    expect(result.changedPixels).toBe(0);
  });

  it("大きさが違えば、中身を見るまでもなく赤くなる", () => {
    // 引き伸ばして比べると「高さが 20px 伸びた」がいちばん隠れる。
    const result = comparePng(stripes(40, 20), stripes(40, 21));
    expect(result.same).toBe(false);
    expect(result.sizeMismatch).toContain("大きさが違います");
  });

  it("許す幅より大きい色の違いは見逃さない", () => {
    const base = stripes(10, 10);
    const shifted = { ...base, rgba: base.rgba.map((v, i) => (i % 4 === 3 ? v : Math.min(255, v + CHANNEL_TOLERANCE + 1))) };
    expect(comparePng(base, shifted).same).toBe(false);
  });

  it("許す幅の中の揺れでは赤くしない（毎回赤い検査は無視されるため）", () => {
    const base = stripes(10, 10);
    const jitter = { ...base, rgba: base.rgba.map((v, i) => (i % 4 === 3 ? v : Math.min(255, v + CHANNEL_TOLERANCE))) };
    expect(comparePng(base, jitter).same).toBe(true);
  });

  it("PNG を書き出して読み直しても中身が変わらない", () => {
    const base = stripes(37, 19);
    const round = decodePng(encodePng(base));
    expect(round.width).toBe(37);
    expect(Buffer.from(round.rgba).equals(Buffer.from(base.rgba))).toBe(true);
  });

  it("読めない形の PNG は、黙って差分 0 件にせず投げる", () => {
    // 読めないものを「差がない」として通すのが、この道具でいちばん困る壊れ方。
    expect(() => decodePng(Buffer.from("これは PNG ではありません"))).toThrow();
  });
});

describe("見本の上書きに掛けた門", () => {
  it("いま置いてある見本は、すべて理由つきで台帳に載っている（理由なしの上書き 0 件）", () => {
    const problems = auditBaselineLedger(ROOT, VISUAL_BASELINE_ACCEPT_MAX);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("見本が 1 枚以上ある（0 件を「違反なし」と読ませない）", () => {
    /*
      ② の形の検査には母集団の床を同居させる。
      見本を全部消せば「理由なしの上書き 0 件」は必ず緑になるが、
      そのとき見ているものは何も無い。
    */
    expect(listBaselines(ROOT).length).toBeGreaterThan(0);
  });

  it("設定の上限は、記録された上限を超えていない", () => {
    expect(VISUAL_BASELINE_ACCEPT_MAX).toBeLessThanOrEqual(readAcceptLimit(ROOT).limit);
  });

  it("上限は「上書きした枚数」に張ってあり、「見本の総枚数」には張っていない", () => {
    /*
      張る先を間違えると、上限は**反射的に引き上げられる的**になる。
      見本の総枚数は画面が増えれば増えるので、上限に向かない。
      いま見本は上限より多い。これが正常であることをここで固定する。
    */
    expect(listBaselines(ROOT).length).toBeGreaterThan(VISUAL_BASELINE_ACCEPT_MAX);
  });
});

describe("門そのものが動いていること（合成した違反を通す）", () => {
  /*
    上の節は「いま違反が 0 件」を見ている。それだけだと、
    **門が何も見ていなくても緑**になる。ここでわざと違反を作って、
    赤くなることを確かめる。
  */
  function fixture(build: (root: string) => void): string[] {
    const root = mkdtempSync(join(tmpdir(), "visual-gate-"));
    try {
      mkdirSync(join(root, `${BASELINE_DIR}/test-env`), { recursive: true });
      build(root);
      return auditBaselineLedger(root, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const png = encodePng(stripes(4, 4));
  const REASON = "この画面の余白を 60px から 44px へ詰めたので、見本を撮り直す";

  it("理由つきで台帳に載っていれば通る（陰性対照）", () => {
    const problems = fixture((root) => {
      writeFileSync(join(root, `${BASELINE_DIR}/test-env/a.png`), png);
      writeFileSync(join(root, LIMIT_HISTORY), JSON.stringify({ at: "2026-08-19", limit: 2, why: REASON }) + "\n");
      writeFileSync(
        join(root, UPDATES_LEDGER),
        JSON.stringify({ at: "2026-08-19", why: REASON, shots: [{ name: "a", environment: "test-env", sha256: sha256(png) }] }) + "\n",
      );
    });
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("台帳に載っていない見本があると赤くなる（手で差し替えた状態）", () => {
    const problems = fixture((root) => {
      writeFileSync(join(root, `${BASELINE_DIR}/test-env/a.png`), png);
      writeFileSync(join(root, LIMIT_HISTORY), JSON.stringify({ at: "2026-08-19", limit: 2, why: REASON }) + "\n");
      writeFileSync(join(root, UPDATES_LEDGER), "");
    });
    expect(problems.join("\n")).toContain("理由つきの上書きとして台帳に載っていません");
  });

  it("理由が短い行は、載っていても上書きを認めない", () => {
    const problems = fixture((root) => {
      writeFileSync(join(root, `${BASELINE_DIR}/test-env/a.png`), png);
      writeFileSync(join(root, LIMIT_HISTORY), JSON.stringify({ at: "2026-08-19", limit: 2, why: REASON }) + "\n");
      writeFileSync(
        join(root, UPDATES_LEDGER),
        JSON.stringify({ at: "2026-08-19", why: "更新", shots: [{ name: "a", environment: "test-env", sha256: sha256(png) }] }) + "\n",
      );
    });
    expect(problems.join("\n")).toContain(`${MIN_REASON_LENGTH} 文字以上`);
    // 理由が短い行の指紋は「認められた中身」に数えない。数えると門が抜ける。
    expect(problems.join("\n")).toContain("理由つきの上書きとして台帳に載っていません");
  });

  it("1 回に上限を超える枚数を上書きした行があると赤くなる", () => {
    const problems = fixture((root) => {
      writeFileSync(join(root, LIMIT_HISTORY), JSON.stringify({ at: "2026-08-19", limit: 2, why: REASON }) + "\n");
      writeFileSync(
        join(root, UPDATES_LEDGER),
        JSON.stringify({
          at: "2026-08-19",
          why: REASON,
          shots: ["a", "b", "c"].map((name) => ({ name, environment: "test-env", sha256: sha256(png) })),
        }) + "\n",
      );
    });
    expect(problems.join("\n")).toContain("上限 2 枚");
  });

  it("上限を上げる行を足すと赤くなる（下げる方向にしか動かさない）", () => {
    const problems = fixture((root) => {
      writeFileSync(
        join(root, LIMIT_HISTORY),
        [
          JSON.stringify({ at: "2026-08-19", limit: 2, why: REASON }),
          JSON.stringify({ at: "2026-08-20", limit: 4, why: "赤が多くて面倒なので上限を戻したい、という向きの変更" }),
          "",
        ].join("\n"),
      );
      writeFileSync(join(root, UPDATES_LEDGER), "");
    });
    expect(problems.join("\n")).toContain("上限は下げる方向にしか動かしません");
  });

  it("上限の記録が空なら、上書きは 1 枚も通さない", () => {
    const problems = fixture((root) => {
      writeFileSync(join(root, LIMIT_HISTORY), "");
      writeFileSync(join(root, UPDATES_LEDGER), "");
    });
    expect(problems.join("\n")).toContain("上限が決まっていない");
  });

  it("台帳の行が壊れていたら、飛ばさずに投げる", () => {
    // 読めない行を黙って飛ばすと、台帳を壊すだけで門が通せてしまう。
    expect(() =>
      fixture((root) => {
        writeFileSync(join(root, LIMIT_HISTORY), "これは JSON ではない\n");
        writeFileSync(join(root, UPDATES_LEDGER), "");
      }),
    ).toThrow(/読めません/);
  });
});
