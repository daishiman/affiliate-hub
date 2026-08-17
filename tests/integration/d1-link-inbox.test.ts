/** @tier 2 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import {
  createListLinkInboxUseCase,
  createMatchLinkIngestionUseCase,
  createRejectLinkIngestionUseCase,
  createResolveLinkIngestionUseCase,
  createSubmitAffiliateUrlUseCase,
} from "@/application/usecases/monetization/manage-link-inbox";
import type { ManageLinkInboxDeps } from "@/application/usecases/monetization/manage-link-inbox";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner, anOutsider } from "../support/actors";

/**
 * 成果リンク受信箱を、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * `tests/infrastructure/d1-link-inbox.test.ts` は偽の接続を使っており、
 * そこには「SQL が正しいかはここでは分からない」と明記してある。
 * 分からないままにしておくと、次の 3 つは**公開してから初めて分かる**:
 *
 *   1. マイグレーションが、その表を本当に作れるか
 *   2. 組み立てた SQL が、その表に対して本当に通るか
 *   3. 表に付けた制約（一意・索引）と、アプリ側の判断が食い違っていないか
 *
 * ここでは wrangler の `getPlatformProxy` で **workerd 上の実際の D1** を立て、
 * `drizzle/*.sql` をそのまま流し込む。手で書いた CREATE TABLE は使わない。
 * 手で書くと、マイグレーションが壊れていてもテストだけが通る。
 *
 * --- ここで見ないこと ---
 * 細かい入力検証や権限の網羅は単体側（`tests/application/link-inbox.test.ts`）で見る。
 * ここは**1 本の道が端から端まで通ること**だけを見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

/**
 * この試験が使う結び付きは D1 だけ。
 * `CloudflareEnv` 全体を要求すると、関係の無い結び付きを 1 つ足しただけで
 * ここが落ちる。**使うものだけを書く。**
 */
type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: ManageLinkInboxDeps;

/** 見本の提携プログラムと同じ作業場所にいる、権限を持った人。 */
const owner: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/** マイグレーションの本文を、実行できる単位に割る。 */
function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // 1 件も読めていないのに緑になるのが最悪なので、そこだけ先に落とす。
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    // 手元のファイルに残すと、前回の実行結果が次の実行に混ざる。
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  // 分解して組み直すと、商業データの印が落ちる（印は入れ物ごと持ち回る）。
  // 印が落ちた状態で組み立てると、ユースケースは作られた時点で例外になる。
  const all = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
  deps = {
    inbox: all.linkInbox,
    programs: all.affiliatePrograms,
    ids: all.ids,
    events: all.events,
  };
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM link_ingestions").run();
});

const submit = () => createSubmitAffiliateUrlUseCase(deps);
const list = () => createListLinkInboxUseCase(deps);
const resolve = () => createResolveLinkIngestionUseCase(deps);
const match = () => createMatchLinkIngestionUseCase(deps);
const reject = () => createRejectLinkIngestionUseCase(deps);

describe("マイグレーションそのもの", () => {
  it("受信箱の表と、重複相手を引くための索引を実際に作る", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    expect(tables.results.map((r) => r.name)).toContain("link_ingestions");

    const indexes = await proxy.env.DB.prepare(
      "pragma index_list(link_ingestions)",
    ).all<{ name: string; unique: number }>();
    const byUrl = indexes.results.find(
      (r) => r.name === "link_ingestions_workspace_normalized_url_idx",
    );
    expect(byUrl).toBeDefined();
    // **一意にしないこと。** 一意だと、2 回目の貼り付けが
    // 「やり直しても永久に通らない失敗」になる（下の「重複」の項がその実測）。
    expect(byUrl?.unique).toBe(0);
  });

  it("認証まわりの表もそろっている（ログインを入れる前提が崩れていない）", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    const names = tables.results.map((r) => r.name);
    expect(names).toContain("sessions");
    expect(names).toContain("products");
  });
});

