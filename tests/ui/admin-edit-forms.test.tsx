/**
 * @tier 2
 * @req REQ-UX02
 * @types equivalence, decision-table
 *
 * 直す欄が、押した後に何を見せるか。
 *
 * --- ここで守りたいこと ---
 * 1. **断られたことが画面に出る。** 断りを黙って捨てると、押した人には
 *    「効かないボタン」としか見えない。欄ごとの断りは欄の下、
 *    欄に紐付かない断りはまとめて 1 か所に出す。
 * 2. **変わらなかったことも、変わったことと区別して出る。** 同じ値を入れ直した
 *    ときに「直しました」と出ると、次に開いて違っていても気づけない。
 * 3. **自動で出せない先は、押す前に伝える。** 押してから知らせると
 *    「直したのに出ていない」と読まれる。
 * 4. **0 件のときは黙る。** 「関連記事 0 本」は警告の見た目で無を伝えてしまう。
 *
 * 画面の状態は `useActionState` の中にあり、外から押せない。
 * ここでは react の同フックだけ差し替えて、押した後の姿を直接作って見る。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicationFormState } from "@/presentation/admin/publication-form-state";
import type { SiteFormState } from "@/presentation/admin/site-form-state";
import type { ProductFormState } from "@/presentation/admin/product-form-state";

/** 押した後の状態。各 it が入れ替える。null なら初期値のまま。 */
let injected: unknown = null;
let injectedPending = false;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [
      injected ?? initial,
      () => undefined,
      injectedPending,
    ],
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) => (
    <a href={href}>{children as never}</a>
  ),
}));

const { UpdateSiteForm } = await import("@/presentation/admin/site-form");
const { UpdatePublicationForm } = await import("@/presentation/admin/publication-form");
const { CreateProductForm, UpdateProductForm } = await import(
  "@/presentation/admin/product-form"
);

const SITE_DEFAULTS = {
  siteSlug: "video-editing-gear",
  name: "動画編集ラボ",
  purpose: "書き出しが遅い人の道具選び",
  genre: "動画編集",
  emitLlmsTxt: true,
  axes: [
    { key: "targetReader", label: "誰に向けるか", value: "始めて 1 年の人" },
    { key: "ctaStrategy", label: "背中の押し方", value: "急かさない" },
  ],
};

const PRODUCT_DEFAULTS = {
  productId: "p_kobo_15",
  brand: "Kobo",
  name: "Kobo Studio 15",
  manufacturer: "",
  description: "説明",
  specifications: "重さ: 1.2kg",
  officialUrl: "https://example.test/kobo",
};

function siteHtml(state: SiteFormState | null): string {
  injected = state;
  return renderToStaticMarkup(<UpdateSiteForm defaults={SITE_DEFAULTS} />);
}

function publicationHtml(
  state: PublicationFormState | null,
  over: Partial<{ channelKind: string; scheduledAt: string }> = {},
): string {
  injected = state;
  return renderToStaticMarkup(
    <UpdatePublicationForm
      defaults={{
        publicationId: "pub_01",
        channelKind: "own_site",
        scheduledAt: "",
        ...over,
      }}
    />,
  );
}

function productHtml(state: ProductFormState | null): string {
  injected = state;
  return renderToStaticMarkup(<UpdateProductForm defaults={PRODUCT_DEFAULTS} />);
}

beforeEach(() => {
  injected = null;
  injectedPending = false;
});

