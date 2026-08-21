/** @tier 2 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkup } from "../support/render";

/**
 * 生成 AI の鍵の画面。
 *
 * --- 使える状態を、ここでしか描けない ---
 * 画面をまとめて描く検査（page-render）は実行環境の外で走るので、
 * 必ず「預かれない」側になる。**登録の口が出ている状態**は
 * 差し替えを入れたここでしか通らない。通していないと、
 * 表も登録欄も一度も描かれないまま公開される。
 *
 * --- 見るのは「値が出ていないこと」と「理由が出ていること」 ---
 * 末尾 4 文字より多くが出る壊れ方と、空欄が理由なしに並ぶ壊れ方の 2 つ。
 * どちらも型は通る。
 *
 * 規範: docs/product/credential-registration.md
 * @req REQ-SEC01
 * @types secrets
 */

const LAST4 = "cd12";
let entry: unknown = null;

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, llmCredentialEntry: async () => entry };
});

const Page = (await import("@/app/admin/settings/llm/page")).default;

const MODELS = [
  {
    modelId: "m-1",
    label: "見本モデル",
    inputPricePerMillionMinor: 100,
    outputPricePerMillionMinor: 500,
    currency: "JPY",
  },
];

function row(overrides: Record<string, unknown> = {}) {
  return {
    providerId: "anthropic",
    label: "見本の提供元",
    keyIssueUrl: "https://example.invalid/keys",
    required: true,
    credential: null,
    models: MODELS,
    unavailableReason: "API キーがまだ登録されていません。",
    ...overrides,
  };
}

function readyWith(rows: readonly unknown[]) {
  return {
    ready: true as const,
    manage: {
      execute: async () => ({ ok: true, value: { rows, verifyFailure: null, emptyReason: null } }),
    },
  };
}

beforeEach(() => {
  entry = readyWith([row()]);
});

describe("生成 AI の鍵の画面", () => {
  it("預かれないときは、理由と鍵の発行先が出る", async () => {
    entry = {
      ready: false,
      reason: "元締めの鍵（LLM_KEY_ENCRYPTION_SECRET）が未登録です。",
      providers: [
        {
          providerId: "anthropic",
          label: "見本の提供元",
          keyIssueUrl: "https://example.invalid/keys",
          required: true,
        },
      ],
    };
    const html = await renderMarkup(Page());
    expect(html).toContain("LLM_KEY_ENCRYPTION_SECRET");
    // 登録できない状態でこそ、鍵をどこで取るかの案内が要る。
    expect(html).toContain("https://example.invalid/keys");
  });

  it("提供元の設定が無いときも、画面ごと消さずに理由を出す", async () => {
    entry = { ready: false, reason: "保存先につながっていません。", providers: [] };
    const html = await renderMarkup(Page());
    expect(html).toContain("保存先につながっていません。");
    expect(html).toContain("提供元の設定が入っていません");
  });

  it("鍵が未登録のときは、その理由が状態の欄に出る", async () => {
    const html = await renderMarkup(Page());
    expect(html).toContain("API キーがまだ登録されていません。");
    expect(html).toContain("未登録");
  });

  it("登録済みのときは末尾 4 文字だけが出る", async () => {
    entry = readyWith([
      row({
        credential: {
          providerId: "anthropic",
          last4: LAST4,
          status: "active",
          registeredBy: "u_1",
          registeredAt: new Date("2026-08-01T00:00:00Z"),
          lastVerifiedAt: new Date("2026-08-02T00:00:00Z"),
          lastVerification: "ok",
        },
        unavailableReason: null,
      }),
    ]);
    const html = await renderMarkup(Page());
    expect(html).toContain(`末尾 ${LAST4}`);
    expect(html).toContain("つながりました");
    expect(html).toContain("使えます");
    // 失効と疎通確認の口は、鍵があるときだけ出す。
    expect(html).toContain("失効させる");
  });

  it("確かめていない鍵は、確かめていないと出る（空欄にしない）", async () => {
    entry = readyWith([
      row({
        credential: {
          providerId: "anthropic",
          last4: LAST4,
          status: "active",
          registeredBy: null,
          registeredAt: new Date("2026-08-01T00:00:00Z"),
          lastVerifiedAt: null,
          lastVerification: null,
        },
        unavailableReason: null,
      }),
    ]);
    const html = await renderMarkup(Page());
    expect(html).toContain("確かめていません");
  });

  it("選べるモデルが無いときは、登録の欄を出さない", async () => {
    // 登録できても呼べる先が無い。入れさせてから「何も起きない」を見せない。
    entry = readyWith([
      row({ models: [], unavailableReason: "選べるモデルが設定されていません。" }),
    ]);
    const html = await renderMarkup(Page());
    expect(html).toContain("選べるモデルが設定されていません。");
    expect(html).not.toContain("この鍵を登録する");
  });

  it("提供元が 1 件も無いときは、その理由を出す", async () => {
    entry = readyWith([]);
    const html = await renderMarkup(Page());
    expect(html).toContain("使える提供元がありません");
  });

  it("一覧を出せないときは、失敗として出す（空の表にしない）", async () => {
    entry = {
      ready: true,
      manage: {
        execute: async () => ({
          ok: false,
          error: { message: "権限がありません。", suggestedAction: "運営者に依頼してください。" },
        }),
      },
    };
    const html = await renderMarkup(Page());
    expect(html).toContain("権限がありません。");
    expect(html).toContain("運営者に依頼してください。");
  });
});
