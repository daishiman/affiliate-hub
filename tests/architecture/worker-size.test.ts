/**
 * @tier 1
 * @req REQ-CI16
 * @types infra-config, equivalence, boundary
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md
 *
 * 公開前に Worker の大きさを測る門（`scripts/worker-size.mjs`）の読み取りと判定。
 *
 * ここで塞ぎたいのは 1 つ:**測れなかったことが、収まっていることと同じ緑になる**こと。
 * 2026-08-30 の事故は「上限を超えたのに気づかなかった」ではなく
 * 「上限まで残り 6.5 KiB を、誰も一度も見ていなかった」だった。
 * 読み取りが空振りしたときに黙って 0 を返す実装は、同じ事故をもう一度起こす。
 */
import { describe, expect, it } from "vitest";
import {
  environmentFrom,
  formatHeadline,
  judgeSize,
  LIMIT_KIB,
  parseUploadSize,
  WARN_MARGIN_KIB,
} from "../../scripts/worker-size.mjs";

/** wrangler の実出力（2026-08-31、`--env dev` の実測）から必要な 2 行だけ抜いたもの。 */
const REAL_OUTPUT = [
  "Total Upload: 15574.34 KiB / gzip: 2937.80 KiB",
  "Uploaded affiliate-hub-dev (3.21 sec)",
].join("\n");

describe("wrangler の出力から大きさを読む", () => {
  it("要件 1: 実出力から生値と gzip 値の両方を取り出す", () => {
    expect(parseUploadSize(REAL_OUTPUT)).toEqual({ rawKib: 15574.34, gzipKib: 2937.8 });
  });

  it("要件 2: 読めない出力では null を返す（0 と取り違えさせない）", () => {
    // 0 を返すと「上限まで 3072 KiB の余裕がある」と読めてしまい、
    // **測れていないのに一番安全な数字**が出る。null は呼ぶ側で必ず落ちる。
    for (const broken of [
      "", // 何も出なかった
      "Total Upload: 15574.34 KiB", // gzip 側だけ形が変わった
      "Total Upload: 15574.34 MiB / gzip: 2937.80 MiB", // 単位が変わった
      "Total: 15574.34 KiB / gzip: 2937.80 KiB", // 見出しが変わった
      "Uploaded affiliate-hub-dev (3.21 sec)", // 別の行だけ
    ]) {
      expect(parseUploadSize(broken), `読めないはずの出力を読んでいる: ${broken}`).toBeNull();
    }
  });

  it("要件 3: 数として壊れていれば読めたことにしない", () => {
    expect(parseUploadSize("Total Upload: .. KiB / gzip: .. KiB")).toBeNull();
  });
});

describe("収まっている／細っている／超えているの判定", () => {
  it("要件 4: 3 つの区分に分かれる", () => {
    expect(judgeSize({ gzipKib: 1000 }).verdict).toBe("ok");
    expect(judgeSize({ gzipKib: 2937.8 }).verdict).toBe("thin"); // いまの実測値
    expect(judgeSize({ gzipKib: 3100 }).verdict).toBe("over");
  });

  it("要件 5: 上限ちょうどは超過（Cloudflare 側と同じ境目にする）", () => {
    // ここを `>` に緩めると「手元は緑・本番は赤」になる。一番たちの悪い形。
    expect(judgeSize({ gzipKib: LIMIT_KIB }).verdict).toBe("over");
    expect(judgeSize({ gzipKib: LIMIT_KIB - 0.01 }).verdict).not.toBe("over");
  });

  it("要件 6: 警告の境目は余白ちょうどでは鳴らず、下回ると鳴る", () => {
    expect(judgeSize({ gzipKib: LIMIT_KIB - WARN_MARGIN_KIB }).verdict).toBe("ok");
    expect(judgeSize({ gzipKib: LIMIT_KIB - WARN_MARGIN_KIB + 0.01 }).verdict).toBe("thin");
  });

  it("要件 7: 余白は上限からの引き算で、超過分は負で出る", () => {
    expect(judgeSize({ gzipKib: LIMIT_KIB + 100 }).marginKib).toBeCloseTo(-100, 5);
  });

  it("要件 8: 上限は無料プランの 3 MiB（gzip 後）である", () => {
    // 有料プランへ移るなら、この数を変える判断をここで一度止める。
    expect(LIMIT_KIB).toBe(3 * 1024);
  });
});

describe("出し先の指定", () => {
  it("要件 9: --env が無ければ null（既定の出し先を作らない）", () => {
    // 既定値を置くと、指定し忘れた回に**別の環境を測って緑**になる。
    expect(environmentFrom(["node", "worker-size.mjs"])).toBeNull();
    expect(environmentFrom(["node", "worker-size.mjs", "--env"])).toBeNull();
  });

  it("要件 10: --env の次の語を出し先として取る", () => {
    expect(environmentFrom(["node", "worker-size.mjs", "--env", "production"])).toBe("production");
  });
});

describe("人が読む 1 行", () => {
  it("要件 11: 実寸・上限・残り余白が全部出る（数字を隠さない）", () => {
    const size = parseUploadSize(REAL_OUTPUT);
    if (size === null) throw new Error("実出力が読めていません");
    const line = formatHeadline(size, judgeSize(size).marginKib);
    expect(line).toContain("2938 KiB");
    expect(line).toContain("3072 KiB");
    expect(line).toContain("残り 134 KiB");
  });
});