describe("ブログの設計図を直す欄", () => {
  it("いまの値が入った状態で開く（10 軸は隠さない）", () => {
    const html = siteHtml(null);
    expect(html).toContain('value="video-editing-gear"');
    expect(html).toContain("動画編集ラボ");
    // 軸は渡された数だけ出る。決める場で隠すと、空の軸が何本もの記事に効く。
    expect(html).toContain('name="axis.targetReader"');
    expect(html).toContain('name="axis.ctaStrategy"');
    expect(html).toContain("誰に向けるか");
  });

  it("軸が 1 本も無いブログでも、欄そのものは開ける", () => {
    injected = null;
    const html = renderToStaticMarkup(
      <UpdateSiteForm defaults={{ ...SITE_DEFAULTS, emitLlmsTxt: false, axes: [] }} />,
    );
    expect(html).toContain('name="siteSlug"');
    expect(html).not.toContain('name="axis.');
  });

  /*
   * --- 断りの出どころを、文言ではなく印で測る（2026-08-22 / ah-brd）---
   *
   * 元は「この操作はできませんでした」という**見出しの文字列**で、欄側か
   * まとめ側かを判定していた。その見出しは `FormResult` へ寄せたときに
   * 消した（枠の色がすでに「うまくいかなかった」を伝えるので二度言いだった）。
   *
   * 文言で測る検査は、文言を直した日に赤くなる。**守りたいのは文言ではなく、
   * 読み上げに何が届くか**なので、そちらを測る形に直した。
   *
   *   - 欄に紐付く断り … `aria-invalid` が付き、`role="alert"` で読まれる
   *   - 紐付かない断り … 欄はどれも正常なまま、まとめの枠だけが出る
   *
   * どちらの場合も断りの文は **1 回だけ**出る。2 回出ると、原因が 2 つあるように読める。
   */
  const count = (html: string, needle: string): number => html.split(needle).length - 1;

  it("欄に紐付く断りは、その欄の下に出る", () => {
    const html = siteHtml({ status: "failed", message: "目的が長すぎます", field: "purpose" });
    expect(count(html, "目的が長すぎます"), "断りが 1 回だけ出ていません").toBe(1);
    // 欄が「間違っている」と名乗る。読み上げはこれを見て欄と断りを結び付ける。
    expect(html).toContain("aria-invalid");
    expect(html).toContain('role="alert"');
  });

  it("欄に紐付かない断りは、まとめて 1 か所に出る", () => {
    const html = siteHtml({ status: "failed", message: "権限がありません" });
    expect(count(html, "権限がありません"), "断りが 1 回だけ出ていません").toBe(1);
    // どの欄も間違っていない。欄を赤くすると、直しようのない欄を直させることになる。
    expect(html).not.toContain("aria-invalid");
  });

  it("変わったときと変わらなかったときで、伝え方が違う", () => {
    const changed = siteHtml({
      status: "done",
      message: "ブログ名 を直しました",
      sitePath: "/admin/sites/video-editing-gear",
      changedLabels: ["ブログ名"],
    });
    expect(changed).toContain("ブログ名 を直しました");
    expect(changed).toContain('href="/admin/sites/video-editing-gear"');

    /*
     * 変わらなかったことは、**文と色の両方**で伝える。
     *
     * 文は action が持つ（「いま入っている値と同じでした」）。色は画面が
     * `doneTone="info"` で選ぶ。success にすると、直っていないのに直った気になる。
     * warn にはしない——失敗ではないので。
     */
    const same = siteHtml({ status: "done", message: "同じでした", changedLabels: [] });
    expect(same).toContain("同じでした");
    expect(same, "変更 0 件のときに success の色を使っています").not.toContain("calloutSuccess");
    // 行き先が無いときはリンクを出さない。押せない導線を置かない。
    expect(same).not.toContain("このブログを見る");
  });

  it("送信中はボタンが押せず、進んでいることが文字で分かる", () => {
    injectedPending = true;
    const html = siteHtml(null);
    expect(html).toContain("直しています…");
    expect(html).toContain("disabled");
  });
});

