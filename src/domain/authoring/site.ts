import {
  type BrandId,
  type DomainError,
  type Result,
  type SiteBlueprintId,
  type SiteId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Site & Blueprint コンテキスト / Site (§21 E05)。
 *
 * **設計図 (SiteBlueprint) と、実際に動いているブログ (Site) を分ける。**
 * 設計図は「どういうブログにするか」、Site は「いま公開されているか、どの住所か」。
 * 一緒にすると、設計図を直しただけで公開中のブログが変わってしまう。
 *
 * ブログを 1 本増やすときに書くのは、この型の値と設計図の値だけ。
 * 画面のコードは 1 行も増えない（変更容易性シナリオ③で実測済み）。
 */
export const SITE_STATUSES = ["draft", "live", "paused", "archived"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const SITE_STATUS_LABELS: Readonly<Record<SiteStatus, string>> = {
  draft: "準備中",
  live: "公開中",
  paused: "一時停止",
  archived: "終了",
};

export type Site = {
  readonly id: SiteId;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  /** どの設計図から作られたか。無いブログは作れない。 */
  readonly blueprintId: SiteBlueprintId;
  readonly name: string;
  /** `/s/<slug>` の部分。公開後は変えない (リンクが切れるため)。 */
  readonly slug: string;
  /** 独自ドメイン。未設定なら共通ドメインの `/s/<slug>` で出す。 */
  readonly customDomain: string | null;
  readonly status: SiteStatus;
  /**
   * 広告表記の文言。**空のまま公開できない**（景品表示法・ステマ規制）。
   * ブログごとに文言が変わりうるのでここに持つ。
   */
  readonly disclosureText: string;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
};

/** 小文字・数字・ハイフンだけ。URL に入るので揺れを許さない。 */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function createSite(input: {
  id: SiteId;
  workspaceId: WorkspaceId;
  brandId: BrandId;
  blueprintId: SiteBlueprintId;
  name: string;
  slug: string;
  customDomain?: string | null;
  disclosureText: string;
  createdAt: Date;
}): Result<Site, DomainError> {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();

  if (name === "") {
    return err(validationError("ブログの名前が必要です。", "name"));
  }
  if (!SLUG_PATTERN.test(slug)) {
    return err(
      validationError(
        "住所に使う文字は、半角の小文字・数字・ハイフンだけです（例: best-laptop）。",
        "slug",
      ),
    );
  }
  const domain = input.customDomain?.trim() ?? "";
  if (domain !== "" && (domain.includes("/") || domain.includes(" "))) {
    return err(
      validationError(
        "独自ドメインはホスト名だけを入れてください（例: example.jp）。",
        "customDomain",
      ),
    );
  }

  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    blueprintId: input.blueprintId,
    name,
    slug,
    customDomain: domain === "" ? null : domain,
    status: "draft",
    disclosureText: input.disclosureText.trim(),
    createdAt: input.createdAt,
    publishedAt: null,
  });
}

/**
 * 公開する。広告表記が空なら公開させない。
 *
 * これは「気をつける」ではなく型で止める種類の決めごと。
 * 1 本でも表記の無いブログが出ると、規制の対象になるのは運営者本人になる。
 */
export function publishSite(site: Site, at: Date): Result<Site, DomainError> {
  if (site.status === "archived") {
    return err(
      validationError("終了したブログは公開できません。作り直してください。", "status"),
    );
  }
  if (site.disclosureText === "") {
    return err(
      validationError(
        "広告表記の文言が空のままでは公開できません。設定画面で入力してください。",
        "disclosureText",
      ),
    );
  }
  return ok({ ...site, status: "live", publishedAt: site.publishedAt ?? at });
}

/** 読者から見えるか。 */
export function isSiteVisible(site: Site): boolean {
  return site.status === "live";
}

/**
 * 共通ドメインに載せるときの接頭辞。**ここが唯一の正本**。
 *
 * 本番では 1 ブログ = 1 ドメインなのでこの接頭辞は使わない。
 * たたき台では 1 つの Worker に複数ブログを載せるため `/s/{ブログ名}` を前に付ける。
 * 以前は画面側にも同じ `"/s"` があり、片方だけ直すとリンクが割れる状態だった。
 */
export const SITE_PATH_PREFIX = "/s";

/** ブログ名から入口のパスを作る。独自ドメインを持たないブログはこちら。 */
export function siteBasePathBySlug(slug: string): string {
  return `${SITE_PATH_PREFIX}/${slug}`;
}

/** 公開先の URL の元になる住所。独自ドメインがあればそちらを優先する。 */
export function siteBasePath(site: Site): string {
  return site.customDomain === null
    ? siteBasePathBySlug(site.slug)
    : `https://${site.customDomain}`;
}
