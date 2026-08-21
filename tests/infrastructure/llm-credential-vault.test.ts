/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { LlmCredentialRow } from "@/db/schema";
import { asWorkspaceId, taggedString } from "@/domain/shared";
import type { UserId, WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { createD1LlmCredentialVault } from "@/infrastructure/persistence/d1/llm-credential-repository";
import { openSecret, sealSecret } from "@/infrastructure/platform/secret-box";

/**
 * 鍵の預かり所を、実際に動かして確かめる。
 *
 * 書き方を読む検査（`tests/architecture/llm-credential-leak.test.ts`）と対にする。
 * あちらは「鍵に触れる場所が増えていないか」を見る。**こちらは実際に何が起きるか**で、
 * 特に「提供元が鍵を載せたエラーを返してきたとき」を作って確かめる。
 * ここが一番漏れやすい経路で、しかも書き方を読むだけでは絶対に見つからない。
 *
 * @req REQ-SEC01, REQ-SEC05
 * @types secrets, tenant-isolation
 */

const WS = asWorkspaceId("ws_a") as WorkspaceId;
const OTHER = asWorkspaceId("ws_b") as WorkspaceId;
const USER = taggedString<"UserId">("u_1") as UserId;

/** 32 文字以上。短いと元締めの鍵として受け付けない。 */
const MASTER = "test-master-secret-0123456789abcdef";
/**
 * 見た目が本物に近い値を使う。短い値だと塗り潰しの検査が甘くなる。
 *
 * ただし**実在の提供元の接頭辞（`sk-ant-` など）は使わない。**
 * 秘密情報の持ち込みを見張る検査（`tests/architecture/test-honesty.test.ts`）が
 * 形で拾うため、試験用の作り物でも同じ形だと止まる。
 * これは見張りが正しく効いている証拠なので、迂回せず値のほうを変える。
 * `pk-` は塗り潰しの対象の形であり、かつどの提供元の本物の形とも重ならない。
 */
const API_KEY = "pk-test-0123456789abcdefghijklmn";

/**
 * 作業場所ごとに行を分けて持つ偽の接続。
 *
 * **`where` を無視する偽物にしない。** 無視すると、
 * 作業場所の分離を確かめているつもりで何も確かめていないことになる。
 * ここでは主キー（作業場所 + 提供元）の組で持ち、
 * 問い合わせに渡された条件を実際に見る。
 */
function fakeDb() {
  const rows = new Map<string, LlmCredentialRow>();
  /** 直前の条件で実際に絞り込みに使われた値。 */
  let lastValues: string[] = [];

  /**
   * 条件から**渡された値だけ**を取り出す。
   *
   * 素直に辿ると、列 1 つから表全体へ手が届き、
   * 使っていない列の名前まで拾える（`workspace_id` だけで絞ったつもりが
   * `provider_id` も見えてしまう）。それでは
   * 「どこまで絞られているか」を判定できず、**通ってはいけない問い合わせが通る偽物**になる。
   * だから値の入っている箱（Param）だけを見る。
   */
  const captureWhere = (cond: unknown) => {
    const found: string[] = [];
    const seen = new Set<unknown>();
    const walk = (node: unknown) => {
      if (typeof node !== "object" || node === null || seen.has(node)) return;
      seen.add(node);
      const r = node as Record<string, unknown>;
      if ("encoder" in r && typeof r.value === "string") {
        found.push(r.value);
        return;
      }
      if ("queryChunks" in r) {
        for (const chunk of r.queryChunks as unknown[]) walk(chunk);
        return;
      }
      if (Array.isArray(node)) for (const item of node) walk(item);
    };
    walk(cond);
    lastValues = found;
  };

  const select = {
    from: () => select,
    where: (cond: unknown) => {
      captureWhere(cond);
      return select;
    },
    limit: (n: number) => Promise.resolve(matched().slice(0, n)),
    then: (resolve: (v: LlmCredentialRow[]) => unknown) => Promise.resolve(matched()).then(resolve),
  };

  /**
   * 絞り込みに使われた値と、行の主キーを突き合わせる。
   * 値が 1 つなら作業場所だけ、2 つなら作業場所と提供元で絞られている。
   */
  function matched(): LlmCredentialRow[] {
    // **ここで作業場所を必ず見る、という書き方をしない。**
    // 偽物の側が分離を肩代わりすると、実装から `workspaceId` の条件を
    // 丸ごと外しても検査が緑のままになる（実測して分かった）。
    // 渡された値だけで絞り、絞りが足りなければ足りないまま返す。
    return [...rows.values()].filter((r) =>
      lastValues.every((v) => v === r.workspaceId || v === r.providerId),
    );
  }

  const db = {
    select: () => select,
    insert: () => ({
      values: (v: LlmCredentialRow) => ({
        onConflictDoUpdate: () => {
          rows.set(`${v.workspaceId}/${v.providerId}`, v);
          return Promise.resolve();
        },
      }),
    }),
    update: () => ({
      set: (patch: Partial<LlmCredentialRow>) => ({
        where: (cond: unknown) => {
          captureWhere(cond);
          for (const r of matched()) {
            rows.set(`${r.workspaceId}/${r.providerId}`, { ...r, ...patch });
          }
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db: db as unknown as DrizzleD1, rows };
}

const vaultOf = (db: DrizzleD1) =>
  createD1LlmCredentialVault({ db, masterSecret: MASTER, now: () => new Date("2026-08-18") });

describe("生成 AI の鍵の預かり所", () => {
  it("要件 1: 保管される値が平文でない（そのままでは読めない）", async () => {
    const { db, rows } = fakeDb();
    const stored = await vaultOf(db).store({
      workspaceId: WS,
      providerId: "anthropic",
      apiKey: API_KEY,
      registeredBy: USER,
    });
    expect(stored.ok).toBe(true);

    const row = rows.get("ws_a/anthropic");
    expect(row, "行が保存されていません").toBeDefined();
    // 行のどの欄にも鍵が現れないこと。**列を 1 つずつ見るのではなく全部を見る**
    // （新しい欄が増えたときに検査を直し忘れても、ここで拾える）。
    expect(JSON.stringify(row)).not.toContain(API_KEY);
    // 包んだ値は、元締めの鍵があれば戻る。戻らないなら保存の意味が無い。
    expect(await openSecret(row?.sealedKey ?? "", MASTER)).toBe(API_KEY);
  });

  it("要件 1: 毎回ちがう暗号文になる（同じ鍵を入れ直しても同じ文字列にならない）", async () => {
    const a = await sealSecret(API_KEY, MASTER);
    const b = await sealSecret(API_KEY, MASTER);
    // 同じになると、2 つの作業場所が同じ鍵を使っていることが暗号文の比較で分かってしまう。
    expect(a).not.toBe(b);
  });

  it("要件 2: よその作業場所の鍵は取り出せない", async () => {
    const { db } = fakeDb();
    const vault = vaultOf(db);
    await vault.store({
      workspaceId: WS,
      providerId: "anthropic",
      apiKey: API_KEY,
      registeredBy: USER,
    });

    const seen: string[] = [];
    const used = await vault.useKey({
      workspaceId: OTHER,
      providerId: "anthropic",
      fn: async (key) => {
        seen.push(key);
        return "使えてしまった";
      },
    });
    expect(used.ok).toBe(false);
    // 渡した処理がそもそも呼ばれないこと。呼ばれてから断ると、
    // その時点で鍵は相手の手に渡っている。
    expect(seen).toEqual([]);
  });

  it("要件 3: 一覧にも取得にも鍵の値が入らない（末尾 4 文字だけ）", async () => {
    const { db } = fakeDb();
    const vault = vaultOf(db);
    await vault.store({
      workspaceId: WS,
      providerId: "anthropic",
      apiKey: API_KEY,
      registeredBy: USER,
    });

    const listed = await vault.list(WS);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(JSON.stringify(listed.value)).not.toContain(API_KEY);
    expect(listed.value[0]?.last4).toBe(API_KEY.slice(-4));
  });

  it("要件 5: 提供元が鍵を載せたエラーを返しても、返る失敗に鍵が混ざらない", async () => {
    const { db } = fakeDb();
    const vault = vaultOf(db);
    await vault.store({
      workspaceId: WS,
      providerId: "anthropic",
      apiKey: API_KEY,
      registeredBy: USER,
    });

    // **わざと鍵を含むエラーを起こす。** 実際の提供元は
    // 「Incorrect API key provided: sk-…」という文面を返してくる。
    const failed = await vault.useKey({
      workspaceId: WS,
      providerId: "anthropic",
      fn: async (key) => {
        throw new Error(`Incorrect API key provided: ${key}. You can find your key at …`);
      },
    });

    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    // 失敗の値まるごとを見る。欄を 1 つずつ見ると、新しい欄が増えたときに漏れる。
    expect(JSON.stringify(failed.error)).not.toContain(API_KEY);
    // 頭のほうだけ載る形（省略された引用）も拾う。
    expect(JSON.stringify(failed.error)).not.toContain(API_KEY.slice(0, 20));
    // それでも「何が起きたか」は残っていること。全部消すと調べようがなくなる。
    expect(failed.error.suggestedAction).toBeTruthy();
  });

  it("要件 5: 知らない形の鍵でも、値そのもので突き合わせて落とす", async () => {
    const { db } = fakeDb();
    const vault = vaultOf(db);
    // 接頭辞の無い鍵。塗り潰しの正規表現は当たらない。
    const odd = "0123456789abcdefghijklmnopqrstuv";
    await vault.store({
      workspaceId: WS,
      providerId: "openai",
      apiKey: odd,
      registeredBy: USER,
    });

    const failed = await vault.useKey({
      workspaceId: WS,
      providerId: "openai",
      fn: async (key) => {
        throw new Error(`auth failed for ${key}`);
      },
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(JSON.stringify(failed.error)).not.toContain(odd);
  });

  it("失効させると、包んだ値ごと消える", async () => {
    const { db, rows } = fakeDb();
    const vault = vaultOf(db);
    await vault.store({
      workspaceId: WS,
      providerId: "anthropic",
      apiKey: API_KEY,
      registeredBy: USER,
    });
    const revoked = await vault.revoke({
      workspaceId: WS,
      providerId: "anthropic",
      revokedBy: USER,
    });
    expect(revoked.ok).toBe(true);
    expect(rows.get("ws_a/anthropic")?.sealedKey).toBe("");
    // 末尾 4 文字は残す。「どの鍵を失効させたか」が後から要る。
    expect(rows.get("ws_a/anthropic")?.last4).toBe(API_KEY.slice(-4));
  });

  it("元締めの鍵を替えると開けられない（黙って古い値を使わない）", async () => {
    const sealed = await sealSecret(API_KEY, MASTER);
    await expect(openSecret(sealed, `${MASTER}-changed`)).rejects.toThrow();
  });
});
