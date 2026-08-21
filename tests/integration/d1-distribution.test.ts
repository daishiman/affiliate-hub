/**
 * @tier 2
 * @req REQ-P08
 * @types idempotency, db-migration
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import {
  createCancelPublicationUseCase,
  createListPublicationsUseCase,
  createSchedulePublicationUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import type { ManageDistributionDeps } from "@/application/usecases/distribution/manage-distribution";
import {
  createGetPublicationCalendarUseCase,
  createReschedulePublicationUseCase,
} from "@/application/usecases/distribution/publication-calendar";
import type { PublicationCalendarDeps } from "@/application/usecases/distribution/publication-calendar";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner } from "../support/actors";

/**
 * 配信の予約を、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * 配信は、これまで**この場限り**（処理が終われば消える）だった。
 * 予約したのに次に開くと消えている、というのは画面を見ても分からない
 * ——「まだ出していないのか」「消えたのか」の区別が付かないため。
 * だから保存先をつないだ。つないだこと自体は、次の 3 つが揃って初めて言える:
 *
 *   1. マイグレーション 0008 が publications / channel_connections を実際に作る
 *   2. 組み立てた SQL がその表に対して通る（列の綴り・型が合っている）
 *   3. **保存したものが読み直せる**（返り値ではなく、読み直しで確かめる）
 *
 * --- ここでいちばん見たいこと ---
 * **冪等キーに一意制約を付けていないこと。** 付けると、同じ予約の 2 回目が
 * 「やり直しても永久に通らない失敗」になる。ユースケース側は 2 回目を
 * 「すでにあります」という成功として返す設計なので、保存先が例外を投げると
 * その設計が崩れる。同じ形の壊れを `link_ingestions` で実測している。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: ManageDistributionDeps;
let calendarDeps: PublicationCalendarDeps;

/** 見本の記事と同じ作業場所にいて、配信の権限を持つ人。 */
const publisher: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/** 承認済みの見本記事。承認前の記事は配信できない（別途 単体で見ている）。 */
const APPROVED_VARIANT = "cv_alpha_approved";

/** 未来の時刻。過ぎた時刻は予約できない仕様なので、実行時から先へ取る。 */
function future(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
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
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  const all = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
  deps = {
    connections: all.channelConnections,
    publications: all.publications,
    manualExport: all.manualExport,
    variants: all.contentVariants,
    ids: all.ids,
    auditLog: all.auditLog,
  };
  calendarDeps = {
    publications: all.publications,
    connections: all.channelConnections,
    contentVariants: all.contentVariants,
    contentPackages: all.contentPackages,
    events: all.events,
    auditLog: all.auditLog,
    ids: all.ids,
  };
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM publications").run();
  await proxy.env.DB.prepare("DELETE FROM channel_connections").run();
});

const schedule = () => createSchedulePublicationUseCase(deps);
const list = () => createListPublicationsUseCase(deps);
const cancel = () => createCancelPublicationUseCase(deps);
const calendar = () => createGetPublicationCalendarUseCase(calendarDeps);
const reschedule = () => createReschedulePublicationUseCase(calendarDeps);

describe("マイグレーションそのもの", () => {
  it("配信と出し先の表を実際に作る", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    const names = tables.results.map((r) => r.name);
    expect(names).toContain("publications");
    expect(names).toContain("channel_connections");
  });

  it("同じ予約が 2 回来ても止まらないよう、冪等キーを一意にしていない", async () => {
    const indexes = await proxy.env.DB.prepare("pragma index_list(publications)").all<{
      name: string;
      unique: number;
    }>();
    const byKey = indexes.results.find(
      (r) => r.name === "publications_workspace_idempotency_idx",
    );
    expect(byKey, "冪等キーの索引がありません").toBeDefined();
    // **一意にしないこと。** 一意だと、二重クリックや AI の再試行の 2 回目が
    // 保存先の例外になり、「すでにあります」という成功で返せなくなる。
    expect(byKey?.unique).toBe(0);
  });
});

