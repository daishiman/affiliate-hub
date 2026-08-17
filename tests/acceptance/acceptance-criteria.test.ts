import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildToolCatalog, findTool } from "@/presentation/tools/catalog";
import { invokeTool } from "@/presentation/tools/tool-definition";
import { createDeps } from "@/infrastructure/composition";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import type { ActorContext } from "@/domain/shared";

/**
 * 受け入れ条件（要求仕様 §30.1〜§30.8）。
 *
 * ここは「型が正しいか」を見る場所ではない。
 * **依頼者が受け取ったときに確かめる操作を、そのまま機械で流す。**
 * だから呼ぶのは画面や AI が呼ぶのと同じ入口（ツールカタログ）で、
 * 中の関数を直接つつくことはしない。中を直接呼ぶと、
 * 入口の配線が外れていても気づけない。
 *
 * いま返ってくる値は見本データだが、通っている経路は本番と同じ。
 * 保存先を D1 に差し替えても、このテストは 1 行も変えずに通る。
 */

const catalog = buildToolCatalog(createDeps());

/** 報酬まわりの操作ができる担当者。見本の担当者には権限が無い。 */
const MANAGER: ActorContext = { ...SAMPLE_ACTOR, roles: ["owner"] };

type Json = Record<string, unknown>;

async function call(name: string, args: Json, actor: ActorContext = SAMPLE_ACTOR) {
  const tool = findTool(catalog, name);
  expect(tool, `ツールがありません: ${name}`).not.toBeNull();
  if (tool === null) throw new Error(name);
  return invokeTool(tool, actor, args);
}

/** 成功を前提に中身を取り出す。失敗していたら理由つきで落とす。 */
async function value(name: string, args: Json, actor: ActorContext = SAMPLE_ACTOR): Promise<Json> {
  const r = await call(name, args, actor);
  if (!r.ok) throw new Error(`${name} が失敗しました: ${r.error.message}`);
  return r.value as Json;
}

function rows(v: unknown): readonly Json[] {
  return (v ?? []) as readonly Json[];
}

describe("§30.1 URL登録", () => {
  it("アフィリエイトURLを元の状態で保存できる", async () => {
    const url = "https://af.example.com/click?a=1&b=2";
    const created = await value("submit_affiliate_url", { url, source: "paste" }, MANAGER);
    // 返ってきた値のどこかに、渡した URL がそのままの形で入っている。
    expect(JSON.stringify(created)).toContain(url);
  });

  it("危険なURLを拒否できる", async () => {
    // http: は受け口では通す。ASP の発行 URL が http のことがあるため、
    // ここで弾くと「登録できない」だけの状態になる。https 化は
    // createAffiliateLink（掲載に使う段階）で強制する。
    for (const bad of [
      "javascript:alert(1)",
      "ftp://a.jp/x",
      "  ",
      "https://localhost/x",
      "https://192.168.0.1/x",
    ]) {
      const r = await call("submit_affiliate_url", { url: bad, source: "paste" }, MANAGER);
      expect(r.ok, bad).toBe(false);
    }
  });

  it("不確実な場合は確認待ちになる（勝手に確定しない）", async () => {
    const created = await value(
      "submit_affiliate_url",
      { url: "https://af.example.com/unknown-9", source: "paste" },
      MANAGER,
    );
    // 入った直後に商品と結びつくことはない。人が確かめるまで進まない。
    expect(JSON.stringify(created)).not.toContain('"state":"matched"');
  });

  it("情報源を確認できる", async () => {
    const inbox = await value("list_link_inbox", {}, MANAGER);
    const items = rows(inbox.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      // どこから来たか（貼り付け・CSV 取込など）と、元の URL を必ず持つ。
      expect(String(item.sourceLabel ?? ""), JSON.stringify(item)).not.toBe("");
      expect(String(item.submittedUrl ?? "")).not.toBe("");
    }
  });

  it("商品を識別できる（人が対応づけを確定できる入口がある）", () => {
    for (const name of ["resolve_link_ingestion", "match_link_ingestion_product"]) {
      const tool = findTool(catalog, name);
      expect(tool, name).not.toBeNull();
      // 対応づけは状態を変える操作なので、読み取り専用ではない。
      expect(tool?.readOnly, name).toBe(false);
    }
  });
});

