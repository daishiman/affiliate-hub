/**
 * @tier 1
 * @req REQ-FB04, REQ-FB06, REQ-FB07, REQ-FB08
 * @types equivalence, tenant-isolation, boundary, idempotency
 *
 * 改善要望の見本保存先と、画面の写しの見本置き場。
 *
 * --- ここを検査する理由 ---
 *
 * この 2 つは「D1 / R2 が無いときの控え」だが、**控えのほうが本番経路である
 * 環境がある**。`pnpm dev` と自動テストには接続が供給されないので、
 * 画面が実際に読み書きしているのはここである。
 *
 * 控えが本物より甘いと、**手元では通った操作が、利用者の画面でだけ落ちる**。
 * しかも落ちるのは本番だけなので、直す人の手元では再現しない。
 *
 * 見るのは 4 つ:
 *
 * 1. 絞り込みが本当に絞っている（重ねた条件が素通しになっていない）。
 * 2. 他の作業場所のものが、読めも書けもしない。
 * 3. 技術診断の期限が、境目ちょうどで来る。何度消しても結果が変わらない。
 * 4. 写しは**焼き込み済みの 1 枚しか受け取らない**。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { decideDisposition } from "@/domain/feedback";
import { asFeedbackCaptureId, asWorkspaceId } from "@/domain/shared";
import {
  clearFeedbackStore,
  createSampleFeedbackCaptureStore,
  createSampleFeedbackRepository,
} from "@/infrastructure/persistence/sample/feedback-sample-repository";

const OWNER = asWorkspaceId("ws_sample");
const OUTSIDER = asWorkspaceId("ws_sample_feedback_outsider");

const DAY_MS = 24 * 60 * 60 * 1000;
/** 見本の 3 件のうち、いちばん古いものが届いた時刻。期限の起点はここ。 */
const OLDEST_AT = new Date("2026-08-12T01:00:00Z");

/** 焼き込み済みの申告。**ここを既定にすると、拒否側の検査が 1 か所を変えるだけで書ける。** */
const BURNED_IN = {
  redactionsBurnedIn: true,
  retainsOriginal: false,
  redactionCount: 1,
  maskedElementCount: 0,
  byteLength: 1024,
  mimeType: "image/png",
};

const image = (): ArrayBuffer => new ArrayBuffer(8);

beforeEach(() => {
  // 置き場はモジュールに 1 つ。前のテストが書いた要望が残ると、
  // 件数を数える検査が前のテストの結果を見てしまう。
  clearFeedbackStore();
});

describe("改善要望の読み書き", () => {
  it("他の作業場所の要望は保存できない", async () => {
    const repo = createSampleFeedbackRepository();
    const listed = await repo.list(OWNER, undefined);
    const target = listed.ok ? listed.value[0] : undefined;
    if (target === undefined) throw new Error("見本が空です");

    // 入れ物の持ち主と要望の持ち主が食い違ったら断る。
    // 通すと、自分の作業場所の権限で他社の一覧へ要望を差し込める。
    const saved = await repo.save(OUTSIDER, target);

    expect(saved.ok).toBe(false);
  });

  it("他の作業場所の要望は「無い」と答える", async () => {
    const repo = createSampleFeedbackRepository();

    const found = await repo.findById(OUTSIDER, "fb_sample_sort");

    // 断り方を変えると、返り方の違いから「その ID は在る」と分かってしまう。
    // 実在しない ID と同じ形で `null` を返す。
    expect(found.ok && found.value).toBeNull();
    const missing = await repo.findById(OWNER, "fb_unknown");
    expect(missing.ok && missing.value).toBeNull();
  });

  it("自分の作業場所のものは引ける", async () => {
    const repo = createSampleFeedbackRepository();

    const found = await repo.findById(OWNER, "fb_sample_sort");

    expect(found.ok && found.value?.origin.route).toBe("/admin/rankings");
  });
});

