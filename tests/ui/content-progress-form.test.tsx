/** @tier 2 @req REQ-R11 @types screen-states */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HUMAN_APPROVAL_REQUIRED, allowedNextStates } from "@/domain/authoring";
import { CONTENT_STATE_LABEL } from "@/application/usecases/content/manage-content";
import {
  AdvanceContentStateForm,
  ApproveContentForm,
} from "@/presentation/admin/content-progress-form";

/**
 * 記事の画面から段階を進める欄・承認する欄。
 *
 * --- ここで固定したいこと ---
 *
 * **承認・公開予約・公開が「進める先」の選択肢に出ないこと。**
 * 段階だけを動かすと、かんばんは承認済みなのに記事の中身は未承認、という
 * 同じ 1 本について 2 つの答えが見える状態になる。
 *
 * もう 1 つは **進める先が無いときに、空の選択肢と押せるボタンを置かないこと**。
 * 空欄と有効なボタンだけが出ていると、押した人には故障に見える。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */

function nextStatesOf(from: Parameters<typeof allowedNextStates>[0]) {
  return allowedNextStates(from).map((s) => ({
    state: s,
    label: CONTENT_STATE_LABEL[s],
    humanOnly: HUMAN_APPROVAL_REQUIRED.has(s),
  }));
}

function renderAdvance(from: Parameters<typeof allowedNextStates>[0]): string {
  return renderToStaticMarkup(
    <AdvanceContentStateForm variantId="cv_alpha_review" from={from} nextStates={nextStatesOf(from)} />,
  );
}

describe("記事を次の段階へ進める欄", () => {
  it("進める先の選択肢が、遷移表と 1 対 1 で並ぶ（人だけの操作を除く）", () => {
    const html = renderAdvance("FACT_CHECK");
    for (const n of nextStatesOf("FACT_CHECK")) {
      if (n.humanOnly) continue;
      expect(html, `${n.label} が選べません`).toContain(`value="${n.state}"`);
      expect(html).toContain(n.label);
    }
  });

  it("承認は「進める先」の選択肢に出さない", () => {
    // 出すと、段階だけが承認済みへ動き、記事の中身は未承認のまま残る。
    const html = renderAdvance("COMPLIANCE_REVIEW");
    expect(html).not.toContain('value="APPROVED"');
  });

  it("どの記事を、どの段階から進めるのかを一緒に送る", () => {
    const html = renderAdvance("FACT_CHECK");
    expect(html).toContain('value="cv_alpha_review"');
    // 押した人が見ていた段階。保存先と食い違ったら断るために送る。
    expect(html).toContain('value="FACT_CHECK"');
  });

  it("進める先を選ぶまで押せない", () => {
    expect(renderAdvance("FACT_CHECK")).toContain("disabled");
  });

  it("進める先が無い段階では、押せない理由が書いてある", () => {
    // 終わりの段階。空の選択肢を置くと、故障しているように見える。
    const html = renderToStaticMarkup(
      <AdvanceContentStateForm variantId="cv_alpha_review" from="PUBLISHED" nextStates={[]} />,
    );
    expect(html).toContain("進める先はありません");
    expect(html).not.toContain("この段階へ進める");
  });

  it("AI から呼ぶ名前が、道具の名前と同じである", () => {
    expect(renderAdvance("FACT_CHECK")).toContain('toolname="advance_content_state"');
  });
});

describe("承認する欄", () => {
  it("どの記事を承認するのかを一緒に送る", () => {
    const html = renderToStaticMarkup(<ApproveContentForm variantId="cv_alpha_review" />);
    expect(html).toContain('value="cv_alpha_review"');
    expect(html).toContain('toolname="approve_content"');
  });

  it("押す前から、これが人の確認であると読める", () => {
    const html = renderToStaticMarkup(<ApproveContentForm variantId="cv_alpha_review" />);
    expect(html).toContain("内容を確認したので承認する");
  });
});