describe("予約が保存される（読み直して確かめる）", () => {
  it("予約したものが、次に読み直したときも残っている", async () => {
    const at = future(3);
    const made = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: at,
    });
    expect(made.ok, made.ok ? "" : made.error.message).toBe(true);
    if (!made.ok) return;
    expect(made.value.alreadyExisted).toBe(false);
    const id = made.value.card.publicationId;

    // 返り値ではなく**保存先から読み直す**。返り値だけを見ると、
    // 保存が落ちていても「作れた」と読めてしまう。
    const rows = await proxy.env.DB.prepare(
      "select id, state from publications where id = ?",
    )
      .bind(id)
      .all<{ id: string; state: string }>();
    expect(rows.results).toHaveLength(1);

    const listed = await list().execute(publisher, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items.some((c) => c.publicationId === id)).toBe(true);
  });

  it("同じ予約をもう一度出しても、2 件にならず「すでにあります」で返る", async () => {
    const at = future(4);
    const first = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: at,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: at,
    });
    // **失敗にしない。** ここが失敗になると、二重クリックした人に
    // 「エラーだからもう一度」と読ませ、余計に押させることになる。
    expect(second.ok, second.ok ? "" : second.error.message).toBe(true);
    if (!second.ok) return;
    expect(second.value.alreadyExisted).toBe(true);
    expect(second.value.card.publicationId).toBe(first.value.card.publicationId);

    const rows = await proxy.env.DB.prepare("select count(*) as n from publications").all<{
      n: number;
    }>();
    expect(rows.results[0]?.n).toBe(1);
  });

  it("取りやめが保存され、読み直しても取りやめのまま（見本に戻らない）", async () => {
    const made = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: future(5),
    });
    expect(made.ok).toBe(true);
    if (!made.ok) return;

    const stopped = await cancel().execute(publisher, { publicationId: made.value.card.publicationId });
    expect(stopped.ok, stopped.ok ? "" : stopped.error.message).toBe(true);

    const rows = await proxy.env.DB.prepare("select state from publications where id = ?")
      .bind(made.value.card.publicationId)
      .all<{ state: string }>();
    expect(rows.results[0]?.state).toBe("CANCELLED");

    // 状態が進んでも行が増えない（上書きであって、追記ではない）。
    const count = await proxy.env.DB.prepare("select count(*) as n from publications").all<{
      n: number;
    }>();
    expect(count.results[0]?.n).toBe(1);
  });

  it("予定日の変更が保存先に届く", async () => {
    const made = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: future(6),
    });
    expect(made.ok).toBe(true);
    if (!made.ok) return;

    // 画面の日時欄が渡してくる形（`YYYY-MM-DDTHH:mm`、地域時刻・時差表記なし）。
    const localInput = "2027-03-05T09:30";
    const changed = await reschedule().execute(publisher, {
      publicationId: made.value.card.publicationId,
      scheduledAt: localInput,
    });
    expect(changed.ok, changed.ok ? "" : changed.error.message).toBe(true);

    const rows = await proxy.env.DB.prepare(
      "select scheduled_at from publications where id = ?",
    )
      .bind(made.value.card.publicationId)
      .all<{ scheduled_at: number }>();
    expect(rows.results).toHaveLength(1);
    // 保存先の日時は**秒**で入っている（`mode: "timestamp"`）。
    // 取り違えると 1970 年の日付になるが、読むときも drizzle が同じ換算を
    // するので画面からは気づけない。だから生の値で確かめる。
    //
    // 比べる相手は、時差表記の無い入力を**その端末の地域時刻として読んだ結果**。
    // 画面の日時欄が地域時刻を渡してくるので、これが正しい読み方であり、
    // ここを UTC として読むと、予約が数時間ずれたまま誰も気づかない。
    expect(Number(rows.results[0]?.scheduled_at) * 1000).toBe(new Date(localInput).getTime());
  });
});

describe("見本との重ね置き", () => {
  it("まだ 1 件も予約していなくても、一覧とカレンダーが空にならない", async () => {
    const listed = await list().execute(publisher, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 空だと「まだ出していない」のか「壊れている」のかを見分けられない。
    expect(listed.value.items.length).toBeGreaterThan(0);

    const view = await calendar().execute(publisher, { month: "2026-08" });
    expect(view.ok).toBe(true);
  });

  it("保存したものが見本より優先される（同じ id を書き戻しても元へ戻らない）", async () => {
    const listed = await list().execute(publisher, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const sample = listed.value.items.find((c) => c.state !== "PUBLISHED" && c.state !== "CANCELLED");
    expect(sample, "取りやめられる見本が 1 件もありません").toBeDefined();
    if (sample === undefined) return;

    const stopped = await cancel().execute(publisher, { publicationId: sample.publicationId });
    expect(stopped.ok, stopped.ok ? "" : stopped.error.message).toBe(true);

    const again = await list().execute(publisher, {});
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // ここが元の状態に戻ると、「取りやめたはずのものが復活する」という
    // いちばん気づきにくい壊れになる。
    expect(again.value.items.find((c) => c.publicationId === sample.publicationId)?.state).toBe("CANCELLED");
    // 重ねた結果、同じ id が 2 件並ばないこと。
    expect(again.value.items.filter((c) => c.publicationId === sample.publicationId)).toHaveLength(1);
  });
});
