/**
 * @tier 1
 * @req REQ-TM02, REQ-TM03, REQ-TM08
 * @types decision-table, equivalence, boundary
 *
 * 同意の決め方は、材料 5 つの**順番が決まっている**表として見る
 * （巡回/プレビュー → GPC/DNT → 本人の許可 → 未回答）。
 * 一覧の中身（イベント 12 件・禁止語 17 語）を全行に当てるのは
 * `telemetry-tables.test.ts` のほう。
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSENT_SIGNALS,
  MODEL_PRICES,
  RETENTION_DAYS,
  TELEMETRY_EVENTS,
  TELEMETRY_EVENT_KEYS,
  type ConsentSignals,
  type TelemetryEvent,
  buildTelemetryEvent,
  decideConsent,
  estimateCostJpy,
  isRetentionExpired,
  listTelemetryEvents,
  mayRecord,
  readerKeyScope,
  requiresConsent,
  retentionDeadline,
  rollupAiUsage,
  totalAiCost,
} from "@/domain/analytics";

/**
 * 計測まわりの決めごとを機械で固定する検査。
 *
 * ここで守りたいのは数字の正しさより **約束の方**。
 *   - 黙っている人を同意した扱いにしない
 *   - 記録しないと言った項目を、あとから静かに入れない
 *   - 期限を決めずに貯めない
 * どれも「破っても画面は普通に動く」ため、人の目視では気づけない。
 */

const signals = (over: Partial<ConsentSignals> = {}): ConsentSignals => ({
  ...DEFAULT_CONSENT_SIGNALS,
  ...over,
});

describe("計測イベントの一覧", () => {
  it("すべてのイベントに「何のために測るか」が書いてある", () => {
    // why が書けないものは計測しない。書けないまま足すと、
    // 何年も使われないまま個人の行動だけが貯まる。
    for (const e of listTelemetryEvents()) {
      expect(e.why.length, `${e.key} の why が空です`).toBeGreaterThan(5);
      expect(e.label.length, `${e.key} の label が空です`).toBeGreaterThan(0);
      expect(e.fieldNames.length, `${e.key} に項目がありません`).toBeGreaterThan(0);
    }
  });

  it("イベントの表そのものに、記録してはいけない項目名が入っていない", () => {
    // 送信時の検査 (buildTelemetryEvent) より前に、宣言の段階で落とす。
    // 表に書けてしまうと「仕様上は取ってよい」と読めてしまう。
    const forbidden = ["ip", "ipAddress", "latitude", "longitude", "email", "prompt", "content"];
    for (const key of TELEMETRY_EVENT_KEYS) {
      const names = Object.keys(TELEMETRY_EVENTS[key].fields).map((n) => n.toLowerCase());
      for (const f of forbidden) {
        expect(names, `${key} に ${f} が宣言されています`).not.toContain(f.toLowerCase());
      }
    }
  });

  it("AI の記録は参照 ID だけを持ち、文章そのものを持たない", () => {
    const names = Object.keys(TELEMETRY_EVENTS.ai_model_usage.fields);
    expect(names).toContain("artifactId");
    expect(names).toContain("artifactKind");
    expect(names.some((n) => /prompt(text)?$|completion|generated/i.test(n))).toBe(false);
    // テンプレートは ID と版だけ。本文は別の場所にある。
    expect(names).toContain("promptTemplateId");
    expect(names).toContain("promptTemplateVersion");
  });

  it("同意なしで測るイベントは、読者を追いかける類のものではない", () => {
    const noConsent = listTelemetryEvents().filter((e) => e.consent === "none");
    // 回数として数えるものだけ。読み方の細かい記録が混ざっていないこと。
    for (const e of noConsent) {
      expect(
        ["page_view", "affiliate_click", "ai_model_usage", "variant_exposure"],
        `${e.key} を同意なしで測る設定になっています`,
      ).toContain(e.key);
    }
  });
});

