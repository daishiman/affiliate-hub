/** @tier 1 */
import { beforeEach, describe, expect, it } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { clearFeedbackStore } from "@/infrastructure/persistence/sample/feedback-sample-repository";
import { buildToolCatalog, findTool } from "@/presentation/tools/catalog";
import { handleToolRequest } from "@/presentation/tools/rest-adapter";
import { invokeTool } from "@/presentation/tools/tool-definition";
import { PAGE_TOOLS } from "@/presentation/tools/webmcp-policy";
import { recordingAuditLog } from "../support/doubles";

/**
 * 改善要望の道具を、入口の側から見た検査。
 *
 * 一覧まわりの網羅（3 入口が同じものを配る・空入力・権限）は
 * `tool-catalog-adapters.test.ts` が全道具に対して自動で行う。
 * ここで見るのは、**改善要望に固有の事情**だけ。
 *   1. ページ内 AI へは渡らないこと
 *   2. 文章だけでも送れること（画像は任意）
 *   3. 画像は焼き込み済みの 1 枚しか通らないこと
 *   4. 発行した鍵の平文が、返り値の 1 回きりで、一覧には出ないこと
 */

/*
 * **操作の記録を残せる**組み合わせで確かめる。
 * 見本の記録は書き足しを断る（保存先が無い）ので、そのままでは
 * 「記録が残せないので断る」で止まり、ここで見たい中身まで届かない。
 * 記録を残せないときに断ること自体は、画面側
 * （`tests/presentation/feedback-actions.test.ts`）が見ている。
 *
 * 最初は鍵の発行だけをこの組み合わせにしていたが、送る・扱いを変える・
 * 払い出すにも記録が要るようになったので、全部をこちらへ寄せた。
 * 2 つ持つと「どちらで書くか」を毎回選ぶことになり、選び間違いに気づけない。
 */
const catalog = buildToolCatalog({
  ...createDeps(),
  auditLog: recordingAuditLog().port,
});
const ADMIN: ActorContext = { ...SAMPLE_ACTOR, roles: ["owner", ...SAMPLE_ACTOR.roles] };

const FEEDBACK_TOOLS = [
  "submit_feedback",
  "list_feedback",
  "get_feedback",
  "update_feedback_status",
  "hand_off_feedback",
  "manage_integration_keys",
] as const;

/** 1 バイトだけの中身。domain は「空でないこと」しか見ないので、これで足りる。 */
const PNG_BASE64 = btoa("x");

function origin() {
  return {
    screenName: "順位表",
    url: "https://example.invalid/admin/rankings",
    route: "/admin/rankings",
    viewportWidth: 1440,
    viewportHeight: 900,
  };
}

function technical() {
  return {
    jsErrors: [],
    failedRequests: [],
    userAgent: "検査のため実際の環境情報は入っていません",
    recentActions: ["画面を開いた"],
    redactedCount: 0,
  };
}

beforeEach(() => {
  clearFeedbackStore();
});

describe("入口への載り方", () => {
  it.each(FEEDBACK_TOOLS)("%s は、道具の一覧にある", (name) => {
    // 一覧に入れば REST・バックエンド MCP の両方に自動で出る。
    // 入口ごとの登録作業を増やさないことの実測。
    expect(findTool(catalog, name)).not.toBeNull();
  });

  it("ページ内の AI には、どのページでも渡らない", () => {
    // 改善要望の本文は利用者が自由に書く文章で、そこに書かれた命令文を
    // AI が読む経路を作らない。読ませないのが最も確実な防ぎ方。
    const exposed = Object.values(PAGE_TOOLS).flat();
    for (const name of FEEDBACK_TOOLS) {
      expect(exposed, `${name} がページ内 AI へ渡っています`).not.toContain(name);
    }
  });
});

describe("送る", () => {
  it("画像なしでも送れて、そのまま一覧に出る", async () => {
    const submit = findTool(catalog, "submit_feedback")!;
    const sent = await invokeTool(submit, ADMIN, {
      kind: "hard_to_use",
      body: "並び替えが効いているか分かりません。",
      origin: origin(),
      technical: technical(),
    });
    expect(sent.ok ? "ok" : sent.error.message).toBe("ok");

    const list = findTool(catalog, "list_feedback")!;
    const listed = await invokeTool(list, ADMIN, {});
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const rows = (listed.value as { rows: readonly { summary: string }[] }).rows;
      expect(rows.map((r) => r.summary)).toContain("並び替えが効いているか分かりません。");
    }
  });

  it("焼き込み済みの画像は受け取り、要望自体は記録される", async () => {
    const response = await handleToolRequest(catalog, ADMIN, "submit_feedback", {
      kind: "not_working",
      body: "受信箱が白いままです。",
      origin: origin(),
      technical: technical(),
      capture: {
        imageBase64: PNG_BASE64,
        redactionsBurnedIn: true,
        retainsOriginal: false,
        redactionCount: 1,
        maskedElementCount: 2,
        mimeType: "image/png",
      },
    });
    expect(response.status).toBe(200);
  });

  it("重ねただけの画像は断られるが、要望が消えるわけではない", async () => {
    const submit = findTool(catalog, "submit_feedback")!;
    const sent = await invokeTool(submit, ADMIN, {
      kind: "not_working",
      body: "黒塗りをしたのに元が見えます。",
      origin: origin(),
      technical: technical(),
      capture: {
        imageBase64: PNG_BASE64,
        // 上に重ねただけ。ここを通すと、隠したつもりの中身が残る。
        redactionsBurnedIn: false,
        retainsOriginal: false,
        redactionCount: 1,
        maskedElementCount: 0,
        mimeType: "image/png",
      },
    });
    // 画像は付かないが、送った文章まで捨てない。捨てると書き直しになる。
    expect(sent.ok).toBe(true);
    if (sent.ok) {
      expect(JSON.stringify(sent.value)).toContain("焼き込まれていません");
    }
  });

  it("読み取れない画像は、外して送る道があることを添えて断る", async () => {
    const response = await handleToolRequest(catalog, ADMIN, "submit_feedback", {
      kind: "want_feature",
      body: "似た記事があるかを先に見たいです。",
      origin: origin(),
      technical: technical(),
      capture: {
        imageBase64: "これは base64 ではありません",
        redactionsBurnedIn: true,
        retainsOriginal: false,
        redactionCount: 0,
        maskedElementCount: 0,
        mimeType: "image/png",
      },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { suggestedAction: string } };
    // 「送れません」だけだと、利用者はここで諦める。
    expect(body.error.suggestedAction).toContain("画像を外す");
  });
});

describe("取りに来るときの鍵", () => {
  it("発行の応答にだけ平文があり、一覧には出ない", async () => {
    const keys = findTool(catalog, "manage_integration_keys")!;

    const issued = await invokeTool(keys, ADMIN, {
      action: "issue",
      label: "Claude Code から取りに来る用",
      scopes: ["read"],
    });
    expect(issued.ok).toBe(true);
    const plain = issued.ok
      ? ((issued.value as { issuedValue: string | null }).issuedValue ?? "")
      : "";
    expect(plain.length).toBeGreaterThan(0);

    const listed = await invokeTool(keys, ADMIN, { action: "list" });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      // 一度きり、という決まりが本当に守られているかを値で見る。
      expect(JSON.stringify(listed.value)).not.toContain(plain);
    }
  });
});
