/** @tier 1 */
import { POLICY_CHANNEL_SCOPES, isPolicyChannelScope } from "@/domain/compliance";
import { CHANNEL_CAPABILITIES, type ChannelKind } from "@/domain/distribution";
import { describe, expect, it } from "vitest";

/**
 * 「出せる場所」と「ルールを効かせられる場所」の語彙が一致していることを固定する。
 *
 * 表現ポリシーは出力先ごとに効き目を絞れる（`channelScope`）。
 * ところが出力先の語彙は配信側（`ChannelKind`）が持っていて、別々に増える。
 * 片方にだけ出力先が増えると、**その媒体の記事には `any` のルールしか当たらない**。
 * 画面は「違反 0 件」と出す。止まらない検査なので、誰も気づけない。
 *
 * 実際にここで 3 件（threads / wordpress / bluesky）が抜けていた。
 * 見つけたのは目視ではなく、この突き合わせである。
 *
 * 逆向き（ポリシー側にだけある出力先）も見る。出せない場所に向けたルールは
 * 永久に当たらないので、「登録したのに効かない」という同じ形の嘘になる。
 * ただし `any` は「どこでも」を表す特別な値なので、突き合わせから外す。
 *
 * 種別を `equivalence`（等価分割）としているのは、ここで分けているのが
 * 「ポリシーを効かせられる出力先」と「効かせられない出力先」という 2 つの組であり、
 * その境目を大小の端ではなく**語彙の一致**で決めているため。
 *
 * 規範: docs/product/traceability.md REQ-SEC07
 *
 * @req REQ-SEC07
 * @types equivalence
 */

const CHANNEL_KINDS = Object.keys(CHANNEL_CAPABILITIES) as readonly ChannelKind[];
const SPECIFIC_SCOPES = POLICY_CHANNEL_SCOPES.filter((s) => s !== "any");

describe("出力先の語彙と、ポリシーの出力先の語彙", () => {
  it("そもそも読み取れている（0 件なら、この突き合わせは何も見ていない）", () => {
    expect(CHANNEL_KINDS.length).toBeGreaterThan(5);
    expect(SPECIFIC_SCOPES.length).toBeGreaterThan(5);
  });

  it("出せる場所は、すべてポリシーで名指しできる", () => {
    const missing = CHANNEL_KINDS.filter((kind) => !isPolicyChannelScope(kind));
    expect(
      missing,
      "この出力先にはポリシーを効かせられません。POLICY_CHANNEL_SCOPES に足してください。",
    ).toEqual([]);
  });

  it("ポリシーで名指しできる場所は、すべて実際に出せる", () => {
    const kinds = new Set<string>(CHANNEL_KINDS);
    const orphans = SPECIFIC_SCOPES.filter((scope) => !kinds.has(scope));
    expect(orphans, "出せない場所に向けたルールは、登録しても当たりません。").toEqual([]);
  });
});
