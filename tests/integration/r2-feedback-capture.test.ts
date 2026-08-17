/** @tier 2 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import {
  CAPTURE_RETENTION_DAYS,
  type CaptureSubmission,
} from "@/domain/feedback";
import { asFeedbackCaptureId, asWorkspaceId } from "@/domain/shared";
import {
  type CaptureBucket,
  createR2FeedbackCaptureStore,
  feedbackCaptureHref,
  readFeedbackCapture,
  sweepExpiredCaptures,
} from "@/infrastructure/platform/feedback-capture-r2";

/**
 * 画面の写しを、**本物の R2** で置いて読み出す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * この置き場を仮置きから本物へ切り替えた理由は「入れる口（改善要望の
 * 送信フォーム）が既にあり、出す口（要望の詳細画面）もある」ことだった。
 * 両側があるということは、**間だけが間違っていても誰も気づけない**という
 * ことでもある。単体側は覚え書き（メモリ）で通るので、
 * 次の 4 つはつないでみるまで分からない:
 *
 *   1. 置き場所の組み立て方が、入れるときと出すときで揃っているか
 *   2. 別の作業場所の写しが、ID を知っていても出てこないか
 *   3. 保存期間を過ぎたものが、掃除の前でも出てこないか
 *   4. 掃除が、期限切れ**だけ**を消すか
 *
 * 2 と 3 は間違えても画面上は正常に見える。だから機械で見る。
 *
 * --- ここで見ないこと ---
 * 黒塗りが焼き込まれているかの判定そのものは domain 側
 * （`tests/domain/` の capture-policy）で見る。ここでは
 * **その判定が置き場でも効いているか**だけを 1 件だけ確かめる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）
 */

type TestEnv = { readonly BUCKET: R2Bucket };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let bucket: CaptureBucket;
let store: ReturnType<typeof createR2FeedbackCaptureStore>;

const WS = asWorkspaceId("ws_capture_test");
const OTHER_WS = asWorkspaceId("ws_other");
const NOW = new Date("2026-08-17T00:00:00.000Z");

/** 期限を過ぎたことにする時刻。置き場の日付は動かせないので、こちらを動かす。 */
const LATER = new Date(NOW.getTime() + (CAPTURE_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);

/** 塗り終わった 1 枚のつもりのバイト列。中身が png である必要はここでは無い。 */
function anImage(seed: number): ArrayBuffer {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (seed + i) % 256;
  return bytes.buffer;
}

function aSubmission(overrides: Partial<CaptureSubmission> = {}): CaptureSubmission {
  return {
    redactionsBurnedIn: true,
    retainsOriginal: false,
    redactionCount: 1,
    maskedElementCount: 2,
    byteLength: 64,
    mimeType: "image/png",
    ...overrides,
  };
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  bucket = proxy.env.BUCKET as unknown as CaptureBucket;
  store = createR2FeedbackCaptureStore(bucket);
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  for (const workspace of [WS, OTHER_WS]) {
    const page = await bucket.list({ prefix: `feedback-captures/${String(workspace)}/` });
    for (const object of page.objects) await bucket.delete(object.key);
  }
});

