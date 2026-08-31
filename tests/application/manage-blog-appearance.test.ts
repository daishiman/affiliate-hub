/**
 * @tier 1
 * @req REQ-UX01, REQ-P07
 * @types decision-table, equivalence, boundary
 *
 * ブログの見た目（テンプレート・配色 2 層）を決めるユースケース。
 *
 * --- ここで何を固定するか ---
 *
 * このユースケースは「保存口を呼ぶだけ」に見えるが、**保存口へ渡す前に
 * 意味を確定させている**場所が 4 つある。そこが崩れると、保存先の型は
 * 通ったまま画面の意味だけが変わる。
 *
 * 1. 権限の振り分け — 読むのは `content.read`、変えるのは `site.manage`。
 *    片方に寄せると「記事を書く人が配色を変えられる」か
 *    「記事を書く人が今の配色を見られない」のどちらかになる
 * 2. 空文字の写し先 — 上書きの空文字は「この軸は上書きしない」。
 *    検証エラーにすると、既定へ戻す操作が画面からできなくなる
 * 3. 経路の正規化 — `blog/` と `/blog` と `/blog/` は同じページを指す
 * 4. 既定で埋めない — テンプレート未選択は `null` のまま返す。
 *    埋めると「既定のまま」と「既定を明示的に選んだ」が区別できなくなる
 *
 * **効いている配色の優先順はここでは見ない。**それは `resolvePageTheme`
 * （ドメイン）1 本の担当で、このユースケースは渡すだけである。ここで
 * 優先順を確かめると、写しを持ってよいという合図になる。
 */
import { describe, expect, it } from "vitest";
import type { BlogAppearancePort } from "@/application/ports/blog-appearance";
import { createManageBlogAppearanceUseCase } from "@/application/usecases/authoring/manage-blog-appearance";
import type {
  BlogTemplateId,
  BlogTheme,
  PageThemeOverride,
} from "@/domain/authoring/blog-template";
import { type ActorContext, domainError, err, ok } from "@/domain/shared";
import { taggedString } from "@/domain/shared/tagged";
import { NOW } from "../support/clock";
import { recordingAuditLog } from "../support/doubles";
import { sequentialIds } from "../support/blog-ops-fake";
import { createUnavailableAuditLog } from "@/infrastructure/persistence/sample/audit-log-sample-repository";

/**
 * 記録の置き場と時計。**見た目の変更も 1 操作ずつ `audit_log` へ残す**ので、
 * ユースケースを組むにはこの 3 つが要る（2026-08-31 に足した）。
 */
function auditParts() {
  const audit = recordingAuditLog();
  return { audit, deps: { auditLog: audit.port, ids: sequentialIds(), now: () => NOW } };
}

/** 見た目を決められる人。`site.manage` を持つ。 */
const manager: ActorContext = {
  userId: taggedString("user_manager"),
  workspaceId: taggedString("ws_test"),
  roles: ["owner"],
  scopedBrandIds: [],
  isAiServiceAccount: false,
  identified: true,
};

/** 記事を書く人。`content.read` はあるが `site.manage` は無い。 */
const writer: ActorContext = { ...manager, userId: taggedString("user_writer"), roles: ["writer"] };

type Store = {
  templateId: BlogTemplateId | null;
  theme: BlogTheme | null;
  overrides: { pagePath: string; override: PageThemeOverride }[];
};

/** 呼ばれた口と引数を残す差し替え。保存先の代わりに素の連想配列を持つ。 */
function fakePort(initial: Partial<Store> = {}) {
  const store: Store = {
    templateId: initial.templateId ?? null,
    theme: initial.theme ?? null,
    overrides: initial.overrides ?? [],
  };
  const calls: { op: string; arg: unknown }[] = [];

  const port: BlogAppearancePort = {
    async templateOf() {
      calls.push({ op: "templateOf", arg: null });
      return ok(store.templateId);
    },
    async saveTemplate(input) {
      calls.push({ op: "saveTemplate", arg: input });
      store.templateId = input.templateId;
      return ok(input.templateId);
    },
    async themeOf() {
      calls.push({ op: "themeOf", arg: null });
      return ok(store.theme);
    },
    async saveTheme(input) {
      calls.push({ op: "saveTheme", arg: input });
      store.theme = input.theme;
      return ok(input.theme);
    },
    async listOverrides() {
      calls.push({ op: "listOverrides", arg: null });
      return ok(store.overrides);
    },
    async overrideOf(input) {
      calls.push({ op: "overrideOf", arg: input });
      return ok(store.overrides.find((o) => o.pagePath === input.pagePath)?.override ?? null);
    },
    async saveOverride(input) {
      calls.push({ op: "saveOverride", arg: input });
      const empty = input.override.brandTheme === undefined && input.override.colorMode === undefined;
      store.overrides = store.overrides.filter((o) => o.pagePath !== input.pagePath);
      // 両軸とも空なら保存せず消す（不変条件 I2）。保存口の責務をここでも再現する。
      if (empty) return ok(null);
      store.overrides = [...store.overrides, { pagePath: input.pagePath, override: input.override }];
      return ok(input.override);
    },
    async clearOverride(input) {
      calls.push({ op: "clearOverride", arg: input });
      store.overrides = store.overrides.filter((o) => o.pagePath !== input.pagePath);
      return ok(undefined);
    },
  };

  return { port, store, calls, opsOf: () => calls.map((c) => c.op) };
}