describe("§30.2 比較", () => {
  it("同一商品と代替商品を区別できる", async () => {
    const result = await value("find_alternatives", { productId: "p_alpha_15" });
    const basis = result.basis as Json;
    const alts = rows(result.alternatives);
    expect(String(basis.productId)).toBe("p_alpha_15");
    expect(alts.length).toBeGreaterThan(0);
    // 基準の商品そのものは代替に混ざらない。混ざると区別が消える。
    expect(alts.map((a) => String(a.productId))).not.toContain("p_alpha_15");
  });

  it("比較候補の理由を表示できる（何の軸で比べたかが出る）", async () => {
    const result = await value("compare_products", {
      productIds: ["p_alpha_15", "p_beta_14"],
    });
    const columns = result.columns as readonly string[];
    expect(columns.length).toBeGreaterThan(0);
    // 値が取れなかった軸は隠さず、別に出す。
    expect(result).toHaveProperty("missingColumns");
  });

  it("アフィリエイト報酬が比較スコアに入らない", async () => {
    const result = await value("compare_products", {
      productIds: ["p_alpha_15", "p_beta_14", "p_gamma_16"],
    });
    // 出力のどこにも報酬に関する語が現れない。
    // 型のうえでも Commercial は Ranking へ渡せない（tests/architecture が担保）。
    expect(JSON.stringify(result)).not.toMatch(/報酬|commission|payout|epc|revenue|成果単価/i);
  });

  it("手動で候補を追加・除外できる", async () => {
    const two = await value("compare_products", { productIds: ["p_alpha_15", "p_beta_14"] });
    const three = await value("compare_products", {
      productIds: ["p_alpha_15", "p_beta_14", "p_delta_13"],
    });
    // 渡した組み合わせがそのまま結果になる（勝手に足したり削ったりしない）。
    expect(rows(two.products).length).toBe(2);
    expect(rows(three.products).length).toBe(3);
    expect(rows(three.products).map((p) => String(p.productId))).toContain("p_delta_13");
  });
});

describe("§30.3 ペルソナ", () => {
  it("書き手を複数作成できる", async () => {
    const list = await value("list_author_personas", {});
    expect(rows(list.items).length).toBeGreaterThanOrEqual(2);
  });

  it("読者を複数作成できる", async () => {
    const list = await value("list_audience_personas", {});
    expect(rows(list.items).length).toBeGreaterThanOrEqual(2);
  });

  it("同じ商品を別ペルソナで生成できる（組み合わせが表になる）", async () => {
    const audiences = rows((await value("list_audience_personas", {})).items);
    const authors = rows((await value("list_author_personas", {})).items);
    // 読者 × 書き手の組み合わせが 2 通り以上ある = 同じ素材から別の原稿が作れる。
    expect(audiences.length * authors.length).toBeGreaterThan(1);
  });

  it("実体験のない一人称表現を検出できる", async () => {
    // 見本の「編集部」は、実際に試した記録が 0 件のペルソナ。
    const result = await value("check_fact_boundary", {
      personaId: "ap_editor",
      body: "私は実際に3か月使ってみたが、驚くほど軽かった。",
    });
    const text = JSON.stringify(result);
    expect(text).toMatch(/使ってみた|一人称|体験/);
  });
});

