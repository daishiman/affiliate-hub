/**
 * @tier 1
 * @req REQ-G11, REQ-TM03
 *
 * モデルの目録の**設定そのもの**を見る。
 *
 * `llm-provider-catalog.test.ts` は「設定を渡したらどう振る舞うか」を見ている。
 * こちらは「**いま配ろうとしている設定の中身**」を見る。前者は作り物の設定で
 * 全部緑にできるので、実際に配る値が空でも古くても気づけない。
 *
 * 見るのは 4 つ。
 *   1. 正本を通すと、モデルが実際に並ぶ（0 件ではない）
 *   2. 配り先 3 か所が正本と食い違っていない
 *   3. 単価に出どころと確認日が付いていて、確認日が古くなっていない
 *   4. 単価が提供元の通貨のまま（円に換算して持っていない）
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLlmProviderCatalog } from "@/infrastructure/llm/llm-provider-catalog";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "config/llm-provider-catalog.json");

/**
 * 確認日がこれより古かったら赤にする日数。
 *
 * --- 90 日にした理由 ---
 * 短くするほど安全に見えるが、**短すぎると形骸化する**。30 日にすると
 * 毎月この赤が出て、いちばん短い直し方が「価格ページを見ずに日付だけ書き換える」
 * になる。そうなった時点で、この検査は何も守らなくなる。
 *
 * 一方、各社の値上げ・値下げは四半期をまたいで起きる（この 1 か月でも
 * OpenAI が 2 モデル下げている）。90 日なら、**改定を跨いだまま放置される期間が
 * 最長でも 1 四半期に収まる**。四半期に 1 度なら、開いて確かめるほうが
 * 日付を書き換えるより素直な直し方として残る。
 *
 * **この日数は下げる方向にしか動かさない。** 赤が出たときに伸ばすのは、
 * 古い単価を「古くない」と言い換える操作である。
 *
 * --- `pricedOn` が主張していることの強さ ---
 * 「その日に、その提供元のドメインから返ってきた内容でその単価を読んだ」まで。
 * **その URL を直接開いて読んだ、ではない**（2026-08-18 の投入時、この作業場所では
 * ページ取得の手段が使えず、提供元のドメインに絞った検索の結果から読んだ）。
 * 記憶から書いて URL を後付けしたものは 1 行も無い。
 * 詳しくは `docs/product/credential-registration.md` の「`pricedOn` が主張していること」。
 */
const MAX_AGE_DAYS = 90;

/**
 * 単価のページの持ち主。**提供元ごとに固定する。**
 *
 * 固定しないと、行を足した人が直前の行の URL をそのまま複製できる。
 * 複製された行は「確かめた」ように見えるが、確かめた先は別の会社である。
 */
const PRICING_HOST: Readonly<Record<string, string>> = {
  anthropic: "platform.claude.com",
  google: "ai.google.dev",
  openai: "developers.openai.com",
  xai: "docs.x.ai",
};

const raw = readFileSync(SOURCE, "utf8");
const catalog = createLlmProviderCatalog(raw);
const providerIds = Object.keys(JSON.parse(raw) as Record<string, unknown>);

describe("正本を通すと、モデルが実際に並ぶ", () => {
  it("設定として読める（書き方の誤りで全部落ちていない）", async () => {
    const models = await catalog.listModels("anthropic");
    expect(models.ok, "正本が JSON の形として通っていません").toBe(true);
  });

  it("少なくとも 1 つの提供元にモデルが並ぶ", async () => {
    // 受入条件そのもの。ここが 0 件だと、鍵を登録しても下書きは作れない。
    let total = 0;
    for (const providerId of providerIds) {
      const models = await catalog.listModels(providerId);
      expect(models.ok).toBe(true);
      if (models.ok) total += models.value.length;
    }
    expect(total, "目録が空です。画面は「選べるモデルがありません」になります").toBeGreaterThan(0);
  });

  it("鍵の要る 4 社は全部モデルを持つ", async () => {
    // 1 社だけ埋まっていると「モデルを選ぶ」機能そのものが成り立たない。
    for (const providerId of ["anthropic", "google", "openai", "xai"]) {
      const models = await catalog.listModels(providerId);
      expect(models.ok).toBe(true);
      if (models.ok) expect(models.value.length, providerId).toBeGreaterThan(0);
    }
  });

  it("Workers AI は空のまま（枠だけで、いま使う予定が無い）", async () => {
    // 取りに行って失敗したのではなく、**入れないと決めている**。
    // ここが埋まったら、鍵の要らない呼び出し経路も一緒に要る。
    const models = await catalog.listModels("workers_ai");
    expect(models.ok).toBe(true);
    if (models.ok) expect(models.value).toEqual([]);
  });
});