describe("貼り付けから商品に結びつくまで（1 本の道）", () => {
  it("貼り付け → 広告主を決める → 商品に結びつける、が最後まで通る", async () => {
    const submitted = await submit().execute(owner, {
      url: "https://af.example.com/click?a=1&utm_source=mail",
      source: "paste",
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value.duplicate).toBe(false);
    const id = submitted.value.item.id;

    // 保存されたかどうかは、返り値ではなく**読み直して**確かめる。
    // 返り値だけを見ると、保存が失敗していても気づけない。
    const afterSubmit = await list().execute(owner, {});
    expect(afterSubmit.ok).toBe(true);
    if (!afterSubmit.ok) return;
    expect(afterSubmit.value.total).toBe(1);
    expect(afterSubmit.value.countsByState.received).toBe(1);

    const resolved = await resolve().execute(owner, {
      linkIngestionId: id,
      programId: "prg_amazon_pc",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.state).toBe("resolved");
    expect(resolved.value.programLabel).toContain("Amazon");

    const matched = await match().execute(owner, {
      linkIngestionId: id,
      productId: "prd_sample_1",
    });
    expect(matched.ok).toBe(true);
    if (!matched.ok) return;
    expect(matched.value.state).toBe("matched");

    const afterMatch = await list().execute(owner, {});
    expect(afterMatch.ok).toBe(true);
    if (!afterMatch.ok) return;
    expect(afterMatch.value.countsByState.matched).toBe(1);
    expect(afterMatch.value.countsByState.received).toBe(0);
    // 状態が進んでも行が増えない（上書きであって、追記ではない）。
    expect(afterMatch.value.total).toBe(1);
  });

  it("貼り付けたままの URL は、保存を往復しても書き換わらない", async () => {
    const raw = "https://af.example.com/click?b=2&a=1&utm_source=mail#frag";
    const submitted = await submit().execute(owner, { url: raw, source: "paste" });
    expect(submitted.ok).toBe(true);

    const listed = await list().execute(owner, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // ASP の規約上、渡された URL を勝手に整形して使うと違反になりうる。
    expect(listed.value.items[0]?.submittedUrl).toBe(raw);
  });

  it("対象外にすると、理由が保存先に残る", async () => {
    const submitted = await submit().execute(owner, {
      url: "https://af.example.com/click?c=3",
      source: "paste",
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const rejected = await reject().execute(owner, {
      linkIngestionId: submitted.value.item.id,
      reason: "提携が終了した広告主のため",
    });
    expect(rejected.ok).toBe(true);

    const listed = await list().execute(owner, { state: "rejected" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items[0]?.rejectedReason).toBe("提携が終了した広告主のため");
  });
});

describe("重複", () => {
  it("計測用の付加情報だけが違う同じリンクは、重複として受け取る（消さない）", async () => {
    const first = await submit().execute(owner, {
      url: "https://af.example.com/click?a=1",
      source: "paste",
    });
    expect(first.ok).toBe(true);

    const second = await submit().execute(owner, {
      url: "https://af.example.com/click?a=1&utm_campaign=summer",
      source: "paste",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.duplicate).toBe(true);
    expect(second.value.message).toContain("消していません");

    // **2 件とも残っていること。** 重複を理由に捨てると、
    // 「貼ったのに無い」が起き、原因を探すのに最も時間がかかる形になる。
    const listed = await list().execute(owner, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.total).toBe(2);
    expect(listed.value.duplicateCount).toBe(1);
  });
});

describe("別の作業場所との切り分け", () => {
  it("同じ保存先を使っていても、他の作業場所の受信箱は見えない", async () => {
    await submit().execute(owner, {
      url: "https://af.example.com/click?mine=1",
      source: "paste",
    });

    const outsider = anOutsider();
    const listed = await list().execute(outsider, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 権限のある人が、別の作業場所から見ても 0 件であること。
    expect(listed.value.total).toBe(0);
  });

  it("同じ URL でも、作業場所が違えば別々に受け取れる", async () => {
    const mine = await submit().execute(owner, {
      url: "https://af.example.com/click?shared=1",
      source: "paste",
    });
    expect(mine.ok).toBe(true);

    const theirs = await submit().execute(anOutsider(), {
      url: "https://af.example.com/click?shared=1",
      source: "paste",
    });
    expect(theirs.ok).toBe(true);
    if (!theirs.ok) return;
    // 一意索引は作業場所ごとに効く。ここが全体で 1 本だと、
    // 先に貼った他社のせいで自分が貼れなくなる。
    expect(theirs.value.duplicate).toBe(false);
  });
});