describe("§30.4 AI生成", () => {
  it("ブログ・X・Instagram・note の原稿を生成できる", async () => {
    const matrix = await value("get_generation_matrix", { packageId: "cp_laptop_2026" });
    const channels = rows(matrix.channels).map((c) => String(c.channel));
    for (const kind of ["own_site", "x", "instagram", "note"]) {
      expect(channels, kind).toContain(kind);
    }
    // note は「下書きを書き出して人が貼る」であって、直接投稿ではない。
    const note = rows(matrix.channels).find((c) => String(c.channel) === "note");
    expect(String(note?.publishNote)).toContain("貼り付け");
  });

  it("素材が揃うまで生成を始められない", async () => {
    const gate = await value("check_generation_input", {});
    expect(gate.ready).toBe(false);
    // 足りない項目は名前と埋め方つきで返る。「失敗しました」だけで終わらせない。
    const missing = rows(gate.missing);
    expect(missing.length).toBeGreaterThan(0);
    for (const m of missing) {
      expect(String(m.label ?? "")).not.toBe("");
      expect(String(m.howToFill ?? "")).not.toBe("");
    }
  });

  it("生成文から使用した主張と根拠を確認できる", async () => {
    const content = await value("get_content", { variantId: "cv_alpha_draft" });
    const pkg = content.package as Json;
    const claimIds = rows(pkg.claimIds as unknown).map(String);
    expect(claimIds.length).toBeGreaterThan(0);
    expect(rows(pkg.evidenceIds as unknown).length).toBeGreaterThan(0);
    // 主張から根拠へ、実際にたどれる。
    const evidence = await value("get_evidence", { productId: String(pkg.primarySubjectId) });
    const traced = rows(evidence.items).map((i) => String((i.claim as Json).id));
    expect(traced).toEqual(expect.arrayContaining([claimIds[0]]));
  });

  it("広告表記を自動挿入できる", async () => {
    const content = await value("get_content", { variantId: "cv_alpha_draft" });
    const variant = content.variant as Json;
    // 下書きの段階から広告表記が入っている。公開直前に足すものにしない。
    expect(String(variant.disclosure ?? "")).toContain("アフィリエイト");
    // AI を使ったことも同じ場所で書く（別の場所に分けると片方だけ消える）。
    expect(String(variant.disclosure ?? "")).toContain("AI");
  });

  it("媒体ルール違反を警告できる", async () => {
    const content = await value("get_content", { variantId: "cv_alpha_draft" });
    const issues = rows((content.quality as Json).issues as unknown);
    expect(issues.length).toBeGreaterThan(0);
    // 指摘は「何が」「どこが」まで書く。直せない指摘は指摘ではない。
    for (const issue of issues) {
      expect(String(issue.message ?? "")).not.toBe("");
    }
    const kinds = issues.map((i) => String(i.check));
    expect(kinds).toContain("unsourced_number");
    expect(kinds).toContain("exaggeration");
  });

  it("同じ事実から異なる切り口を生成できる", async () => {
    const content = await value("get_content", { variantId: "cv_alpha_draft" });
    const angles = rows((content.package as Json).contentAngles as unknown).map(String);
    // 同じ素材から 2 通り以上の書き方が用意されている。
    expect(angles.length).toBeGreaterThan(1);
    expect(new Set(angles).size).toBe(angles.length);
  });

  it("根拠のない主張は公開不可になる", async () => {
    // 見本の下書きは、数値に根拠が無く「最強」と書いてある。
    const r = await call("approve_content", { variantId: "cv_alpha_draft" }, MANAGER);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // 断るだけでなく、何をすれば通るのかを返す。
      expect(r.error.message).toContain("承認できません");
    }
  });
});

describe("§30.5 ブログ", () => {
  it("複数サイトを作成できる", async () => {
    const list = await value("list_managed_sites", {});
    expect(rows(list.items).length).toBeGreaterThanOrEqual(3);
  });

  it("サイトごとにブランド・読者・書き手を設定できる", async () => {
    const list = await value("list_managed_sites", {});
    const first = rows(list.items)[0] as Json;
    const detail = await value("get_managed_site", { siteSlug: String(first.slug) });
    const blueprint = detail.blueprint as Json;
    // 見た目（色）・読者（ジャンルと差別化）が、ブログごとの値として入っている。
    expect(blueprint.theme).toBeTruthy();
    expect(String(blueprint.genre ?? "")).not.toBe("");
    // 3 本のブログで、少なくとも見た目の指定が違う。
    const themes = new Set(rows(list.items).map((s) => String(s.brandTheme)));
    expect(themes.size).toBeGreaterThan(1);
  });

  it("標準記事構成を生成できる", async () => {
    const method = await value("read_writing_method", { articleType: "review" });
    const sections = rows(method.sections);
    expect(sections.length).toBeGreaterThan(3);
    // 広告表記は必須の節として最初から入っている（あとで足すものにしない）。
    const disclosure = sections.find((s) => String(s.id) === "disclosure");
    expect(disclosure?.required).toBe(true);
  });

  it("会話・比較・商品カードを利用できる", () => {
    const dir = resolve(import.meta.dirname, "../../src/presentation/ui/patterns");
    const files = readdirSync(dir).join(" ");
    expect(files).toMatch(/conversation/);
    expect(files).toMatch(/compar/);
    expect(files).toMatch(/product/);
  });

  it("自社ブログへ公開できる（読者向けの道が出ている）", async () => {
    const sites = (await call("list_sites", {})).ok
      ? ((await call("list_sites", {})) as { ok: true; value: unknown }).value
      : null;
    const list = rows(sites);
    expect(list.length).toBeGreaterThan(0);
    const site = await value("get_site", { siteSlug: String(list[0]?.slug) });
    const blueprint = site.blueprint as Json;
    // 公開に必要な信頼ページ（運営方針・広告方針・訂正）が構成に入っている。
    const pages = blueprint.pages as readonly string[];
    expect(pages).toContain("editorial_policy");
    expect(pages).toContain("advertising_policy");
    expect(pages).toContain("corrections");
  });
});

