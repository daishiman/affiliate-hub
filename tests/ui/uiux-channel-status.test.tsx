/**
 * @tier 2
 * @req REQ-UX03, REQ-UX04
 * @types equivalence, decision-table, code-boundary
 *
 * A3: 各サイト・SNS への投稿状態が管理画面の一覧・詳細に反映される。
 * A4: 新しい SNS の追加がプロバイダ実装の追加のみで完了し、既存画面の改修を要しない。
 *
 * 2 つを同じファイルで見るのは、どちらも同じ描画を見ているため。別々にすると
 * 同じ組み立てを 2 回書くことになり、この feature が禁じている重複を検査自身がやる。
 *
 * A4 の要は「**画面が配信先の種別で分岐しない**」こと。分岐が 1 つでも生えると、
 * SNS を足すたびにその分岐を全部探して直すことになり、「追加のみで完了」が崩れる。
 * 分岐を生やさないためには、表示に要る値をすべて能力表が持っていればよい。
 *
 * 状態の言い方を能力表に持たせる理由が最も重い。公式 API の無い配信先に
 * 「送信中」と出すと嘘になる。人が貼り付けるまで、何も起きていない。
 *
 * 見るのは 5 つ。
 *   1. 配信先の種別が能力表から導かれている（手書きの一覧ではない）
 *   2. 5 つの状態すべてに言い方がある
 *   3. 失敗のときは理由が必ず併記される
 *   4. 絵柄は投稿方式ごとの 3 種で、配信先ごとに増えない
 *   5. 表に 1 つ足すだけで、画面部品が変更なしに描ける
 *
 * 規範: docs/spec/feat-uiux-overhaul/sns-provider-contract.md,
 *       docs/spec/feat-uiux-overhaul/design-review.md (重大 10)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHANNEL_CAPABILITIES } from "@/domain/distribution/channel";

const ROOT = process.cwd();
const CHANNEL_SOURCE = join(ROOT, "src/domain/distribution/channel.ts");

/** 配信の状態。表示は配信先の方式で言い方が変わるが、状態そのものは共通。 */
const PUBLISH_STATES = ["not_started", "scheduled", "sending", "done", "failed"] as const;

/** 絵柄は投稿方式ごと。配信先を足しても増えない。 */
const PUBLISH_MODES = ["api_publish", "api_schedule", "manual_export"] as const;

type Capability = (typeof CHANNEL_CAPABILITIES)[keyof typeof CHANNEL_CAPABILITIES];

function extra(c: Capability): {
  readonly iconName?: string;
  readonly accentToken?: string;
  readonly statusLabels?: Record<string, string>;
  readonly basisCheckedAt?: string;
} {
  return c as never;
}

/** 部品はまだ無い。読み込めないことを 1 件の失敗として出す（収集ごと落とさない）。 */
async function loadPattern(name: string): Promise<unknown> {
  try {
    const mod: Record<string, unknown> = await import("@/presentation/ui");
    return mod[name] ?? null;
  } catch {
    return null;
  }
}

describe("A4 §1 配信先の種別が表から導かれている", () => {
  const source = readFileSync(CHANNEL_SOURCE, "utf8");

  it("表を先に書き、種別を表から導いている", () => {
    // 手書きの union と表の 2 か所を直す形だと、足すのは「1 エントリ追加」ではない。
    expect(source, "CHANNEL_CAPABILITIES が as const satisfies になっていません").toMatch(
      /CHANNEL_CAPABILITIES\s*=\s*\{[\s\S]*\}\s*as const satisfies/,
    );
    expect(source, "ChannelKind が表から導かれていません").toMatch(
      /type ChannelKind\s*=\s*keyof typeof CHANNEL_CAPABILITIES/,
    );
  });

  it("表のキーと各エントリの kind が一致している", () => {
    // ずれると、表から引いた記述と画面に出るものが食い違う。
    const odd = Object.entries(CHANNEL_CAPABILITIES)
      .filter(([key, cap]) => cap.kind !== key)
      .map(([key, cap]) => `${key} → ${cap.kind}`);
    expect(odd, `キーと kind が食い違う: ${odd.join(", ")}`).toEqual([]);
  });
});