describe("一覧の絞り込み", () => {
  it("条件なしでは、廃棄していないものが全部出る", async () => {
    const repo = createSampleFeedbackRepository();

    const listed = await repo.list(OWNER, undefined);

    expect(listed.ok && listed.value).toHaveLength(3);
  });

  it("他の作業場所からは 1 件も見えない", async () => {
    const repo = createSampleFeedbackRepository();

    const listed = await repo.list(OUTSIDER, undefined);

    expect(listed.ok && listed.value).toStrictEqual([]);
    // 母集団が空でないことを同時に押さえる。見本を減らした日に、
    // この検査が「0 件だから通った」で緑のまま黙るのを防ぐ。
    const mine = await repo.list(OWNER, undefined);
    expect(mine.ok && mine.value.length).toBeGreaterThan(0);
  });

  it("種類で絞ると、その種類だけになる", async () => {
    const repo = createSampleFeedbackRepository();

    const listed = await repo.list(OWNER, { kinds: ["want_feature"] });

    expect(listed.ok && listed.value.map((r) => String(r.id))).toStrictEqual(["fb_sample_draft"]);
  });

  it("画面の経路で絞ると、その画面から届いたものだけになる", async () => {
    const repo = createSampleFeedbackRepository();

    const listed = await repo.list(OWNER, { route: "/admin/links/inbox" });

    expect(listed.ok && listed.value.map((r) => String(r.id))).toStrictEqual(["fb_sample_error"]);
  });

  it("状態で絞る。届いたばかりのものは「未対応」に入る", async () => {
    const repo = createSampleFeedbackRepository();

    const open = await repo.list(OWNER, { statuses: ["open"] });
    const resolved = await repo.list(OWNER, { statuses: ["resolved"] });

    expect(open.ok && open.value).toHaveLength(3);
    expect(resolved.ok && resolved.value).toStrictEqual([]);
  });

  it("払い出し済みかどうかで絞る", async () => {
    const repo = createSampleFeedbackRepository();

    const notYet = await repo.list(OWNER, { handedOff: false });
    const done = await repo.list(OWNER, { handedOff: true });

    expect(notYet.ok && notYet.value).toHaveLength(3);
    expect(done.ok && done.value).toStrictEqual([]);
  });

  it("条件を重ねると、両方に当たるものだけが残る", async () => {
    const repo = createSampleFeedbackRepository();

    // **片方でも素通しになっていれば、ここが 1 件以上になる。**
    // 条件を 1 つずつ当てるだけの検査では、この素通しは見つからない。
    const listed = await repo.list(OWNER, {
      kinds: ["want_feature"],
      route: "/admin/rankings",
    });

    expect(listed.ok && listed.value).toStrictEqual([]);
  });

  it("廃棄したものは既定では出ず、指定したときだけ出る", async () => {
    const repo = createSampleFeedbackRepository();
    const found = await repo.findById(OWNER, "fb_sample_draft");
    if (!found.ok || found.value === null) throw new Error("見本が引けません");
    const decided = decideDisposition({
      kind: "discarded",
      reason: "同じ内容の要望が別に届いているため。",
      decidedBy: "owner@local.test",
      at: new Date("2026-08-20T00:00:00Z"),
    });
    if (!decided.ok) throw new Error(decided.error.message);
    await repo.save(OWNER, { ...found.value, disposition: decided.value });

    const normal = await repo.list(OWNER, undefined);
    const withDiscarded = await repo.list(OWNER, { includeDiscarded: true });

    // 廃棄は「消す」ではない。既定の一覧から外れるだけで、探せば出る。
    expect(normal.ok && normal.value).toHaveLength(2);
    expect(withDiscarded.ok && withDiscarded.value).toHaveLength(3);
  });
});