describe("イベントの組み立て", () => {
  const at = new Date("2026-08-17T00:00:00.000Z");

  it("表にない名前は送れない", () => {
    const r = buildTelemetryEvent({
      key: "cta_click" as never,
      occurredAt: at,
      readerKey: null,
      payload: {},
    });
    expect(r.ok).toBe(false);
  });

  it("必須の項目が欠けていると落ちる", () => {
    const r = buildTelemetryEvent({
      key: "page_view",
      occurredAt: at,
      readerKey: null,
      payload: { path: "/a", siteSlug: "demo" }, // referrerKind が無い
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("referrerKind");
  });

  it("型が違うと落ちる（数字の欄に文字を入れられない）", () => {
    const r = buildTelemetryEvent({
      key: "scroll_depth",
      occurredAt: at,
      readerKey: null,
      payload: { path: "/a", siteSlug: "demo", percent: "50" },
    });
    expect(r.ok).toBe(false);
  });

  it("省略できる欄は無くてもよい", () => {
    const r = buildTelemetryEvent({
      key: "page_view",
      occurredAt: at,
      readerKey: null,
      payload: { path: "/a", siteSlug: "demo", referrerKind: "search" },
    });
    expect(r.ok).toBe(true);
  });

  it("クリックは、どちらの経路で数えたかが無いと落ちる", () => {
    // **名指しで固定する。** これは「必須の項目が欠けていると落ちる」の
    // 一例だが、`recordedVia` が欠けたときに起きることだけが他と違う。
    // 欠けたクリックが通ると、転送の入口と画面のどちらが数えたか分からない
    // 行が混ざり、**二重計上が起きても数字から判定できなくなる**。
    // 汎用の検査だけに任せると、この欄を任意に緩めたときに誰も気づかない。
    const base = { path: "/best/x", siteSlug: "demo", linkId: "lk_1", placement: "順位表" };
    const missing = buildTelemetryEvent({
      key: "affiliate_click",
      occurredAt: at,
      readerKey: null,
      payload: base,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.message).toContain("recordedVia");

    for (const via of ["redirect", "browser"]) {
      const r = buildTelemetryEvent({
        key: "affiliate_click",
        occurredAt: at,
        readerKey: null,
        payload: { ...base, recordedVia: via },
      });
      expect(r.ok, `${via} が通りませんでした`).toBe(true);
    }
  });

  it("記録してはいけない項目が混ざっていたら、そのイベントごと落とす", () => {
    // 「その欄だけ捨てて残りは記録する」にしない。
    // 落とし忘れが 1 つでもあると、静かに入り続ける。
    for (const bad of [{ ip: "203.0.113.1" }, { email: "a@example.com" }, { prompt: "…" }]) {
      const r = buildTelemetryEvent({
        key: "page_view",
        occurredAt: at,
        readerKey: null,
        payload: { path: "/a", siteSlug: "demo", referrerKind: "direct", ...bad },
      });
      expect(r.ok, `${Object.keys(bad)[0]} が通ってしまいました`).toBe(false);
    }
  });
});

describe("同意の決め方", () => {
  it("黙っている人を同意した扱いにしない", () => {
    const d = decideConsent(signals({ choice: "unset" }));
    expect(d.allowBehaviour).toBe(false);
    expect(d.allowReaderKey).toBe(false);
  });

  it("断った人は詳しい計測をしない", () => {
    expect(decideConsent(signals({ choice: "denied" })).allowBehaviour).toBe(false);
  });

  it("ブラウザの追跡拒否は、本人の許可より強い", () => {
    // 「許可を押したのだから」と上書きしない。
    // 表示だけして無視するなら、最初から読まない方が誠実。
    for (const over of [{ doNotTrack: true }, { globalPrivacyControl: true }]) {
      const d = decideConsent(signals({ choice: "granted", ...over }));
      expect(d.allowBehaviour).toBe(false);
      expect(d.suppressAll).toBe(false); // 回数だけは数える
    }
  });

  it("自動巡回とプレビューは一切記録しない", () => {
    for (const over of [{ isBot: true }, { isPreview: true }]) {
      const d = decideConsent(signals({ choice: "granted", ...over }));
      expect(d.suppressAll).toBe(true);
    }
  });

  it("許可があるときだけ詳しい計測をする", () => {
    const d = decideConsent(signals({ choice: "granted" }));
    expect(d.allowBehaviour).toBe(true);
    expect(d.allowReaderKey).toBe(true);
  });

  it("どの決まり方にも理由が付く", () => {
    // 管理画面と読者向けの説明ページにそのまま出す文。
    for (const s of [
      signals(),
      signals({ choice: "granted" }),
      signals({ choice: "denied" }),
      signals({ doNotTrack: true }),
      signals({ isBot: true }),
    ]) {
      expect(decideConsent(s).reason.length).toBeGreaterThan(5);
    }
  });
});

describe("記録してよいかの判断", () => {
  it("同意が無くても、回数だけのイベントは記録できる（断っても壊れない）", () => {
    const d = decideConsent(signals({ choice: "denied" }));
    expect(mayRecord("page_view", d)).toBe(true);
    expect(mayRecord("affiliate_click", d)).toBe(true);
    expect(mayRecord("scroll_depth", d)).toBe(false);
    expect(mayRecord("section_dwell", d)).toBe(false);
  });

  it("一切記録しない相手には、回数だけのイベントも記録しない", () => {
    const d = decideConsent(signals({ isBot: true }));
    for (const key of TELEMETRY_EVENT_KEYS) {
      expect(mayRecord(key, d), `${key} が巡回相手に記録されます`).toBe(false);
    }
  });

  it("同意が要るイベントの判定が 1 箇所に揃っている", () => {
    const granted = decideConsent(signals({ choice: "granted" }));
    const unset = decideConsent(signals());
    for (const key of TELEMETRY_EVENT_KEYS) {
      expect(mayRecord(key, granted)).toBe(true);
      expect(mayRecord(key, unset)).toBe(!requiresConsent(key));
    }
  });
});

describe("保存する期間", () => {
  it("無期限がない", () => {
    for (const [k, days] of Object.entries(RETENTION_DAYS)) {
      expect(Number.isFinite(days), `${k} の保存期間が無期限です`).toBe(true);
      expect(days).toBeGreaterThan(0);
    }
  });

  it("詳しい記録の方が短く消える", () => {
    expect(RETENTION_DAYS.behaviour).toBeLessThan(RETENTION_DAYS.none);
  });

  it("期限を過ぎたものは期限切れと判定される", () => {
    const at = new Date("2026-01-01T00:00:00.000Z");
    const deadline = retentionDeadline("scroll_depth", at);
    expect(isRetentionExpired("scroll_depth", at, new Date(deadline.getTime() - 1000))).toBe(false);
    expect(isRetentionExpired("scroll_depth", at, deadline)).toBe(true);
  });
});

describe("読者の仮の目印", () => {
  it("日をまたぐと別のものになる（消せない目印を配らない）", () => {
    const a = readerKeyScope("demo", new Date("2026-08-17T23:59:00.000Z"));
    const b = readerKeyScope("demo", new Date("2026-08-18T00:01:00.000Z"));
    expect(a).not.toBe(b);
  });

  it("ブログをまたいで同じ人として繋がらない", () => {
    const at = new Date("2026-08-17T10:00:00.000Z");
    expect(readerKeyScope("blog-a", at)).not.toBe(readerKeyScope("blog-b", at));
  });
});

describe("AI 利用の記録に、何が入っているか", () => {
  /**
   * `ai_model_usage` の全項目。**手で書き写した。**
   *
   * 実装から作ると、項目を 1 つ落としたときに期待値も一緒に落ちて緑になる。
   *
   * `telemetry-tables.test.ts` は必須項目を 1 つずつ落として赤にしているが、
   * それは**必須かどうか**を見ているだけで、**一覧がそろっているか**は
   * 誰も見ていなかった（省略できる欄は落としても誰も気づかない）。
   *
   * 追跡表は 2026-08-19 まで「17 項目」と書いていた。**数えると 16 である。**
   * 数だけ書いて誰も数えていなかったので、同日、追跡表の側を実測に合わせた。
   */
  const EXPECTED_AI_FIELDS = [
    "workspaceId",
    "brandId",
    "siteSlug",
    "actorId",
    "modelId",
    "provider",
    "usecase",
    "promptTemplateId",
    "promptTemplateVersion",
    "inputTokens",
    "outputTokens",
    "durationMs",
    "success",
    "estimatedCostJpy",
    "artifactKind",
    "artifactId",
  ];

  const actualFields = (): readonly string[] =>
    Object.keys(TELEMETRY_EVENTS.ai_model_usage.fields);

  it("要件が並べた項目が、1 つ残らず入っている", () => {
    for (const name of EXPECTED_AI_FIELDS) {
      expect(actualFields(), `${name} が記録の項目から消えています`).toContain(name);
    }
  });

  it("項目を静かに増やせない（増やすときはここも直す）", () => {
    // 増やすこと自体は禁じない。**気づかずに増える**ことを止める。
    // 文章そのものを入れる欄が紛れ込むのが最も怖い経路である。
    expect([...actualFields()].sort()).toEqual([...EXPECTED_AI_FIELDS].sort());
  });
});

describe("AI の費用", () => {
  /** 価格表の全モデル。**手で書き写した。**表を回して数えると、1 件消えても緑になる。 */
  const EXPECTED_PRICED_MODELS = [
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-haiku-4-5",
    "workers-ai-llama",
  ];

  it("価格表から静かに 1 件消えない", () => {
    // 消えると、そのモデルの費用が 0 ではなく「分からない」に落ちる。
    // 画面には出るが、**合計が小さくなるだけ**なので目視では気づけない。
    expect(MODEL_PRICES.map((p) => p.modelId)).toEqual(EXPECTED_PRICED_MODELS);
  });

  it("価格表のすべてに「いつ確認したか」が書いてある", () => {
    for (const p of MODEL_PRICES) {
      expect(p.pricedAt, `${p.modelId} に確認日がありません`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("知らないモデルは 0 円ではなく「分からない」を返す", () => {
    // 0 円にすると安いモデルと区別が付かず、価格表の抜けに気づけない。
    expect(estimateCostJpy({ modelId: "unknown", inputTokens: 100, outputTokens: 100 })).toBeNull();
  });

  it("小さな呼び出しが 0 円として消えない", () => {
    const yen = estimateCostJpy({
      modelId: MODEL_PRICES[0].modelId,
      inputTokens: 1,
      outputTokens: 0,
    });
    expect(yen).toBe(1);
  });

  it("使っていなければ 0 円（切り上げが 1 円を作らない）", () => {
    // 上の 1 件は「切り上げること」を見ている。切り上げは**下から** 0 を守らない。
    // 呼び出しただけで 1 円ずつ増える実装でも、上の 1 件は緑のまま通る。
    expect(estimateCostJpy({ modelId: MODEL_PRICES[0].modelId, inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("ちょうど 1 円になる量の、その前後", () => {
    // 100 万トークンあたり 2400 円 → 1 円ぶんは 416.66… トークン。
    const m = MODEL_PRICES[0];
    const m2 = { modelId: m.modelId, outputTokens: 0 };
    expect(estimateCostJpy({ ...m2, inputTokens: 1 })).toBe(1);
    expect(estimateCostJpy({ ...m2, inputTokens: 416 })).toBe(1);
    expect(estimateCostJpy({ ...m2, inputTokens: 417 })).toBe(2);
  });
});

describe("AI 利用の集計", () => {
  const usage = (
    over: Partial<Record<string, unknown>> = {},
  ): TelemetryEvent<"ai_model_usage"> => {
    const r = buildTelemetryEvent({
      key: "ai_model_usage" as const,
      occurredAt: new Date("2026-08-17T00:00:00.000Z"),
      readerKey: null,
      payload: {
        workspaceId: "ws1",
        actorId: "user1",
        modelId: "claude-sonnet-5",
        provider: "anthropic",
        usecase: "draft",
        inputTokens: 1_000_000,
        outputTokens: 0,
        durationMs: 1000,
        success: true,
        estimatedCostJpy: 0,
        siteSlug: "demo",
        ...over,
      },
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };

  it("ブログ × モデルで畳み、費用の多い順に並ぶ", () => {
    const rows = rollupAiUsage([
      usage({ modelId: "claude-haiku-4-5" }),
      usage({ modelId: "claude-opus-5" }),
      usage({ modelId: "claude-opus-5" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].modelId).toBe("claude-opus-5");
    expect(rows[0].calls).toBe(2);
  });

  it("ブログが違えば混ざらない", () => {
    const rows = rollupAiUsage([usage({ siteSlug: "a" }), usage({ siteSlug: "b" })]);
    expect(rows.map((r) => r.siteSlug).sort()).toEqual(["a", "b"]);
  });

  it("失敗した呼び出しも数え、費用に含める", () => {
    // 失敗しても料金はかかる。成功だけ数えると費用が合わなくなる。
    const rows = rollupAiUsage([usage({ success: false })]);
    expect(rows[0].failures).toBe(1);
    expect(rows[0].costJpy).toBeGreaterThan(0);
  });

  it("価格が分からないモデルの件数が残る（費用が少なく見えることに気づける）", () => {
    const rows = rollupAiUsage([usage({ modelId: "some-experimental-model" })]);
    expect(rows[0].unpricedCalls).toBe(1);
    expect(totalAiCost(rows).unpricedCalls).toBe(1);
  });

  it("ブログ未指定でも落ちずに 1 つの枠にまとまる", () => {
    const rows = rollupAiUsage([usage({ siteSlug: undefined })]);
    expect(rows[0].siteSlug).toBe("(ブログ未指定)");
  });

  it("平均時間は呼び出し回数で割る", () => {
    const rows = rollupAiUsage([usage({ durationMs: 1000 }), usage({ durationMs: 3000 })]);
    expect(rows[0].avgDurationMs).toBe(2000);
  });

  it("ブログ名とモデル名の境目が、名前の中の文字とぶつからない", () => {
    // 「ブログが違えば混ざらない」は a と b しか使っておらず、
    // **区切り文字を消しても緑のまま通る**（2026-08-19 に実測）。
    // 畳む鍵は「ブログ名 + 区切り + モデル名」で作るので、
    // 区切りが名前の中に現れうる文字（空白など）だと、
    // 別のブログの費用が 1 行に混ざる。**混ざっても行数が減るだけで、誰も気づかない。**
    //
    // ここは実装の区切りが何であるかを見ない。
    // **区切りが何であれ、この 2 件が混ざらないこと**だけを見る。
    const rows = rollupAiUsage([
      usage({ siteSlug: "gear", modelId: "a claude-opus-5" }),
      usage({ siteSlug: "gear a", modelId: "claude-opus-5" }),
    ]);
    expect(rows).toHaveLength(2);
  });
});