describe("A4 §2 表示に要る値をすべて表が持つ", () => {
  const entries = Object.entries(CHANNEL_CAPABILITIES);

  it.each(entries)("%s に状態の言い方が 5 つある", (name, cap) => {
    const labels = extra(cap).statusLabels;
    expect(labels, `${name} に statusLabels がありません`).toBeDefined();
    const missing = PUBLISH_STATES.filter((s) => !labels?.[s]);
    expect(missing, `${name} に言い方が無い状態: ${missing.join(", ")}`).toEqual([]);
  });

  it.each(entries)("%s に識別色がある", (name, cap) => {
    const token = extra(cap).accentToken;
    expect(token, `${name} に accentToken がありません`).toBeTruthy();
    // 生の色値を持つと、明暗の切り替えでそこだけ取り残される。
    expect(token, `${name} の accentToken が生の色値です`).not.toMatch(/^#|^rgb/);
  });

  it.each(entries)("%s に根拠の確認日がある", (name, cap) => {
    // 古い制約で組み立てると、文字数超過や規約違反で失敗する。
    // 日付が見えれば、失敗したとき最初に疑う先が分かる。
    const at = extra(cap).basisCheckedAt;
    expect(at, `${name} に basisCheckedAt がありません`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("絵柄は投稿方式ごとの 3 種だけで、配信先ごとに増えない", () => {
    // 配信先ごとの絵柄にすると、足すたびに絵柄そのものを共通部品へ足すことになり、
    // 「既存画面の改修を要しない」が崩れる。
    const icons = new Set(Object.values(CHANNEL_CAPABILITIES).map((c) => extra(c).iconName));
    icons.delete(undefined);
    expect(
      [...icons].sort(),
      `絵柄が投稿方式ごとになっていません: ${[...icons].join(", ")}`,
    ).toEqual([...PUBLISH_MODES].sort());
  });

  it("送信できない配信先に「送信中」と出さない", () => {
    // 人が貼り付けるまで何も起きていないので、送信中は嘘になる。
    const lying = Object.entries(CHANNEL_CAPABILITIES)
      .filter(([, c]) => c.publishMode === "manual_export")
      .filter(([, c]) => (extra(c).statusLabels?.sending ?? "").includes("送信"))
      .map(([k]) => k);
    expect(lying, `送信していないのに送信中と出す: ${lying.join(", ")}`).toEqual([]);
  });
});

describe("A3 §1 状態が画面に出る", () => {
  it("ChannelStatusList がある", async () => {
    const part = await loadPattern("ChannelStatusList");
    expect(part, "ChannelStatusList がまだありません").not.toBeNull();
  });

  it("ChannelBadge がある", async () => {
    const part = await loadPattern("ChannelBadge");
    expect(part, "ChannelBadge がまだありません").not.toBeNull();
  });

  it("失敗のときは理由が必ず併記される", async () => {
    // 理由の無い失敗表示は、見た人に何もできることを与えない。
    const Part = (await loadPattern("ChannelStatusList")) as React.ComponentType<Record<string, unknown>> | null;
    if (!Part) {
      expect.fail("ChannelStatusList がまだありません");
      return;
    }
    const first = Object.values(CHANNEL_CAPABILITIES)[0];
    const props = {
      entries: [{ capability: first, state: "failed", failureReason: "文字数が上限を超えました" }],
    } as Record<string, unknown>;
    const html = renderToStaticMarkup(<Part {...props} />);
    expect(html).toContain("文字数が上限を超えました");
  });

  it("画面の側に配信先ごとの分岐が無い", () => {
    // 分岐が生えた時点で、SNS を足すたびに探して直すことになる。
    const kinds = Object.keys(CHANNEL_CAPABILITIES);
    const pattern = new RegExp(`(===|case)\\s*["'](${kinds.join("|")})["']`);
    const adminDir = join(ROOT, "src/app/admin");
    const found: string[] = [];
    const scanned: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".tsx")) {
          scanned.push(full);
          if (pattern.test(readFileSync(full, "utf8"))) found.push(full);
        }
      }
    };
    walk(adminDir);
    // 「分岐が無い」は 2 通りの理由で出る——本当に無いときと、**何も読んでいない**とき。
    // 探す語（配信先の種類）が空でも同じ 0 が出るので、両方に床を張る。
    expect(kinds.length, "配信先の種類が 1 つも取れていません").toBeGreaterThan(0);
    expect(scanned.length, "src/app/admin の .tsx を 1 件も読めていません").toBeGreaterThan(0);
    expect(found, `配信先で分岐している画面: ${found.join(", ")}`).toEqual([]);
  });
});