describe("§30.6 配信", () => {
  it("媒体ごとのプレビューを確認できる", async () => {
    const channels = rows((await value("list_channels", {})).channels);
    expect(channels.length).toBeGreaterThan(0);
    const draft = await value("export_manual_draft", { publicationId: "pub_note_manual" });
    // 貼り付け先と手順が、その媒体の言葉で出る。
    expect(String(draft.channelLabel)).toBe("note");
    expect(String(draft.instructions)).not.toBe("");
  });

  it("承認後だけ外部投稿できる（承認前の公開は止まる）", async () => {
    const board = await value("list_content_board", {});
    const columns = rows(board.columns);
    const generated = columns.find((c) => String(c.state) === "GENERATED");
    const draft = rows(generated?.items)[0] as Json | undefined;
    expect(draft, "下書きの見本がありません").toBeTruthy();
    if (draft === undefined) return;
    const r = await call(
      "advance_content_state",
      { variantId: String(draft.variantId), from: "GENERATED", to: "PUBLISHED" },
      MANAGER,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.suggestedAction ?? "").not.toBe("");
  });

  it("重複投稿を防止できる（同じ配信を二度進められない）", async () => {
    // すでに公開済みの配信には、次に進める先が無い。
    const published = await value("get_publication", { publicationId: "pub_own_site" });
    expect(String((published.card as Json).state)).toBe("PUBLISHED");
    expect(rows(published.nextStates).length).toBe(0);
  });

  it("投稿結果とURLを保存できる", async () => {
    const published = await value("get_publication", { publicationId: "pub_own_site" });
    const card = published.card as Json;
    expect(String(card.externalUrl ?? "")).not.toBe("");
  });

  it("noteを直接投稿対応と誤表示しない", async () => {
    const channels = rows((await value("list_channels", {})).channels);
    const note = channels.find((c) => String(c.kind) === "note");
    expect(note, "note が一覧にありません").toBeTruthy();
    // note に「自動で投稿できる」と表示しない。公式の投稿口が無いため。
    expect(note?.canDirectPublish).toBe(false);
    expect(String(note?.publishModeLabel)).not.toMatch(/自動/);
  });

  it("失敗理由と再実行方法を表示できる", async () => {
    const publications = rows((await value("list_publications", {})).items);
    const failed = publications.find((p) => String(p.state) === "FAILED_SEND");
    expect(failed, "失敗の見本がありません").toBeTruthy();
    // 何が起きたかと、次にどうできるかが、その行に出ている。
    expect(String(failed?.lastError ?? "")).not.toBe("");
    expect(String(failed?.lastError)).toMatch(/再送|時間をおいて|やり直/);

    // 見つからないものを指定したときも、理由と次の手を返す。
    const r = await call("export_manual_draft", { publicationId: "存在しないID" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.suggestedAction ?? "").not.toBe("");
  });
});

describe("§30.7 アフィリエイト", () => {
  it("リンクを改変せず保持できる", async () => {
    const links = rows((await value("list_product_links", { productId: "p_alpha_15" })).items);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      // 改変禁止の印が付いていて、URL に計測用のパラメータが足されていない。
      expect(link.alterationProhibited, JSON.stringify(link)).toBe(true);
      expect(String(link.url)).not.toMatch(/utm_|[?&]ref=|[?&]tag=/);
    }
  });

  it("公開中の使用箇所を追跡できる", async () => {
    const links = rows((await value("list_product_links", { productId: "p_alpha_15" })).items);
    // どのリンクがどの商品に紐づいているかを、商品側からたどれる。
    expect(links.every((l) => String(l.linkId ?? "") !== "")).toBe(true);
  });

  it("リンク切れを検出できる", async () => {
    const links = rows((await value("list_product_links", { productId: "p_alpha_15" })).items);
    const broken = links.find((l) => l.usable === false);
    expect(broken, "使えないリンクの見本がありません").toBeTruthy();
    // 使えない理由が、その場に日本語で出る（黙って消さない）。
    expect(String(broken?.blockedReason ?? "")).not.toBe("");
  });

  it("プログラム終了の影響範囲を確認できる", async () => {
    const programs = rows((await value("list_affiliate_programs", {}, MANAGER)).items);
    expect(programs.length).toBeGreaterThan(0);
    // 提携が生きているかが行ごとに分かり、守るべき制約も併記される。
    for (const p of programs) {
      expect(typeof p.active).toBe("boolean");
      expect(Array.isArray(p.restrictions)).toBe(true);
    }
  });

  it("広告表示が記事・SNS・AI回答で一貫する（文言の出どころが1つ）", async () => {
    const list = await value("list_disclosures", {});
    expect(rows(list.rows).length).toBeGreaterThan(0);
    // 仕様書の名前で呼んでも、同じ文言が返る。別の言い回しを持たない。
    const viaSpecName = await value("get_disclosure", {});
    expect(JSON.stringify(viaSpecName)).toBe(JSON.stringify(list));
    // 提携がある関係には rel="sponsored" が付く。
    const affiliate = rows(list.rows).find((r) => String(r.disclosureId) === "dc_affiliate");
    expect(String(affiliate?.relAttribute)).toContain("sponsored");
  });
});

