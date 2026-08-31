import type { BlogAppearancePort } from "@/application/ports/blog-appearance";
import {
  BLOG_TEMPLATE_IDS,
  type BlogTemplateId,
  type BlogTheme,
  type PageThemeOverride,
  resolvePageTheme,
} from "@/domain/authoring/blog-template";
import {
  parseBrandTheme as parseBrandThemeValue,
  parseColorMode as parseColorModeValue,
} from "@/domain/authoring/appearance";
import { normalizePagePath } from "@/domain/authoring/page-path";
import { requireCapability } from "@/domain/identity";
import { DEFAULT_THEME } from "@/domain/authoring/site-blueprint";
import {
  type ActorContext,
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * ブログの見た目（テンプレート・配色 2 層）を画面から決める。
 *
 * --- 監査記録を書かない理由 ---
 * 隣の `manage-guideline-references` は 1 操作ずつ `audit_log` へ残すが、
 * ここは残さない。あちらが残すのは、出典が
 * **規制対応で「何を根拠にそう決めたか」を問われる証跡**だからである。
 * 配色とテンプレートは読者の目に映るだけで、法令上の主張を 1 つも含まない。
 * 何でも記録すると、本当に読む必要がある行が薄まる。
 *
 * --- 解決順をここに書かない ---
 * ページに効く配色の決め方は `resolvePageTheme`（ドメイン）ただ 1 つである。
 * この層は保存先から 2 つの層を読んで渡すだけにする。
 * 写しを持つと、優先順を変えた日に片方だけ古い順で解決し続ける。
 *
 * --- 画面へ出す言葉は「ブログの見せ方」 ---
 * コードの中では `template` と呼ぶが、利用者へ出す文では使わない。
 * 用語辞書（`docs/architecture/ubiquitous-language.md`）が
 * 「テンプレート（ブログ全体の意味で）」を禁じており、`tests/ui/copy-dictionary.test.ts`
 * が機械的に見ている。辞書を直したくなったら**先に辞書を直す**こと
 * （この仕事の write scope に辞書は入っていない）。
 *
 * --- 権限 ---
 * 読み取りは `content.read`（記事を書く人が今の見た目を知るため）。
 * 変更は `site.manage`（サイトの見せ方を決める人の操作）。
 */

export type ManageBlogAppearanceDeps = {
  readonly appearance: BlogAppearancePort;
};

export type ManageBlogAppearanceInput =
  | { readonly action: "read"; readonly siteSlug: string; readonly pagePath?: string }
  | {
      readonly action: "select_template";
      readonly siteSlug: string;
      readonly templateId: string;
    }
  | {
      readonly action: "save_theme";
      readonly siteSlug: string;
      readonly brandTheme: string;
      readonly colorMode: string;
    }
  | {
      readonly action: "save_override";
      readonly siteSlug: string;
      readonly pagePath: string;
      /** 空文字は「この軸は上書きしない」。未指定と同じ意味へ写す。 */
      readonly brandTheme?: string;
      readonly colorMode?: string;
    }
  | { readonly action: "clear_override"; readonly siteSlug: string; readonly pagePath: string };

export type BlogAppearanceView = {
  readonly siteSlug: string;
  /** 選んでいなければ `null`。既定で埋めない（明示の選択と区別する）。 */
  readonly templateId: BlogTemplateId | null;
  /** ブログ既定。未設定なら設計図の既定。 */
  readonly blogTheme: BlogTheme;
  /** 上書きしているページだけ。 */
  readonly overrides: readonly {
    readonly pagePath: string;
    readonly override: PageThemeOverride;
  }[];
  /**
   * `pagePath` を渡したときだけ、そのページに**実際に効く**配色。
   * 画面はこの値を出すだけでよく、自分で優先順を組まない。
   */
  readonly effective?: BlogTheme;
};

function validateBrandTheme(raw: string): Result<string, DomainError> {
  const parsed = parseBrandThemeValue(raw);
  return parsed !== null
    ? ok(parsed)
    : err(validationError("配色は用意されているものから選んでください。", "brandTheme"));
}

function validateColorMode(raw: string): Result<BlogTheme["colorMode"], DomainError> {
  const parsed = parseColorModeValue(raw);
  return parsed !== null
    ? ok(parsed)
    : err(validationError("明暗は自動・明るい・暗いから選んでください。", "colorMode"));
}

/** 設計図の既定。ブログ既定の行が無いときの土台になる。 */
function blueprintDefaultTheme(): BlogTheme {
  return { brandTheme: DEFAULT_THEME.brandTheme, colorMode: DEFAULT_THEME.colorScheme };
}

export function createManageBlogAppearanceUseCase(
  deps: ManageBlogAppearanceDeps,
): UseCase<ManageBlogAppearanceInput, BlogAppearanceView> {
  const { appearance } = deps;

  /** 変更のあとは必ず読み直して返す。画面が自前で状態を継ぎ足さない。 */
  async function view(
    workspaceId: ActorContext["workspaceId"],
    siteSlug: string,
    pagePath?: string,
  ): Promise<Result<BlogAppearanceView, DomainError>> {
    const template = await appearance.templateOf({ workspaceId, siteSlug });
    if (!template.ok) return template;
    const theme = await appearance.themeOf({ workspaceId, siteSlug });
    if (!theme.ok) return theme;
    const overrides = await appearance.listOverrides({ workspaceId, siteSlug });
    if (!overrides.ok) return overrides;

    const blogTheme = theme.value ?? blueprintDefaultTheme();
    if (pagePath === undefined) {
      return ok({
        siteSlug,
        templateId: template.value,
        blogTheme,
        overrides: overrides.value,
      });
    }

    const path = normalizePagePath(pagePath);
    const one = overrides.value.find((o) => o.pagePath === path);
    return ok({
      siteSlug,
      templateId: template.value,
      blogTheme,
      overrides: overrides.value,
      // 優先順はドメイン関数 1 本。ここで `??` を並べ直さない。
      effective: resolvePageTheme(blogTheme, one?.override ?? null),
    });
  }

  return {
    async execute(
      actor: ActorContext,
      input: ManageBlogAppearanceInput,
    ): Promise<Result<BlogAppearanceView, DomainError>> {
      const allowed = requireCapability(
        actor,
        input.action === "read" ? "content.read" : "site.manage",
        "ブログの見た目の設定",
      );
      if (!allowed.ok) return allowed;

      const workspaceId = actor.workspaceId;

      if (input.action === "select_template") {
        if (!(BLOG_TEMPLATE_IDS as readonly string[]).includes(input.templateId)) {
          return err(
            validationError("ブログの見せ方は 6 種から選んでください。", "templateId"),
          );
        }
        const saved = await appearance.selectTemplate({
          workspaceId,
          siteSlug: input.siteSlug,
          templateId: input.templateId as BlogTemplateId,
        });
        if (!saved.ok) return saved;
        return view(workspaceId, input.siteSlug);
      }

      if (input.action === "save_theme") {
        const brandTheme = validateBrandTheme(input.brandTheme);
        if (!brandTheme.ok) return brandTheme;
        const colorMode = validateColorMode(input.colorMode);
        if (!colorMode.ok) return colorMode;

        const saved = await appearance.saveTheme({
          workspaceId,
          siteSlug: input.siteSlug,
          theme: { brandTheme: brandTheme.value, colorMode: colorMode.value },
        });
        if (!saved.ok) return saved;
        return view(workspaceId, input.siteSlug);
      }

      if (input.action === "save_override") {
        /*
          空文字は「この軸は上書きしない」。未指定と同じ扱いへ寄せる。
          画面の <select> は「既定のまま」を空の option で表すのが自然で、
          そこを検証エラーにすると、既定へ戻す操作ができなくなる。
        */
        const override: { brandTheme?: string; colorMode?: BlogTheme["colorMode"] } = {};
        if (input.brandTheme !== undefined && input.brandTheme !== "") {
          const parsed = validateBrandTheme(input.brandTheme);
          if (!parsed.ok) return parsed;
          override.brandTheme = parsed.value;
        }
        if (input.colorMode !== undefined && input.colorMode !== "") {
          const parsed = validateColorMode(input.colorMode);
          if (!parsed.ok) return parsed;
          override.colorMode = parsed.value;
        }

        const path = normalizePagePath(input.pagePath);
        // 両軸とも空なら保存先が削除へ倒す（不変条件 I2）。ここでは分岐しない。
        const saved = await appearance.saveOverride({
          workspaceId,
          siteSlug: input.siteSlug,
          pagePath: path,
          override,
        });
        if (!saved.ok) return saved;
        return view(workspaceId, input.siteSlug, path);
      }

      if (input.action === "clear_override") {
        const path = normalizePagePath(input.pagePath);
        const cleared = await appearance.clearOverride({
          workspaceId,
          siteSlug: input.siteSlug,
          pagePath: path,
        });
        if (!cleared.ok) return cleared;
        return view(workspaceId, input.siteSlug, path);
      }

      return view(workspaceId, input.siteSlug, input.pagePath);
    },
  };
}