describe("配り先 3 か所が正本と食い違っていない", () => {
  it("wrangler.jsonc の 3 か所が正本と同じ", () => {
    // 判定は `scripts/catalog-sync.mjs --check` に任せる。
    // ここへ書き写すと、写しの検査が 2 つになって片方だけ緩む。
    expect(() =>
      execFileSync("node", ["scripts/catalog-sync.mjs", "--check"], { cwd: ROOT }),
    ).not.toThrow();
  });
});

describe("単価には出どころと確認日が付いている", () => {
  it("すべての行に出どころと確認日がある", async () => {
    // 形の検査（`parseModel`）が必須にしているので、欠けていれば
    // その提供元ごと落ちる。ここは「落ちた結果 0 件」ではないことを見る。
    for (const providerId of providerIds) {
      const models = await catalog.listModels(providerId);
      expect(models.ok, providerId).toBe(true);
      if (!models.ok) continue;
      for (const m of models.value) {
        expect(m.sourceUrl, `${providerId}/${m.modelId}`).toMatch(/^https:\/\//);
        expect(m.pricedOn, `${providerId}/${m.modelId}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("出どころが、その提供元自身のページである", async () => {
    for (const [providerId, host] of Object.entries(PRICING_HOST)) {
      const models = await catalog.listModels(providerId);
      expect(models.ok).toBe(true);
      if (!models.ok) continue;
      for (const m of models.value) {
        expect(new URL(m.sourceUrl).host, `${providerId}/${m.modelId}`).toBe(host);
      }
    }
  });

  it(`確認日が ${MAX_AGE_DAYS} 日より古くない`, async () => {
    const stale: string[] = [];
    const now = Date.now();
    for (const providerId of providerIds) {
      const models = await catalog.listModels(providerId);
      if (!models.ok) continue;
      for (const m of models.value) {
        const days = Math.floor((now - Date.parse(`${m.pricedOn}T00:00:00Z`)) / 86_400_000);
        if (days > MAX_AGE_DAYS) stale.push(`${providerId}/${m.modelId}（${days} 日前）`);
      }
    }
    expect(
      stale,
      "価格ページを開き直して単価と確認日を入れ直してください。" +
        "**日付だけ書き換えないこと。** 見ていないものを見たことにする操作です。",
    ).toEqual([]);
  });

  it("先の日付になっていない（未来の日付で古さを消せない）", async () => {
    const now = Date.now();
    for (const providerId of providerIds) {
      const models = await catalog.listModels(providerId);
      if (!models.ok) continue;
      for (const m of models.value) {
        expect(Date.parse(`${m.pricedOn}T00:00:00Z`), `${providerId}/${m.modelId}`).toBeLessThanOrEqual(
          now,
        );
      }
    }
  });
});

describe("単価は提供元の通貨のまま持つ", () => {
  it("円に換算して保存していない", async () => {
    /*
      円で持つには為替をこちらが決める必要があり、その値は必ず古くなる。
      しかも請求の正本は提供元の USD なので、円で持った瞬間に
      **照合できない概算**になる。円で見せたいときは表示の段で掛ける。
    */
    for (const providerId of providerIds) {
      const models = await catalog.listModels(providerId);
      if (!models.ok) continue;
      for (const m of models.value) {
        expect(m.currency, `${providerId}/${m.modelId}`).not.toBe("JPY");
      }
    }
  });

  it("単価が 0 でない（0 だと上限で止める仕組みが効かない）", async () => {
    for (const providerId of providerIds) {
      const models = await catalog.listModels(providerId);
      if (!models.ok) continue;
      for (const m of models.value) {
        expect(m.inputPricePerMillionMinor, `${providerId}/${m.modelId}`).toBeGreaterThan(0);
        expect(m.outputPricePerMillionMinor, `${providerId}/${m.modelId}`).toBeGreaterThan(0);
      }
    }
  });
});
