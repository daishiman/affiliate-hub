/** @tier 2 @req REQ-P07, REQ-S06 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SiteDraftView, WizardFieldSpec } from "@/application/usecases/site/build-site";
import { SiteWizardStepForm } from "@/presentation/admin/site-wizard-form";

/**
 * ブログ作成ウィザードの 1 段階。
 *
 * --- ここで固定したいこと ---
 * **欄の並びを画面が決めていないこと。**
 * application 層が返した `fields` をそのまま描いているなら、
 * 段階を 1 つ足しても画面は変わらない。
 * 逆にここで欄を書き起こしていると、
 * 「保存はできるが画面に欄が無い」が静かに起きる。
 *
 * もう 1 つは最後の段階。**押せないボタンだけを置かない。**
 * どこが足りないかと、そこへ戻る道を一緒に出す。
 * 理由の書かれていない押せないボタンは、故障と見分けがつかない。
 */

function aField(over: Partial<WizardFieldSpec> = {}): WizardFieldSpec {
  return {
    name: "purpose",
    kind: "text",
    label: "このブログの目的",
    hint: "読んだ人が何をできるようになるかを 1〜2 文で。",
    value: "",
    options: [],
    selected: [],
    ...over,
  };
}

function aDraftView(over: Partial<SiteDraftView> = {}): SiteDraftView {
  return {
    draftId: "sd_test",
    name: "はじめてのレンズ",
    slug: "lens-start",
    steps: [],
    currentStep: "purpose",
    totalSteps: 13,
    doneCount: 3,
    incomplete: [],
    incompleteLabels: [],
    createdSiteSlug: null,
    answers: {},
    categoryCount: 1,
    articleTypes: ["guide"],
    fields: [aField()],
    ...over,
  } as SiteDraftView;
}

function render(view: SiteDraftView): string {
  return renderToStaticMarkup(<SiteWizardStepForm draft={view} />);
}

describe("入力の段階", () => {
  it("どの下書きかと、どの段階かを一緒に送る（取り違えを起こさない）", () => {
    const html = render(aDraftView());
    expect(html).toContain('value="sd_test"');
    expect(html).toContain('value="purpose"');
  });

  it("application 層が返した欄を、そのまま描く", () => {
    const html = render(
      aDraftView({
        fields: [
          aField({ name: "targetReader", label: "誰が読むか", hint: "職業・状況まで。" }),
          aField({ name: "searchIntent", label: "何を知りたくて来るか", hint: "検索の言葉で。" }),
        ],
      }),
    );
    expect(html).toContain("誰が読むか");
    expect(html).toContain("何を知りたくて来るか");
    expect(html).toContain("職業・状況まで。");
  });

  it("長い文の欄は、1 行の欄ではなく広い欄で出す", () => {
    const html = render(aDraftView({ fields: [aField({ kind: "longtext" })] }));
    expect(html).toContain("<textarea");
  });

  it("選ぶ欄は、選択肢を並べて出す", () => {
    const html = render(
      aDraftView({
        fields: [
          aField({
            name: "pattern",
            kind: "choice",
            label: "ブログの型",
            options: [
              { value: "beginner_guide", label: "はじめての人向けの案内" },
              { value: "comparison", label: "比較中心" },
            ],
          }),
        ],
      }),
    );
    expect(html).toContain("<select");
    expect(html).toContain("はじめての人向けの案内");
    expect(html).toContain("比較中心");
    // 何も選んでいない状態が「先頭の選択肢を選んだ」に見えてはいけない。
    expect(html).toContain("選んでください");
  });

  it("複数選ぶ欄は、選択肢ごとに押せる形で出す", () => {
    const html = render(
      aDraftView({
        fields: [
          aField({
            name: "articleTypes",
            kind: "multi_choice",
            label: "最初に置く記事の種類",
            options: [
              { value: "guide", label: "案内" },
              { value: "comparison", label: "比較" },
            ],
            selected: ["guide"],
          }),
        ],
      }),
    );
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("案内");
    expect(html).toContain("比較");
    // すでに選ばれているものは、選ばれた状態で出る（開き直すたびに消えない）。
    expect(html).toContain("checked");
  });

  it("すでに入っている答えを、欄の初期値として出す", () => {
    const html = render(aDraftView({ fields: [aField({ value: "レンズ選びで迷わないようにする" })] }));
    expect(html).toContain("レンズ選びで迷わないようにする");
  });

  it("AI からも同じ操作ができるよう、操作の名前が付いている", () => {
    const html = render(aDraftView());
    expect(html).toContain('toolname="save_site_draft_step"');
  });
});

describe("作る段階", () => {
  const createStep = { currentStep: "create" as const, fields: [] };

  it("埋まっていない段階があるとき、どこが足りないかと戻る道を出す", () => {
    const html = render(
      aDraftView({
        ...createStep,
        incomplete: ["categories", "design"],
        incompleteLabels: ["カテゴリー", "配色"],
      }),
    );
    expect(html).toContain("カテゴリー");
    expect(html).toContain("配色");
    // 戻る先は、足りない段階の最初。押したあと自分で探させない。
    expect(html).toContain("step=categories");
    expect(html).toContain("disabled");
  });

  it("既存の段階が全部埋まっていても、見せ方を選ぶまでは作成を押せない", () => {
    const html = render(aDraftView(createStep));
    expect(html).not.toContain("まだ埋まっていない段階があります");
    expect(html).toContain("6 種から選んでください");
    expect(html).toContain("disabled");
    expect(html).toContain("このブログを作る");
  });

  it("すでに作ってあるときは、作り直させずに、できたブログへの道を出す", () => {
    const html = render(aDraftView({ ...createStep, createdSiteSlug: "lens-start" }));
    expect(html).toContain("作成済み");
    expect(html).toContain("/s/lens-start");
    // もう一度押せてしまうと、同じブログが二重にできる。
    expect(html).not.toContain("このブログを作る");
  });

  it("AI からも同じ操作ができるよう、操作の名前が付いている", () => {
    const html = render(aDraftView(createStep));
    expect(html).toContain('toolname="create_site_from_draft"');
  });
});