describe("送信前の配信を直す欄", () => {
  it("出し先の選択肢は、登録表から出す（画面で書き起こさない）", async () => {
    const { CHANNEL_CAPABILITIES } = await import("@/domain/distribution");
    const html = publicationHtml(null);
    for (const c of Object.values(CHANNEL_CAPABILITIES)) {
      expect(html, `${c.label} が選べません`).toContain(`value="${c.kind}"`);
    }
  });

  it("自動で投稿できない先を選んでいるときは、押す前に伝える", async () => {
    const { CHANNEL_CAPABILITIES } = await import("@/domain/distribution");
    // 出し先を名指しで書かない。手で出す先が入れ替わった日に、
    // 検査だけが古い名前を指して緑のまま残るのを防ぐ。
    const manual = Object.values(CHANNEL_CAPABILITIES).filter(
      (c) => c.publishMode === "manual_export",
    );
    expect(manual.length, "手で出す先が 1 つも登録されていません").toBeGreaterThanOrEqual(1);

    const html = publicationHtml(null, { channelKind: manual[0]!.kind });
    expect(html).toContain("投稿はご自身で行います");
    expect(html).toContain(manual[0]!.label);
  });

  it("自動で出せる先なら、その断り書きは出さない", () => {
    expect(publicationHtml(null, { channelKind: "own_site" })).not.toContain(
      "投稿はご自身で行います",
    );
  });

  it("出し先が未選択でも落ちない（登録表を引きに行かない）", () => {
    const html = publicationHtml(null, { channelKind: "" });
    expect(html).toContain('name="channelKind"');
    expect(html).not.toContain("投稿はご自身で行います");
  });

  it("欄に紐付く断りと、紐付かない断りを出し分ける", () => {
    // 見出しの文字列ではなく印で測る。理由は上の同名の検査に書いてある。
    /*
     * 断りの文は、同じ欄の `hint` と**違う文**にしてある。
     * hint は「過ぎた日時は指定できません。」と書いてあるので、それを検体に
     * 使うと 2 回出て、二重表示と区別できない。
     */
    const byField = publicationHtml({
      status: "failed",
      message: "2026-01-01 は今より前です",
      field: "scheduledAt",
    });
    expect(byField.split("2026-01-01 は今より前です").length - 1).toBe(1);
    expect(byField).toContain("aria-invalid");

    const whole = publicationHtml({ status: "failed", message: "すでに送信済みです" });
    expect(whole.split("すでに送信済みです").length - 1).toBe(1);
    expect(whole).not.toContain("aria-invalid");
  });

  it("成功したら行き先を出し、手で出す案内があれば落とさない", () => {
    const html = publicationHtml({
      status: "done",
      message: "出し先を X に直しました",
      publicationPath: "/admin/publications/pub_01",
      manualExportNotice: "X には手で投稿してください。",
    });
    expect(html).toContain('href="/admin/publications/pub_01"');
    expect(html).toContain("X には手で投稿してください。");
  });

  it("手で出す案内が無いときは、その枠を出さない", () => {
    const html = publicationHtml({
      status: "done",
      message: "直しました",
      publicationPath: "/admin/publications/pub_01",
      manualExportNotice: null,
    });
    expect(html).toContain("直しました");
    expect(html).not.toContain("手で投稿");
  });
});

describe("商品の欄", () => {
  it("登録の欄と直す欄は別物（直す欄だけがどの商品かを持つ）", () => {
    injected = null;
    expect(renderToStaticMarkup(<CreateProductForm />)).not.toContain('name="productId"');
    expect(productHtml(null)).toContain('value="p_kobo_15"');
  });

  it("消すことは、空欄ではなく選ぶ操作にしてある", () => {
    const html = productHtml(null);
    expect(html).toContain('value="clearManufacturer"');
    expect(html).toContain('value="clearDescription"');
  });

  it("関連記事が 0 本のときは黙る（0 と書くと警告に見える）", () => {
    const html = productHtml({
      status: "done",
      message: "保存しました",
      referencingArticles: 0,
      productPath: "/admin/products/p_kobo_15",
    });
    expect(html).toContain("保存しました");
    expect(html).not.toContain("本あります");
    expect(html).toContain('href="/admin/products/p_kobo_15"');
  });

  it("関連記事があるときだけ、何本に及ぶかを伝える", () => {
    const html = productHtml({
      status: "done",
      message: "保存しました",
      referencingArticles: 3,
    });
    expect(html).toContain("3 本あります");
    // 行き先が無ければリンクは出さない。
    expect(html).not.toContain("直した商品を見る");
  });

  it("欄に紐付かない断りだけ、まとめの枠に出る", () => {
    const byField = productHtml({
      status: "failed",
      message: "URL の形が違います",
      field: "officialUrl",
    });
    expect(byField).toContain("URL の形が違います");

    const whole = productHtml({ status: "failed", message: "この商品は使用中です" });
    expect(whole).toContain("この商品は使用中です");
  });
});