describe("技術診断の期限", () => {
  it("90 日ちょうどで消える。1 日手前では消えない", async () => {
    const repo = createSampleFeedbackRepository();

    const justBefore = await repo.purgeExpiredDiagnostics(
      OWNER,
      new Date(OLDEST_AT.getTime() + 89 * DAY_MS),
    );
    expect(justBefore.ok && justBefore.value.purged).toBe(0);

    const exactly = await repo.purgeExpiredDiagnostics(
      OWNER,
      new Date(OLDEST_AT.getTime() + 90 * DAY_MS),
    );
    // 境目は「ちょうどで来ている」側。ここが `>` だと、説明と実物が 1 日ずれる。
    expect(exactly.ok && exactly.value.purged).toBe(1);
  });

  it("何度消しても、2 度目は 0 件になる", async () => {
    const repo = createSampleFeedbackRepository();
    const at = new Date(OLDEST_AT.getTime() + 200 * DAY_MS);

    const first = await repo.purgeExpiredDiagnostics(OWNER, at);
    const second = await repo.purgeExpiredDiagnostics(OWNER, at);

    // 定期実行は失敗すれば再び走る。2 度目で消した時刻が上書きされると、
    // 「いつ消したか」が走らせるたびに新しくなる。
    expect(first.ok && first.value.purged).toBe(3);
    expect(second.ok && second.value.purged).toBe(0);
    expect(second.ok && second.value.finished).toBe(true);
  });

  it("他の作業場所の要望には触らない", async () => {
    const repo = createSampleFeedbackRepository();
    const at = new Date(OLDEST_AT.getTime() + 200 * DAY_MS);

    const outsider = await repo.purgeExpiredDiagnostics(OUTSIDER, at);
    expect(outsider.ok && outsider.value.purged).toBe(0);

    // 触っていないので、持ち主が走らせれば 3 件とも残っている。
    const owner = await repo.purgeExpiredDiagnostics(OWNER, at);
    expect(owner.ok && owner.value.purged).toBe(3);
  });
});

describe("画面の写しの置き場", () => {
  it("焼き込み済みの 1 枚は受け取る", async () => {
    const store = createSampleFeedbackCaptureStore();

    const put = await store.put(OWNER, asFeedbackCaptureId("cap_1"), image(), BURNED_IN);

    expect(put.ok && put.value.key).toBe("ws_sample/cap_1.png");
  });

  it("黒塗りを焼き込んでいないもの、元画像が残っているものは受け取らない", async () => {
    const store = createSampleFeedbackCaptureStore();

    const notBurned = await store.put(OWNER, asFeedbackCaptureId("cap_2"), image(), {
      ...BURNED_IN,
      redactionsBurnedIn: false,
    });
    const keepsOriginal = await store.put(OWNER, asFeedbackCaptureId("cap_3"), image(), {
      ...BURNED_IN,
      retainsOriginal: true,
    });

    // 上に重ねただけ・元画像つきを通すと、黒塗りが隠したことにならない。
    // **「あとで消す」ではなく「入れない」。**
    expect(notBurned.ok).toBe(false);
    expect(keepsOriginal.ok).toBe(false);
  });

  it("期限つき URL は、まだ発行できないと答える", async () => {
    const store = createSampleFeedbackCaptureStore();

    const url = await store.signedUrl(OWNER, asFeedbackCaptureId("cap_1"), 300);

    // それらしい URL を返すと、画面には出るのに開けない状態になり、
    // 「保存できていない」のか「表示できない」のかが分からなくなる。
    expect(url.ok).toBe(false);
  });

  it("180 日ちょうどで消える。他の作業場所のものは数に入らない", async () => {
    const store = createSampleFeedbackCaptureStore();
    // 写しの置き場だけは中身を空にする口が無いので、**この検査だけの作業場所**を使う。
    // 上の `put` が残した 1 枚を数に入れてしまうと、件数の主張が
    // 「他社のぶんを数えていない」ではなく「前の検査の残りを数えた」になる。
    //
    // 名前は**わざと前方一致する 2 つ**にしてある。区切りの `/` を忘れて
    // `startsWith(作業場所)` と書くと、他社のぶんまで消える。
    const mine = asWorkspaceId("ws_capture");
    const theirs = asWorkspaceId("ws_capture_extra");
    await store.put(mine, asFeedbackCaptureId("cap_mine"), image(), BURNED_IN);
    await store.put(theirs, asFeedbackCaptureId("cap_theirs"), image(), BURNED_IN);
    const storedAt = new Date();

    const justBefore = await store.deleteExpired(mine, new Date(storedAt.getTime() + 179 * DAY_MS));
    expect(justBefore.ok && justBefore.value.deleted).toBe(0);

    const exactly = await store.deleteExpired(mine, new Date(storedAt.getTime() + 180 * DAY_MS));
    // 自分のぶんだけ。他社のものまで数えると、消した件数の報告が
    // 「他社のデータに触れた」ことを隠したまま増える。
    expect(exactly.ok && exactly.value.deleted).toBe(1);
  });
});
