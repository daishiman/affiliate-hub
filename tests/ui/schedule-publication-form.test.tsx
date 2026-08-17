/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHANNEL_CAPABILITIES } from "@/domain/distribution";
import { SchedulePublicationForm } from "@/presentation/admin/schedule-publication-form";

/**
 * 記事の画面から配信を作る欄。
 *
 * --- ここで固定したいこと ---
 *
 * **出し先の一覧を画面が書き起こしていないこと。**
 * 手で並べると、出し先を 1 つ足した日に画面だけが古くなり、
 * 「AI からは出せるのに画面からは選べない」が静かに生まれる。
 * この検査は登録表と画面を突き合わせるので、足した日に落ちる。
 *
 * もう 1 つは **既定の出し先を勝手に選ばないこと**。
 * 投稿は取り消しても「一度出た」事実が消せないので、
 * 未選択のまま押せる状態を作らない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / 残課題 26
 */

function render(): string {
  return renderToStaticMarkup(<SchedulePublicationForm variantId="cv_alpha_review" />);
}

describe("配信を作る欄", () => {
  it("出し先の選択肢が、登録表のチャネルと 1 対 1 で並ぶ", () => {
    const html = render();
    for (const c of Object.values(CHANNEL_CAPABILITIES)) {
      expect(html, `${c.label} が選べません`).toContain(`value="${c.kind}"`);
      expect(html).toContain(c.label);
    }
  });

  it("どの記事かを一緒に送る（取り違えを起こさない）", () => {
    expect(render()).toContain('value="cv_alpha_review"');
  });

  it("出し先を選ぶまで押せない（既定の出し先を勝手に決めない）", () => {
    const html = render();
    expect(html).toContain("disabled");
  });

  it("日時は任意で、空にした場合の意味が書いてある", () => {
    const html = render();
    // 「空 = 未入力」で止めない。空にすると何が起きるかまで書く。
    expect(html).toContain("すぐに出ます");
  });

  it("AI から呼ぶ名前が、道具の名前と同じである（別名を作らない）", () => {
    expect(render()).toContain('toolname="schedule_publication"');
  });
});