function useCaseWith(initial: Partial<Store> = {}) {
  const fake = fakePort(initial);
  const { audit, deps } = auditParts();
  return {
    ...fake,
    audit,
    uc: createManageBlogAppearanceUseCase({ appearance: fake.port, ...deps }),
  };
}

describe("ブログの見た目 — 権限の振り分け", () => {
  it("読むだけなら記事を書く人でも通る", async () => {
    const { uc } = useCaseWith();
    const result = await uc.execute(writer, { action: "read", siteSlug: "blog" });

    expect(result.ok).toBe(true);
  });

  it.each([
    { action: "select_template", siteSlug: "blog", templateId: "minimal" },
    { action: "save_theme", siteSlug: "blog", brandTheme: "blue", colorMode: "dark" },
    { action: "save_override", siteSlug: "blog", pagePath: "/about", brandTheme: "blue" },
    { action: "clear_override", siteSlug: "blog", pagePath: "/about" },
  ] as const)("$action は site.manage が無いと断られ、保存口を 1 度も呼ばない", async (input) => {
    const { uc, opsOf } = useCaseWith();
    const result = await uc.execute(writer, input);

    expect(result.ok).toBe(false);
    // 断ったのに書き込みが走っていたら、権限の検査は名ばかりになる。
    expect(opsOf()).toEqual([]);
  });
});