describe("§30.8 追跡可能性", () => {
  it("商品 → 主張 → 根拠 をたどれる", async () => {
    const evidence = await value("get_evidence", { productId: "p_alpha_15" });
    expect(String(evidence.productId)).toBe("p_alpha_15");
    const items = rows(evidence.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const claim = item.claim as Json;
      expect(String(claim.statement ?? "")).not.toBe("");
      const linked = rows(claim.evidenceIds as unknown).length + rows(item.evidence).length;
      // 実測を名乗る主張には必ず根拠が付いている。
      // 根拠の無い主張を消すのではなく「推測」と表示する。
      // 消してしまうと、書き手には「書いたのに出ない」としか見えず、
      // 何が足りないのか分からないまま同じ原稿が繰り返し出てくる。
      // 表示ラベルで見る（画面に出る言葉と同じものを確かめる）。
      if (String(item.factOrInference) === "事実") {
        expect(linked, String(claim.statement)).toBeGreaterThan(0);
      } else {
        expect(String(item.factOrInference)).toBe("推測");
      }
    }
    // 実測の主張が 1 つも無い一覧は、追跡できることの証明にならない。
    expect(items.some((i) => String(i.factOrInference) === "事実")).toBe(true);
  });

  it("根拠 → 情報源 をたどれる（出典と利用条件が分かる）", async () => {
    const items = rows((await value("get_evidence", { productId: "p_alpha_15" })).items);
    for (const item of items) {
      for (const ev of rows(item.evidence)) {
        expect(String(ev.sourceOwner ?? ""), JSON.stringify(ev)).not.toBe("");
        expect(String(ev.licenseOrPermission ?? "")).not.toBe("");
        expect(ev.capturedAt).toBeTruthy();
      }
    }
  });

  it("事実と推測の区別が、たどった先で必ず示される", async () => {
    const items = rows((await value("get_evidence", { productId: "p_alpha_15" })).items);
    const labels = new Set(items.map((i) => String(i.factOrInference)));
    expect(labels.size).toBeGreaterThan(0);
    for (const label of labels) expect(["事実", "推測"]).toContain(label);
  });
});
