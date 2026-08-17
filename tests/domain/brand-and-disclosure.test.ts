import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND_VOICE,
  DEFAULT_CTA,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  createBrand,
  missingPublishReadiness,
} from "@/domain/identity";
import {
  DISCLOSURE_SURFACES,
  type EditorialInfluence,
  type RelationshipType,
  buildVisibleMessage,
  createDisclosure,
  relAttributeFor,
  requiresDisclosure,
} from "@/domain/compliance";
import type { BrandId, DisclosureId, WorkspaceId } from "@/domain/shared/ids";
import { aBrand } from "../support/factories";
import { NOW } from "../support/clock";
import { WORKSPACE } from "../support/actors";

/**
 * 名乗りと広告表記。
 *
 * --- なぜこの 2 つを 1 つのファイルで見るか ---
 * どちらも「読者に対して運営者が何者かを明かす」ための決まりで、
 * 片方だけ整っていても意味がない。
 * 運営者名が無いまま広告表記だけ出しても、誰の広告か分からない。
 *
 * 広告表記は**法律の要求**（景品表示法）に直結する。
 * 実装の都合で文言が短くなる（「PR」だけになる）ことを、ここで止める。
 */

const ID = "brand-1" as BrandId;
const WS = WORKSPACE as WorkspaceId;

function makeBrand(over: Record<string, unknown> = {}) {
  return createBrand({
    id: ID,
    workspaceId: WS,
    displayName: "テスト編集部",
    positioning: "実際に使った記録だけを載せます。",
    createdAt: NOW,
    ...over,
  });
}