describe("ブログの見た目 — テンプレートを選ぶ", () => {
  it("6 種のどれかなら保存し、選んだものを返す", async () => {
    const { uc, store } = useCaseWith();
    const result = await uc.execute(manager, {
      action: "select_template",
      siteSlug: "blog",
      templateId: "gadget",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.templateId).toBe("gadget");
    expect(store.templateId).toBe("gadget");
  });

  it("6 種に無い名前は断り、保存口へ届かない", async () => {
    const { uc, opsOf } = useCaseWith();
    const result = await uc.execute(manager, {
      action: "select_template",
      siteSlug: "blog",
      templateId: "sparkle",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("templateId");
    expect(opsOf()).toEqual([]);
  });

  it("選んでいなければ null のまま返す。既定で埋めない", async () => {
    const { uc } = useCaseWith();
    const result = await uc.execute(manager, { action: "read", siteSlug: "blog" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ここを既定値で埋めると、既定を変えた日に明示的に選んだブログまで動く。
    expect(result.value.templateId).toBeNull();
  });
});

describe("ブログの見た目 — ブログ既定の配色", () => {
  it("配色と明暗が語彙どおりなら保存する", async () => {
    const { uc, store } = useCaseWith();
    const result = await uc.execute(manager, {
      action: "save_theme",
      siteSlug: "blog",
      brandTheme: "indigo-teal",
      colorMode: "light",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.blogTheme).toEqual({ brandTheme: "indigo-teal", colorMode: "light" });
    expect(store.theme).toEqual({ brandTheme: "indigo-teal", colorMode: "light" });
  });

  it.each([
    { brandTheme: "chartreuse", colorMode: "dark", field: "brandTheme" },
    { brandTheme: "blue", colorMode: "sepia", field: "colorMode" },
  ])("語彙に無い $field は断り、保存口へ届かない", async ({ brandTheme, colorMode, field }) => {
    const { uc, opsOf } = useCaseWith();
    const result = await uc.execute(manager, {
      action: "save_theme",
      siteSlug: "blog",
      brandTheme,
      colorMode,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe(field);
    expect(opsOf()).toEqual([]);
  });

  it("ブログ既定の行が無ければ設計図の既定を土台にする", async () => {
    const { uc } = useCaseWith();
    const result = await uc.execute(manager, { action: "read", siteSlug: "blog" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 画面が色無しで出ることは無い。土台は必ず 1 組決まる。
    expect(result.value.blogTheme).toEqual({ brandTheme: "graphite-amber", colorMode: "auto" });
  });
});

describe("ブログの見た目 — ページ上書き", () => {
  it("片軸だけの上書きを保存できる", async () => {
    const { uc, store } = useCaseWith({ theme: { brandTheme: "blue", colorMode: "light" } });
    const result = await uc.execute(manager, {
      action: "save_override",
      siteSlug: "blog",
      pagePath: "/about",
      colorMode: "dark",
    });

    expect(result.ok).toBe(true);
    expect(store.overrides).toEqual([{ pagePath: "/about", override: { colorMode: "dark" } }]);
  });

  it("空文字は「この軸は上書きしない」。検証エラーにしない", async () => {
    const { uc, calls } = useCaseWith();
    const result = await uc.execute(manager, {
      action: "save_override",
      siteSlug: "blog",
      pagePath: "/about",
      brandTheme: "",
      colorMode: "dark",
    });

    expect(result.ok).toBe(true);
    const saved = calls.find((c) => c.op === "saveOverride")?.arg as
      | { override: PageThemeOverride }
      | undefined;
    // 空文字を "" のまま渡すと、保存先に「空の配色」という行ができる。
    expect(saved?.override).toEqual({ colorMode: "dark" });
  });

  it("両軸とも空なら、保存口は行を消す側へ倒す（不変条件 I2）", async () => {
    const { uc, store, calls } = useCaseWith({
      overrides: [{ pagePath: "/about", override: { colorMode: "dark" } }],
    });
    const result = await uc.execute(manager, {
      action: "save_override",
      siteSlug: "blog",
      pagePath: "/about",
      brandTheme: "",
      colorMode: "",
    });

    expect(result.ok).toBe(true);
    // ユースケース側では分岐しない。空の上書きをそのまま渡す。
    const saved = calls.find((c) => c.op === "saveOverride")?.arg as
      | { override: PageThemeOverride }
      | undefined;
    expect(saved?.override).toEqual({});
    expect(store.overrides).toEqual([]);
  });

  it.each([
    { raw: "about", normalized: "/about" },
    { raw: "/about/", normalized: "/about" },
    { raw: "  /about  ", normalized: "/about" },
    { raw: "", normalized: "/" },
    { raw: "/", normalized: "/" },
  ])("経路 '$raw' は '$normalized' として保存する", async ({ raw, normalized }) => {
    const { uc, store } = useCaseWith();
    const result = await uc.execute(manager, {
      action: "save_override",
      siteSlug: "blog",
      pagePath: raw,
      colorMode: "dark",
    });

    expect(result.ok).toBe(true);
    expect(store.overrides.map((o) => o.pagePath)).toEqual([normalized]);
  });

  it("語彙に無い上書きは断り、保存口へ届かない", async () => {
    const { uc, opsOf } = useCaseWith();
    const result = await uc.execute(manager, {
      action: "save_override",
      siteSlug: "blog",
      pagePath: "/about",
      brandTheme: "chartreuse",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("brandTheme");
    expect(opsOf()).toEqual([]);
  });

  it("上書きを外すと行が消え、効く配色はブログ既定へ戻る", async () => {
    const { uc, store } = useCaseWith({
      theme: { brandTheme: "blue", colorMode: "light" },
      overrides: [{ pagePath: "/about", override: { colorMode: "dark" } }],
    });
    const result = await uc.execute(manager, {
      action: "clear_override",
      siteSlug: "blog",
      pagePath: "about",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.overrides).toEqual([]);
    expect(result.value.effective).toEqual({ brandTheme: "blue", colorMode: "light" });
  });

  it("上書きしていないページは一覧に出さない", async () => {
    const { uc } = useCaseWith({
      overrides: [{ pagePath: "/about", override: { colorMode: "dark" } }],
    });
    const result = await uc.execute(manager, { action: "read", siteSlug: "blog" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.overrides.map((o) => o.pagePath)).toEqual(["/about"]);
  });
});

describe("ブログの見た目 — 効いている配色を返す条件", () => {
  it("経路を渡さなければ effective を組み立てない", async () => {
    const { uc } = useCaseWith({ theme: { brandTheme: "blue", colorMode: "light" } });
    const result = await uc.execute(manager, { action: "read", siteSlug: "blog" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 画面が要らないものを組み立てると、どちらを見ればよいかが割れる。
    expect(result.value.effective).toBeUndefined();
  });

  it("経路を渡せば、その経路に効く 1 組を返す", async () => {
    const { uc } = useCaseWith({
      theme: { brandTheme: "blue", colorMode: "light" },
      overrides: [{ pagePath: "/about", override: { colorMode: "dark" } }],
    });
    const result = await uc.execute(manager, {
      action: "read",
      siteSlug: "blog",
      pagePath: "/about",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 上書きしていない軸はブログ既定が残る（優先順の担当は resolvePageTheme）。
    expect(result.value.effective).toEqual({ brandTheme: "blue", colorMode: "dark" });
  });

  it("上書きの無い経路を渡しても、ブログ既定がそのまま効く", async () => {
    const { uc } = useCaseWith({
      theme: { brandTheme: "blue", colorMode: "light" },
      overrides: [{ pagePath: "/about", override: { colorMode: "dark" } }],
    });
    const result = await uc.execute(manager, {
      action: "read",
      siteSlug: "blog",
      pagePath: "/contact",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.effective).toEqual({ brandTheme: "blue", colorMode: "light" });
  });
});

describe("ブログの見た目 — 保存先が落ちているとき", () => {
  it.each(["templateOf", "themeOf", "listOverrides"] as const)(
    "読み直しの %s が落ちたら、その失敗を返す",
    async (failing) => {
      const fake = fakePort();
      const broken: BlogAppearancePort = {
        ...fake.port,
        [failing]: async () => err(domainError("UPSTREAM_UNAVAILABLE", "保存先が落ちています")),
      };
      const uc = createManageBlogAppearanceUseCase({ appearance: broken, ...auditParts().deps });
      const result = await uc.execute(manager, { action: "read", siteSlug: "blog" });

      // 読めなかったものを「0 件」として返すと、画面には
      // 「まだ何も設定していません」と出る。落ちていることは出ない。
      expect(result.ok).toBe(false);
    },
  );

  it("保存が落ちたら読み直さず、その失敗を返す", async () => {
    const fake = fakePort();
    const broken: BlogAppearancePort = {
      ...fake.port,
      async saveTheme() {
        return err(domainError("UPSTREAM_UNAVAILABLE", "書き込めません"));
      },
    };
    const uc = createManageBlogAppearanceUseCase({ appearance: broken, ...auditParts().deps });
    const result = await uc.execute(manager, {
      action: "save_theme",
      siteSlug: "blog",
      brandTheme: "blue",
      colorMode: "dark",
    });

    expect(result.ok).toBe(false);
    // 書けていないのに読み直した値を返すと、画面は「保存できた」と読む。
    expect(fake.opsOf()).toEqual([]);
  });
});

/**
 * 見た目の変更を記録へ残す（2026-08-31 に足した）。
 *
 * 見た目は**上書きで消える設定**である。変える前の値はどこにも残らないので、
 * 「いつから見え方が変わったか」を言えるのは `audit_log` だけになる。
 */
describe("ブログの見た目 — 操作の記録", () => {
  it.each([
    [
      { action: "select_template", siteSlug: "blog", templateId: "howto" } as const,
      "blog_appearance",
      "blog",
    ],
    [
      { action: "save_theme", siteSlug: "blog", brandTheme: "blue", colorMode: "dark" } as const,
      "blog_appearance",
      "blog",
    ],
    [
      { action: "save_override", siteSlug: "blog", pagePath: "/about", brandTheme: "blue" } as const,
      "blog_page_appearance",
      "blog/about",
    ],
    [
      { action: "clear_override", siteSlug: "blog", pagePath: "/about" } as const,
      "blog_page_appearance",
      "blog/about",
    ],
  ])("%o を 1 行残す", async (input, targetType, targetId) => {
    const { uc, audit } = useCaseWith();
    const result = await uc.execute(manager, input);

    expect(result.ok).toBe(true);
    expect(audit.actions()).toEqual(["blog_appearance.changed"]);
    const [entry] = audit.entries();
    expect(entry?.targetType).toBe(targetType);
    expect(entry?.targetId).toBe(targetId);
  });

  it("読むだけでは何も残さない", async () => {
    const { uc, audit } = useCaseWith();
    await uc.execute(writer, { action: "read", siteSlug: "blog" });

    expect(audit.entries()).toHaveLength(0);
  });

  it("上書きを外したことは、`after` に `override: null` として残す", async () => {
    const { uc, audit } = useCaseWith({
      overrides: [{ pagePath: "/about", override: { brandTheme: "blue" } }],
    });
    await uc.execute(manager, { action: "clear_override", siteSlug: "blog", pagePath: "/about" });

    // 行ごと消えるので、消えたことは差分からは読めない。明示して残す。
    expect(audit.entries()[0]?.after).toMatchObject({ pagePath: "/about", override: null });
  });

  it("記録が書けなかったら「変えました」で終わらせない", async () => {
    const fake = fakePort();
    const uc = createManageBlogAppearanceUseCase({
      appearance: fake.port,
      auditLog: createUnavailableAuditLog(),
      ids: sequentialIds(),
      now: () => NOW,
    });
    const result = await uc.execute(manager, {
      action: "save_theme",
      siteSlug: "blog",
      brandTheme: "blue",
      colorMode: "dark",
    });

    // **保存は取り消さない。**取り消すと、押した人には「効かなかった」に見えるのに
    // 保存先には残っている、という別の食い違いを作る。
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(fake.store.theme).not.toBeNull();
  });
});
