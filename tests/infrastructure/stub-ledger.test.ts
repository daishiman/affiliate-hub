/** @tier 1 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAspAdapter, supportedAsps } from "@/infrastructure/asp/asp-registry";
import { availableChannels, createChannelConnector } from "@/infrastructure/channels/channel-registry";
import { LLM_PROVIDER_LABEL, createLlm } from "@/infrastructure/llm/llm-provider-registry";
import type { LlmProviderKind } from "@/infrastructure/llm/llm-provider-registry";
import { fakeSecretResolver } from "@/infrastructure/platform/secret-resolver";
import "@/infrastructure/platform/storage-r2";
import { listFallbacks, listStubs, listUnbuiltStubs } from "@/infrastructure/stub-registry";
import { createToolCatalog } from "@/presentation/composition";

/**
 * 「まだ中身が無いもの」の一覧を、人が数えずに作る。
 *
 * 手で書いた一覧は必ず古くなる。古い一覧は
 * 「できている」と誤って報告する原因になるので、
 * 台帳をコードから作り、ずれていたらここで落とす。
 *
 * 更新するとき: `UPDATE_STUB_LEDGER=1 pnpm test` を実行して差分をコミットする。
 */
const LEDGER_PATH = join(process.cwd(), "docs/product/stub-ledger.md");

/**
 * 台帳に載せるには、実装を 1 度は組み立てる必要がある。
 *
 * つなぎ目は「使うときに作る」ので、作らないと台帳に現れない。
 * ここで全種類を 1 つずつ作り、数え漏れをなくす。
 */
async function buildEverything(): Promise<void> {
  const secrets = fakeSecretResolver({});

  await createToolCatalog();

  for (const asp of supportedAsps()) {
    createAspAdapter(asp.kind, { credentialRef: null, publicTrackingId: null, secrets });
  }

  for (const channel of availableChannels()) {
    createChannelConnector(channel.kind, { credentialRef: null, secrets });
  }

  for (const kind of Object.keys(LLM_PROVIDER_LABEL) as LlmProviderKind[]) {
    createLlm(kind, { credentialRef: "llm/default/api_key", modelId: "unset", secrets });
  }
}

function renderLedger(): string {
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
  const unbuilt = [...listUnbuiltStubs()].sort(byId);
  const fallbacks = [...listFallbacks()].sort(byId);
  const lines = [
    "# まだ中身が無いもの（スタブ台帳）",
    "",
    "このファイルは `tests/infrastructure/stub-ledger.test.ts` が作る。手で書き換えない。",
    "更新は `UPDATE_STUB_LEDGER=1 pnpm test` を実行して、出た差分をそのまま保存する。",
    "",
    "「スタブ」は、つなぎ目だけあって中身がまだ無いもの。呼ぶと必ず失敗を返す。",
    "成功したふりをしないので、「つながっているのに結果が空」という分かりにくい壊れ方をしない。",
    "",
    "**2 つに分けて数える。** 下の「控え」は本物ができたあとも残るもので、",
    "まだ作っていないものと一緒に数えると、進んだのに件数が減らないという読み方になる。",
    "",
    "## まだ中身が無いもの",
    "",
    `件数: ${unbuilt.length}`,
    "",
    "| 識別子 | 何のスタブか | つなぎ目 | 何が済めば実装できるか |",
    "|---|---|---|---|",
    ...unbuilt.map((e) => `| \`${e.id}\` | ${e.label} | ${e.port} | ${e.blockedBy} |`),
    "",
    "## 本物ができたあとの控え",
    "",
    "本物はあるが、保存先が供給されない環境（`pnpm dev`・自動テスト）では",
    "こちらへ回る。**消す予定は無いので、この件数は減らない。**",
    "何で動いているかは、必ず画面に文字で出す（黙って控えへ落ちない）。",
    "",
    `件数: ${fallbacks.length}`,
    "",
    "| 識別子 | 何の控えか | つなぎ目 | 本物の置き場所 |",
    "|---|---|---|---|",
    ...fallbacks.map((e) => `| \`${e.id}\` | ${e.label} | ${e.port} | \`${e.fallbackFor}\` |`),
    "",
  ];
  return lines.join("\n");
}

describe("スタブ台帳", () => {
  it("すべてのスタブが名前と前提条件を名乗っている", async () => {
    await buildEverything();
    const entries = listStubs();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.label.trim(), `${entry.id} に説明がありません`).not.toBe("");
      // 「時間が無い」は前提条件ではない。何が済めば実装できるかを書く。
      expect(entry.blockedBy.trim(), `${entry.id} に前提条件がありません`).not.toBe("");
    }
  });

  it("控えと名乗るには、本物のファイルが実在していなければならない", async () => {
    // ここを見ないと、`fallbackFor` に文字列を書くだけで
    // 「まだ中身が無いもの」の件数を減らせてしまう。
    // 数字の作り方を、書き手の申告ではなくファイルの実在に結び付ける。
    await buildEverything();
    const fallbacks = listFallbacks();
    expect(fallbacks.length).toBeGreaterThan(0);
    for (const entry of fallbacks) {
      const real = join(process.cwd(), String(entry.fallbackFor));
      expect(existsSync(real), `${entry.id} の本物 ${entry.fallbackFor} がありません`).toBe(true);
    }
  });

  it("2 つの数を足すと全体になる（どちらかに数え漏れが出ない）", async () => {
    await buildEverything();
    expect(listUnbuiltStubs().length + listFallbacks().length).toBe(listStubs().length);
  });

  it("台帳ファイルが実際の状態と一致している", async () => {
    await buildEverything();
    const expected = renderLedger();

    if (process.env.UPDATE_STUB_LEDGER === "1") {
      writeFileSync(LEDGER_PATH, expected, "utf8");
    }

    let actual: string;
    try {
      actual = readFileSync(LEDGER_PATH, "utf8");
    } catch {
      actual = "";
    }

    expect(
      actual,
      "スタブ台帳が古くなっています。`UPDATE_STUB_LEDGER=1 pnpm test` で作り直してください。",
    ).toBe(expected);
  });
});
