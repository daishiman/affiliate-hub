/**
 * @tier 1
 * @types equivalence, boundary, permission-matrix, infra-config
 * @req REQ-S10
 *
 * 手元だけの入口が、**手元だけで開く**ことの確認。
 *
 * この口は合言葉なしで通行証を出す。だから確かめる値打ちがあるのは
 * 「開く」側ではなく、**開かない**側にしかない。旗を 1 つずつ折って、
 * どちらか片方が欠けただけで閉じることを並べてある。
 *
 * 併せて `wrangler.jsonc` に旗が**書かれていない**ことも見る。
 * 判定をいくら固めても、設定に旗を足せば積んだ環境にも配られてしまう。
 * 判定と配り先は別の穴なので、別々に塞ぐ。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEV_SIGNIN_DEFAULT_EMAIL,
  DEV_SIGNIN_EMAIL_KEY,
  DEV_SIGNIN_FLAG,
  decideDevSignIn,
} from "@/infrastructure/identity/dev-signin";

const ROOT = join(__dirname, "..", "..");

describe("decideDevSignIn", () => {
  it("旗が立ち、積んだ環境でなければ開く", () => {
    const decision = decideDevSignIn({ flag: "1", email: undefined, nodeEnv: "development" });
    expect(decision).toEqual({ kind: "open", email: DEV_SIGNIN_DEFAULT_EMAIL });
  });

  it("アドレスを指せば、その担当者として入る", () => {
    const decision = decideDevSignIn({
      flag: "1",
      email: " other@local.test ",
      nodeEnv: "test",
    });
    expect(decision).toEqual({ kind: "open", email: "other@local.test" });
  });

  it.each([
    ["旗が無い", { flag: undefined, nodeEnv: "development" }],
    ['旗が "1" 以外', { flag: "true", nodeEnv: "development" }],
    ["旗が真偽値", { flag: true, nodeEnv: "development" }],
    ["積んだ環境", { flag: "1", nodeEnv: "production" }],
    ["両方欠ける", { flag: undefined, nodeEnv: "production" }],
  ])("%s なら閉じる", (_name, input) => {
    const decision = decideDevSignIn({ ...input, email: undefined });
    expect(decision.kind).toBe("closed");
  });

  it("空白だけのアドレスは既定へ落ちる（空の担当者を探しに行かない）", () => {
    const decision = decideDevSignIn({ flag: "1", email: "   ", nodeEnv: "development" });
    expect(decision).toEqual({ kind: "open", email: DEV_SIGNIN_DEFAULT_EMAIL });
  });
});

describe("旗の配り先", () => {
  it("wrangler.jsonc に旗が書かれていない（書けば積んだ環境にも配られる）", () => {
    const text = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
    expect(text).not.toContain(DEV_SIGNIN_FLAG);
    expect(text).not.toContain(DEV_SIGNIN_EMAIL_KEY);
  });

  it("旗の名前は 1 か所でしか決めていない", () => {
    expect(DEV_SIGNIN_FLAG).toBe("DEV_SIGNIN_ENABLED");
    expect(DEV_SIGNIN_EMAIL_KEY).toBe("DEV_SIGNIN_EMAIL");
  });
});