describe("画面の写しの置き場（本物の R2）", () => {
  it("置いたものが、同じ ID でそのまま出てくる", async () => {
    const id = asFeedbackCaptureId("cap_roundtrip");
    const image = anImage(7);

    const put = await store.put(WS, id, image, aSubmission());
    expect(put.ok, "保存に失敗しました").toBe(true);

    const read = await readFeedbackCapture(bucket, WS, id, NOW);
    expect(read, "置いたのに出てきませんでした").not.toBeNull();
    // **バイト列まで見る。** 「出てきた」だけを見ると、
    // 別の写しが出てきても緑になる。
    expect(new Uint8Array(read as ArrayBuffer)).toEqual(new Uint8Array(image));
  });

  it("画面に渡す住所には、置き場所も作業場所も出てこない", async () => {
    const href = feedbackCaptureHref(asFeedbackCaptureId("cap_href"));
    // 住所を書き換えて他所を指せる形になっていないこと。
    // 作業場所も、置き場での実際のファイル名も外に出さない。
    expect(href).not.toContain(String(WS));
    expect(href).not.toContain(".png");
    expect(href).toBe("/api/feedback-captures/cap_href");
  });

  it("別の作業場所からは、ID を知っていても出てこない", async () => {
    const id = asFeedbackCaptureId("cap_tenant");
    await store.put(WS, id, anImage(3), aSubmission());

    const stolen = await readFeedbackCapture(bucket, OTHER_WS, id, NOW);
    // ここが null にならないと、要望に添えた画面がそのまま他所へ出る。
    expect(stolen, "別の作業場所から読めてしまいました").toBeNull();
  });

  it("黒塗りが焼き込まれていない画像は、置き場まで届かない", async () => {
    const id = asFeedbackCaptureId("cap_unburned");
    const put = await store.put(WS, id, anImage(1), aSubmission({ redactionsBurnedIn: false }));
    expect(put.ok).toBe(false);

    // 「失敗を返したが、実は置いてあった」を潰す。
    const page = await bucket.list({ prefix: `feedback-captures/${String(WS)}/` });
    expect(page.objects.length, "拒否したのに置かれています").toBe(0);
  });

  it("保存期間を過ぎたものは、掃除の前でも出てこない", async () => {
    const id = asFeedbackCaptureId("cap_expired");
    await store.put(WS, id, anImage(5), aSubmission());

    expect(await readFeedbackCapture(bucket, WS, id, NOW)).not.toBeNull();
    // 掃除はまだ動かしていない。それでも渡さない。
    expect(await readFeedbackCapture(bucket, WS, id, LATER)).toBeNull();
  });

  it("掃除は、期限切れだけを消す", async () => {
    await store.put(WS, asFeedbackCaptureId("cap_a"), anImage(11), aSubmission());
    await store.put(WS, asFeedbackCaptureId("cap_b"), anImage(13), aSubmission());

    const notYet = await store.deleteExpired(WS, NOW);
    expect(notYet.ok && notYet.value.deleted, "期限前のものを消しました").toBe(0);
    expect(await readFeedbackCapture(bucket, WS, asFeedbackCaptureId("cap_a"), NOW)).not.toBeNull();

    const swept = await store.deleteExpired(WS, LATER);
    expect(swept.ok && swept.value.deleted).toBe(2);
    const left = await bucket.list({ prefix: `feedback-captures/${String(WS)}/` });
    expect(left.objects.length).toBe(0);
  });

  it("定期実行の掃除は、作業場所をまたいで期限切れだけを消す", async () => {
    await store.put(WS, asFeedbackCaptureId("cap_old_mine"), anImage(23), aSubmission());
    await store.put(OTHER_WS, asFeedbackCaptureId("cap_old_theirs"), anImage(29), aSubmission());

    // まだ期限前。ここで消えたら、送った直後の要望から写しが消えることになる。
    const early = await sweepExpiredCaptures(bucket, NOW);
    expect(early.deleted, "期限前のものを消しました").toBe(0);
    expect(early.finished).toBe(true);

    const swept = await sweepExpiredCaptures(bucket, LATER);
    // **作業場所を渡していないのに両方消える**ことを見る。
    // 定期実行には呼び出し元の身元が無いので、ここが片方しか消さないと、
    // 使っていない作業場所の写しだけが 180 日を過ぎても残り続ける。
    expect(swept.deleted).toBe(2);
    expect(swept.finished).toBe(true);

    for (const workspace of [WS, OTHER_WS]) {
      const left = await bucket.list({ prefix: `feedback-captures/${String(workspace)}/` });
      expect(left.objects.length, `${String(workspace)} に残っています`).toBe(0);
    }
  });

  it("掃除は、別の作業場所のものに手を出さない", async () => {
    await store.put(WS, asFeedbackCaptureId("cap_mine"), anImage(17), aSubmission());
    await store.put(OTHER_WS, asFeedbackCaptureId("cap_theirs"), anImage(19), aSubmission());

    const swept = await store.deleteExpired(WS, LATER);
    expect(swept.ok && swept.value.deleted).toBe(1);

    const theirs = await bucket.list({ prefix: `feedback-captures/${String(OTHER_WS)}/` });
    expect(theirs.objects.length, "他所の写しまで消しました").toBe(1);
  });
});