describe("ブランドを作る", () => {
  it("名前と立場があれば作れる", () => {
    const result = makeBrand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe("テスト編集部");
  });

  it("名前が空なら断る", () => {
    const result = makeBrand({ displayName: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("ブランド名");
  });

  it("名前が空白だけでも断る（見た目は入っていても名乗れない）", () => {
    const result = makeBrand({ displayName: "　 \t" });
    expect(result.ok).toBe(false);
  });

  it("立場が空なら、なぜ要るのかまで伝えて断る", () => {
    const result = makeBrand({ positioning: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 「必須です」だけでは、書く人が何を書けばよいか分からない。
    expect(result.error.message).toContain("ばらつき");
    expect(result.error.field).toBe("positioning");
  });

  it("前後の空白は落とす（同じ名前が 2 つに割れないように）", () => {
    const result = makeBrand({ displayName: "  テスト編集部  ", positioning: "  立場  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe("テスト編集部");
    expect(result.value.positioning).toBe("立場");
  });

  it("省いた項目には既定が入る", () => {
    const result = makeBrand();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.locale).toBe(DEFAULT_LOCALE);
    expect(result.value.timeZone).toBe(DEFAULT_TIME_ZONE);
    expect(result.value.defaultCta).toBe(DEFAULT_CTA);
    expect(result.value.voice).toEqual(DEFAULT_BRAND_VOICE);
    expect(result.value.legalName).toBeNull();
    expect(result.value.contactEmail).toBeNull();
    expect(result.value.disclaimer).toBeNull();
  });

  it("空白だけの指定は「指定なし」として既定に戻す", () => {
    // 空文字のまま通すと、時間帯が空のまま予定日時を読むことになり、
    // 「20日 9:00」が人によって別の時刻になる。
    const result = makeBrand({ locale: "  ", timeZone: "", defaultCta: " \t " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.locale).toBe(DEFAULT_LOCALE);
    expect(result.value.timeZone).toBe(DEFAULT_TIME_ZONE);
    expect(result.value.defaultCta).toBe(DEFAULT_CTA);
  });

  it("指定した値はそのまま使う", () => {
    const voice = { ...DEFAULT_BRAND_VOICE, politeness: "plain" as const };
    const result = makeBrand({
      legalName: "テスト合同会社",
      contactEmail: "contact@example.com",
      disclaimer: "執筆時点の情報です。",
      locale: "en-US",
      timeZone: "UTC",
      defaultCta: "詳しく見る",
      voice,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.locale).toBe("en-US");
    expect(result.value.timeZone).toBe("UTC");
    expect(result.value.defaultCta).toBe("詳しく見る");
    expect(result.value.voice.politeness).toBe("plain");
    expect(result.value.disclaimer).toBe("執筆時点の情報です。");
  });
});

describe("公開に足りないもの", () => {
  it("運営者名と問い合わせ先が揃っていれば、足りないものは無い", () => {
    expect(missingPublishReadiness(aBrand())).toEqual([]);
  });

  it("運営者名だけ無いとき、その 1 つだけを挙げる", () => {
    expect(missingPublishReadiness(aBrand({ legalName: null }))).toEqual(["運営者の表示名"]);
  });

  it("問い合わせ先だけ無いとき、その 1 つだけを挙げる", () => {
    expect(missingPublishReadiness(aBrand({ contactEmail: null }))).toEqual([
      "問い合わせ先メールアドレス",
    ]);
  });

  it("両方無いとき、両方を挙げる（1 つ直すたびに止まらないように）", () => {
    const missing = missingPublishReadiness(aBrand({ legalName: null, contactEmail: null }));
    expect(missing).toHaveLength(2);
  });

  it("空文字は「入っている」と数えない", () => {
    // 画面から空欄で保存されると空文字が入る。null だけを見ていると素通りする。
    expect(missingPublishReadiness(aBrand({ legalName: "" }))).toContain("運営者の表示名");
  });
});

const ALL_RELATIONSHIPS: readonly RelationshipType[] = [
  "affiliate",
  "sponsored",
  "supplied",
  "loaned",
  "purchased",
  "paid_partnership",
];

const ALL_INFLUENCES: readonly EditorialInfluence[] = ["none", "limited", "declared"];

describe("広告表記の文言", () => {
  it.each(ALL_RELATIONSHIPS)("%s: 関係の種類が文章として出る", (relationshipType) => {
    const message = buildVisibleMessage({
      relationshipType,
      advertiserOrSupplier: null,
      editorialInfluence: "none",
      aiAssisted: false,
    });
    // 「PR」のような短縮を許さない。読んで意味が分かる長さがあること。
    expect(message.length).toBeGreaterThan(10);
    expect(message.endsWith("。")).toBe(true);
  });

  it.each(ALL_INFLUENCES)("%s: 広告主の関与のしかたが必ず書かれる", (editorialInfluence) => {
    const message = buildVisibleMessage({
      relationshipType: "sponsored",
      advertiserOrSupplier: null,
      editorialInfluence,
      aiAssisted: false,
    });
    expect(message).toContain("広告主");
  });

  it("提供元があれば名前を出す", () => {
    const message = buildVisibleMessage({
      relationshipType: "supplied",
      advertiserOrSupplier: "テスト電機",
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(message).toContain("提供元: テスト電機");
  });

  it("提供元が無ければ、提供元の欄そのものを出さない", () => {
    const message = buildVisibleMessage({
      relationshipType: "supplied",
      advertiserOrSupplier: null,
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(message).not.toContain("提供元");
  });

  it("提供元が空文字なら、名前の無い『提供元: 』を出さない", () => {
    const message = buildVisibleMessage({
      relationshipType: "supplied",
      advertiserOrSupplier: "",
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(message).not.toContain("提供元");
  });

  it("AI を使ったときは、確認したのが人であることまで書く", () => {
    const message = buildVisibleMessage({
      relationshipType: "affiliate",
      advertiserOrSupplier: null,
      editorialInfluence: "none",
      aiAssisted: true,
    });
    expect(message).toContain("AI");
    // 「AI が書きました」で終わらせない。誰が責任を持つかが読者の関心。
    expect(message).toContain("編集部が確認");
  });

  it("AI を使っていないときは、AI の話を出さない", () => {
    const message = buildVisibleMessage({
      relationshipType: "affiliate",
      advertiserOrSupplier: null,
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(message).not.toContain("AI");
  });
});

describe("広告表記を作る", () => {
  const base = { id: "disc-1" as DisclosureId, workspaceId: WS };

  it("既定では AI 利用なしとして扱う", () => {
    const result = createDisclosure({
      ...base,
      relationshipType: "affiliate",
      editorialInfluence: "none",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.aiAssisted).toBe(false);
    expect(result.value.advertiserOrSupplier).toBeNull();
  });

  it("文言を渡さなければ自動で組み立てる", () => {
    const result = createDisclosure({
      ...base,
      relationshipType: "sponsored",
      advertiserOrSupplier: "テスト電機",
      editorialInfluence: "limited",
      aiAssisted: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibleMessage).toContain("テスト電機");
    expect(result.value.visibleMessage).toContain("AI");
  });

  it("文言を渡せばそのまま使う", () => {
    const result = createDisclosure({
      ...base,
      relationshipType: "affiliate",
      editorialInfluence: "none",
      visibleMessage: "この記事にはアフィリエイト広告が含まれます。",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibleMessage).toBe("この記事にはアフィリエイト広告が含まれます。");
  });

  it.each(ALL_RELATIONSHIPS.filter(requiresDisclosure))(
    "%s: 広告主が内容確認をするなら、提供元の名前が要る",
    (relationshipType) => {
      const result = createDisclosure({
        ...base,
        relationshipType,
        editorialInfluence: "declared",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.field).toBe("advertiserOrSupplier");
    },
  );

  it("提供元が空文字でも、名前が無いものとして断る", () => {
    const result = createDisclosure({
      ...base,
      relationshipType: "sponsored",
      advertiserOrSupplier: "",
      editorialInfluence: "declared",
    });
    expect(result.ok).toBe(false);
  });

  it("提供元があれば、内容確認ありでも作れる", () => {
    const result = createDisclosure({
      ...base,
      relationshipType: "sponsored",
      advertiserOrSupplier: "テスト電機",
      editorialInfluence: "declared",
    });
    expect(result.ok).toBe(true);
  });

  it("自費購入なら、内容確認ありでも提供元は要らない", () => {
    // 誰にも提供されていないので、書かせようとしても書けない。
    const result = createDisclosure({
      ...base,
      relationshipType: "purchased",
      editorialInfluence: "declared",
    });
    expect(result.ok).toBe(true);
  });

  it.each(ALL_RELATIONSHIPS)("%s: 内容確認なしなら提供元が無くても作れる", (relationshipType) => {
    const result = createDisclosure({
      ...base,
      relationshipType,
      editorialInfluence: "limited",
    });
    expect(result.ok).toBe(true);
  });
});

describe("表示が要るかどうか", () => {
  it("自費購入だけが、表示の要らない関係", () => {
    const notRequired = ALL_RELATIONSHIPS.filter((r) => !requiresDisclosure(r));
    expect(notRequired).toEqual(["purchased"]);
  });

  it.each(ALL_RELATIONSHIPS.filter(requiresDisclosure))(
    "%s: リンクに広告であることの印を付ける",
    (relationshipType) => {
      expect(relAttributeFor(relationshipType)).toContain("sponsored");
    },
  );

  it("自費購入のリンクには広告の印を付けない（付けると事実と違う）", () => {
    expect(relAttributeFor("purchased")).toBe("noopener");
  });

  it.each(ALL_RELATIONSHIPS)("%s: どの関係でも別窓対策は必ず付く", (relationshipType) => {
    expect(relAttributeFor(relationshipType)).toContain("noopener");
  });
});

describe("表示する場所", () => {
  it("8 か所すべてが挙がっている", () => {
    // 1 か所でも抜けると、そこだけ広告表記の無い面ができる。
    expect(new Set(DISCLOSURE_SURFACES).size).toBe(DISCLOSURE_SURFACES.length);
    expect(DISCLOSURE_SURFACES).toContain("ai_answer");
    expect(DISCLOSURE_SURFACES).toContain("webmcp_response");
    expect(DISCLOSURE_SURFACES).toContain("comparison_table");
    expect(DISCLOSURE_SURFACES.length).toBe(8);
  });
});
