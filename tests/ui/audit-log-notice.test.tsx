/**
 * @tier 2
 * @req REQ-SEC09
 * @types audit-log, screen-states
 *
 * 操作の記録が**何で動いているか**が、設定の画面に文字で出ていること。
 *
 * --- なぜこの 1 枚だけ文言を固定するのか ---
 *
 * `page-render.test.tsx` は、言い回しを直すたびに 50 本落ちるのを避けるため
 * 文言そのものを固定しない。ここはその例外にする。
 *
 * 2026-08-18 に、見本の記録先を「必ず断る」から
 * 「控え（この実行中だけ覚える置き場）へ本当に書く」へ変えた。
 * 書けるようになったこと自体は良いが、**記録は「残った」と言えること自体が
 * 意味を持つ唯一の種類**なので、短命な置き場で動いていることを
 * 黙っているわけにはいかない。残っていると思われて残っていない記録は、
 * 記録が無い状態より悪い。
 *
 * つまりこの表示は、控えを許した**条件そのもの**である。
 * 条件を検査しなければ、条件は無いのと同じになる。
 */
import { describe, expect, it } from "vitest";
import { auditLogNotice } from "@/presentation/composition";
import { renderRoute, textOf } from "../support/render";

describe("操作の記録が何で動いているか", () => {
  it("設定の画面に、短命な置き場で動いていることが文字で出ている", async () => {
    const html = await renderRoute("@/app/admin/settings/page", {});
    const text = textOf(html);

    // この描画の担当者は `audit.read` を持たず、記録の一覧そのものは出ない。
    // それでも文言が出ることを見ているのは、**表示が権限の内側に入っていない**
    // ことの確認でもある。内側に置くと、一覧を見られない大多数には
    // 「記録は残っている」とだけ見えて、短命な置き場だと気づけない。
    expect(text).toContain("操作の記録");
    // 見出しだけでは足りない。**どこに残っているか**が読めることまで見る。
    expect(text).toContain("この実行中だけ覚える");
    expect(text).toContain("消えます");
  });

  it("画面に出す一文が、置き場の実態から作られている（画面側の固定文ではない）", async () => {
    const status = await auditLogNotice();

    // 保存先がつながっていない実行なので、残らない側で返る。
    expect(status.persisted).toBe(false);
    expect(status.stubId).toBe("persistence:audit-log-memory");
    // 台帳の識別子と画面の表示が同じ出どころから来ていないと、
    // 保存先をつないだあとも「この実行中だけ覚えます」と出続ける。
    expect(status.message).toContain("この実行中だけ覚える");
  });
});
