import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
} from "@/application/ports/authoring";
import { assertContentVariantBrandScope } from "@/application/usecases/content/content-brand-access";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { PublicationRepositoryPort } from "@/application/ports/distribution";
import type {
  EditorialArticleOfferPort,
  EditorialPublishedArticleWriterPort,
  EditorialSiteRepositoryPort,
} from "@/application/ports/site";
import { type ArticleOffer, toProductCards } from "@/application/read-models/article-offer";
import type {
  PublishedArticle,
  PublishedClaim,
  PublishedSection,
} from "@/application/read-models/published-article";
import { articleHref } from "@/application/read-models/published-article";
import {
  ARTICLE_TYPES,
  ARTICLE_TYPE_LABEL,
  type ArticleType,
  type ContentVariant,
  type SectionId,
  type SiteBlueprint,
  authoredSectionsFor,
  filledSectionIds,
  sectionsFor,
  siteBasePathBySlug,
} from "@/domain/authoring";
import type { RelationshipType } from "@/domain/compliance";
import {
  GATE_REQUIREMENT_LABEL,
  RELATIONSHIP_LABEL,
  evaluatePublishGate,
} from "@/domain/compliance";
import { advance, recordSendSuccess } from "@/domain/distribution";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type PublicationId,
  type Result,
  assertSameTenant,
  assertWorkspaceWideAccess,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 書いた記事を、読者が読めるページとして出す。
 *
 * **ここが「保存先だけあって入口が無い」を解消する入口**。
 * 記事の保存先を先に本物にしても、書き込む操作が無ければ
 * 読者ページは空のまま変わらない（残課題の項目 40 と同じ形）。
 *
 * 判断の持ち主を分けている:
 *   - 出してよいか      … `evaluatePublishGate`（Compliance）
 *   - 状態を進めてよいか … `advance`（Distribution）
 *   - 何を読者に見せるか … このファイルの `buildArticle`（表示用の形へ写す）
 * ここで条件式を組み直さない。組み直すと画面と AI 経路で判定がずれる。
 *
 * 出したあとの取り下げは、記事の進行を `ARCHIVED` へ進める入口が受け持つ。
 * 公開時に配信へ残した URL と ID を使い、読者向けの写しだけを外すため、
 * 編集原稿と監査履歴は取り下げ後も残る。
 */
export type PublishArticleDeps = {
  readonly sites: EditorialSiteRepositoryPort;
  /** 記事の企画を逆引きし、membership のブランド範囲をサーバー側で照合する。 */
  readonly packages: EditorialContentPackageRepositoryPort;
  readonly variants: EditorialContentVariantRepositoryPort;
  readonly publications: PublicationRepositoryPort;
  readonly articles: EditorialPublishedArticleWriterPort;
  /**
   * 版が持つ成果リンクの ID を、読者に見せる写しへ引き当てる口。
   *
   * **これが無いと、版の `affiliateLinkIds` は公開された記事へ 1 件も渡らない。**
   * 判定（表現のきまり）は ID の件数だけを見るので、画面上は「広告あり」の
   * 記事として成立して見える。読者に成果リンクが 1 件も出ていないことは、
   * `/admin/analytics` の未突合の件数からしか分からない（残課題 58）。
   */
  readonly offers: EditorialArticleOfferPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
};

/** 記事に添える言い切りと、その根拠。 */
export type PublishArticleClaimInput = {
  readonly statement: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string | null;
  /** いつ確認したか（YYYY-MM-DD）。 */
  readonly checkedOn: string;
};

/**
 * よくある質問 1 件ぶんの入力。
 *
 * 問いと答えは**両方そろって初めて 1 件**になる。片方だけの行は捨てる
 * （問いだけを出すと答えの無い見出しが読者に並び、
 *  答えだけを出すと何の答えか分からない段落になる）。
 */
export type PublishArticleFaqInput = {
  readonly question: string;
  readonly answer: string;
};

export type PublishArticleInput = {
  readonly publicationId: string;
  readonly siteSlug: string;
  readonly categorySlug: string;
  readonly articleType: ArticleType;
  /** URL の名前。半角小文字・数字・ハイフンだけ。 */
  readonly slug: string;
  readonly title: string;
  /** 一文の結論。一覧と検索結果にそのまま出る。 */
  readonly conclusion: string;
  readonly authorName: string;
  readonly authorBio: string;
  readonly authorCredentials: readonly string[];
  readonly relationshipType: RelationshipType | null;
  readonly disclosureMessage: string;
  /** 次回確認日（YYYY-MM-DD）。未設定は公開できない。 */
  readonly nextReviewOn: string | null;
  readonly claims: readonly PublishArticleClaimInput[];
  /**
   * よくある質問。省略できる（付けない記事もある）。
   *
   * AI 検索は問いの形をそのまま拾うので、記事に入れると引用されやすい
   * （`EXPRESSION_BLOCK_KINDS` の前半 5 つの 1 つ）。
   */
  readonly faq?: readonly PublishArticleFaqInput[];
  /** 節の識別子 → 本文。入力欄は `authoredSectionsFor` から作る。 */
  readonly sectionBodies: Readonly<Record<string, string>>;
};

export type PublishArticleOutput = {
  /** 読者が開く URL。 */
  readonly url: string;
  /** 検査できなかった項目。隠さずそのまま返す。 */
  readonly skipped: readonly { readonly label: string; readonly reason: string }[];
};

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function createPublishArticleUseCase(
  deps: PublishArticleDeps,
): UseCase<PublishArticleInput, PublishArticleOutput> {
  /**
   * 記事を出したことを残す。
   *
   * 監査ログが必ず記録すると決めている 3 つのうちの 1 つ
   * （`audit-log.ts` 冒頭の「公開・取り下げ」）。
   * **読者へ出した内容の履歴**なので、後から「いつ・誰が・どの URL に出したか」
   * を言えないと、表示に問題があったときに範囲を確定できない。
   *
   * 本文はここに入れない。記録は履歴であって記事の保存先ではなく、
   * 本文を入れると内容の書き換えが起きたときに 2 つの正本ができる。
   */
  async function record(
    actor: ActorContext,
    at: Date,
    input: {
      readonly publicationId: string;
      readonly siteSlug: string;
      readonly slug: string;
      readonly title: string;
      readonly url: string;
    },
  ): Promise<Result<void, DomainError>> {
    const entry = buildAuditEntry({ ids: deps.ids, now: () => at }, actor, {
      action: "content.published",
      targetType: "published_article",
      targetId: input.slug,
      after: {
        url: input.url,
        title: input.title,
        siteSlug: input.siteSlug,
        publicationId: input.publicationId,
      },
    });
    if (!entry.ok) return entry;
    const appended = await deps.auditLog.append(entry.value);
    if (!appended.ok) {
      /*
       * 記事は既に読者から見える。ここで `ok` を返すと、
       * 「出ているのに誰が出したか分からない」状態が黙って残る。
       * かといって「公開できませんでした」と返すと、出ているものを
       * もう一度出そうとして同じ URL でぶつかる。**両方書く。**
       */
      return err(auditWriteFailure("記事は読者ページへ出ています", appended.error.details));
    }
    return ok(undefined);
  }

  return {
    async execute(
      actor: ActorContext,
      input: PublishArticleInput,
    ): Promise<Result<PublishArticleOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.publish", "記事の公開");
      if (!allowed.ok) return allowed;

      const checked = checkFields(input);
      if (!checked.ok) return checked;

      const found = await deps.publications.findById(
        actor.workspaceId,
        taggedString<"PublicationId">(input.publicationId) as PublicationId,
      );
      if (!found.ok) return found;
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "この配信が見つかりませんでした。", {
            suggestedAction: "配信の一覧から選び直してください。",
          }),
        );
      }
      const publication = found.value;

      const same = assertSameTenant(actor, publication, "この配信");
      if (!same.ok) return same;

      if (publication.channelKind !== "own_site") {
        return err(
          domainError("FORBIDDEN", "この操作は自社サイトへ出す配信でだけ使えます。", {
            suggestedAction: "他の配信先は、貼り付け用の下書きを書き出してご自身で投稿してください。",
          }),
        );
      }

      const variantResult = await deps.variants.findById(actor.workspaceId, publication.variantId);
      if (!variantResult.ok) return variantResult;
      if (variantResult.value === null) {
        return err(
          domainError("NOT_FOUND", "もとの記事が見つかりませんでした。", {
            suggestedAction: "記事の一覧から、公開したい記事を選び直してください。",
          }),
        );
      }
      const variant = variantResult.value;
      const variantScope = await assertContentVariantBrandScope(
        deps.packages,
        actor,
        variant,
        "記事",
      );
      if (!variantScope.ok) return err(variantScope.error);

      // SiteBlueprint は brandId を持たないため、限定 actor へ公開先を推測で割り当てない。
      const siteAccess = assertWorkspaceWideAccess(actor, "公開先のブログ");
      if (!siteAccess.ok) return err(siteAccess.error);

      const siteResult = await deps.sites.findBySlug(input.siteSlug);
      if (!siteResult.ok) return siteResult;
      if (siteResult.value === null) {
        return err(
          domainError("NOT_FOUND", `「${input.siteSlug}」というブログがありません。`, {
            suggestedAction: "出す先のブログを選び直してください。",
          }),
        );
      }
      const blueprint: SiteBlueprint = siteResult.value;

      const sameSite = assertSameTenant(actor, blueprint, "このブログ");
      if (!sameSite.ok) return sameSite;

      if (!blueprint.categories.some((c) => c.slug === input.categorySlug)) {
        return err(
          validationError(
            `このブログに「${input.categorySlug}」というカテゴリーはありません。`,
            "categorySlug",
          ),
        );
      }

      const now = new Date();

      /*
       * 版が指している成果リンクを引き当てる。**記事を保存する前に引く。**
       *
       * ここで失敗したら公開しない。合言葉の発行（`tracking-issuing-writer.ts`）は
       * 失敗しても公開を止めないが、あれは「後から足せる計測」で、こちらは
       * 記事の中身そのものである。読み取れないまま出すと、広告表記だけが付いて
       * 買う導線が 1 件も無い記事が読者に出る。まだ何も保存していないので、
       * 保存先が戻ってから出し直せば同じ URL で出せる。
       */
      const offersResult = await deps.offers.listByIds(
        actor.workspaceId,
        variant.affiliateLinkIds.map(String),
        now,
      );
      if (!offersResult.ok) return offersResult;
      const offers = offersResult.value;

      /*
       * 引き当てられなかった ID。**記事には出さず、公開した人へ返す。**
       * 名前も URL も分からないものを空のカードで出すと、読者には
       * 「用意し忘れ」と見分けが付かない。落としたことは黙って消さない。
       */
      const missing = variant.affiliateLinkIds
        .map(String)
        .filter((id) => !offers.some((o) => o.affiliateLinkId === id));

      const article = buildArticle(input, variant, now, offers);

      // 出してよいかの判定。ここで条件式を組み立てず、判定は Compliance に任せる。
      const gate = evaluatePublishGate({
        articleType: input.articleType,
        presentSections: filledSectionIds(input.articleType, input.sectionBodies),
        authorIds: [String(variant.authorPersonaId)],
        updateOwnerId: actor.userId,
        relationshipType: input.relationshipType,
        disclosureVisibleMessage: input.disclosureMessage,
        claimCount: input.claims.length,
        evidenceCount: input.claims.filter((c) => c.sourceLabel.trim() !== "").length,
        hasAffiliateCta: variant.affiliateLinkIds.length > 0,
        merchantOptionCount: variant.affiliateLinkIds.length,
        imageRightsConfirmed: null,
        structuredDataValid: null,
        mobileChecked: null,
        linksChecked: null,
        aiAnswerEvalPassed: null,
        webmcpSchemaEval: "not_applicable",
        nextReviewAt: parseDate(input.nextReviewOn),
        now,
      });

      // 状態を 1 つずつ進める。ゲートの結果は VALIDATING の先で domain が見る。
      const rendering = advance(publication, "RENDERING", { at: now });
      if (!rendering.ok) return rendering;
      const validating = advance(rendering.value, "VALIDATING", { at: now });
      if (!validating.ok) return validating;
      const sending = advance(validating.value, "SENDING", { at: now, gate });
      if (!sending.ok) return sending;

      // 先に読者ページへ出す。ここが失敗したら「公開しました」とは言わない。
      const stored = await deps.articles.save(actor.workspaceId, article);
      if (!stored.ok) return stored;

      const url = `${siteBasePathBySlug(input.siteSlug)}${articleHref(article)}`;
      const published = recordSendSuccess(sending.value, { id: article.slug, url }, now);
      const savedPublication = await deps.publications.save(published);
      if (!savedPublication.ok) return savedPublication;

      // **記録は保存の後**。先に書くと、保存が落ちたときに
      // 「出ていない記事を公開した」証拠だけが残る。
      const recorded = await record(actor, now, {
        publicationId: input.publicationId,
        siteSlug: input.siteSlug,
        slug: article.slug,
        title: article.title,
        url,
      });
      if (!recorded.ok) return recorded;

      return ok({
        url,
        skipped: [
          ...gate.skipped.map((s) => ({
            label: GATE_REQUIREMENT_LABEL[s.requirement],
            reason: s.reason,
          })),
          ...missing.map((id) => ({
            label: "成果リンク",
            reason: `${id} の登録が見つからないため、記事に出していません。`,
          })),
        ],
      });
    },
  };
}

/** 入力欄 1 つぶんの説明。画面はこの一覧から欄を作る（種類ごとに画面を書き分けない）。 */
export type PublishArticleFieldSpec = {
  readonly id: SectionId;
  readonly label: string;
  /** なぜ要るか。欄の下に出して、書く人が何を書けばよいか分かるようにする。 */
  readonly purpose: string;
};

export type PublishArticleFormOptions = {
  /**
   * 記事の種類と、その種類で書く欄。
   *
   * **全種類ぶんをまとめて渡す。** 種類を選び直すたびに読み直すと、
   * 書きかけの原稿が消える。画面側は受け取った表から欄を差し替えるだけにする。
   */
  readonly articleTypes: readonly {
    readonly value: ArticleType;
    readonly label: string;
    readonly sections: readonly PublishArticleFieldSpec[];
  }[];
  readonly siteOptions: readonly {
    readonly slug: string;
    readonly name: string;
    readonly categories: readonly { readonly slug: string; readonly name: string }[];
  }[];
  readonly relationshipOptions: readonly {
    readonly value: RelationshipType;
    readonly label: string;
  }[];
  /** もとの記事から写した初期値。書く人が同じことを 2 回打たないため。 */
  readonly prefill: {
    readonly title: string;
    readonly conclusion: string;
    readonly disclosureMessage: string;
    readonly body: string;
  };
};

export type PreparePublishArticleInput = {
  readonly publicationId: string;
};

/**
 * 出す前の画面に出すもの（選択肢と初期値）を集める。
 *
 * **画面がポートを直接触らないため**に用意している。画面から
 * ブログ一覧や記事を直接引くと、同じ組み立てが AI 経路と画面で二重になり、
 * 片方だけ古くなる。
 */
export function createPreparePublishArticleUseCase(
  deps: Omit<PublishArticleDeps, "articles" | "offers">,
): UseCase<PreparePublishArticleInput, PublishArticleFormOptions> {
  return {
    async execute(
      actor: ActorContext,
      input: PreparePublishArticleInput,
    ): Promise<Result<PublishArticleFormOptions, DomainError>> {
      const allowed = requireCapability(actor, "content.publish", "記事の公開");
      if (!allowed.ok) return allowed;

      const found = await deps.publications.findById(
        actor.workspaceId,
        taggedString<"PublicationId">(input.publicationId) as PublicationId,
      );
      if (!found.ok) return found;
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "この配信が見つかりませんでした。", {
            suggestedAction: "配信の一覧から選び直してください。",
          }),
        );
      }
      const same = assertSameTenant(actor, found.value, "この配信");
      if (!same.ok) return same;

      const variantResult = await deps.variants.findById(actor.workspaceId, found.value.variantId);
      if (!variantResult.ok) return variantResult;
      const variant = variantResult.value;
      if (variant === null) {
        return err(
          domainError("NOT_FOUND", "もとの記事が見つかりませんでした。", {
            suggestedAction: "記事の一覧から、公開したい記事を選び直してください。",
          }),
        );
      }
      const variantScope = await assertContentVariantBrandScope(
        deps.packages,
        actor,
        variant,
        "記事",
      );
      if (!variantScope.ok) return err(variantScope.error);

      const siteAccess = assertWorkspaceWideAccess(actor, "公開先のブログ");
      if (!siteAccess.ok) return err(siteAccess.error);

      const sitesResult = await deps.sites.list();
      if (!sitesResult.ok) return sitesResult;

      return ok({
        articleTypes: ARTICLE_TYPES.map((value) => ({
          value,
          label: ARTICLE_TYPE_LABEL[value],
          sections: authoredSectionsFor(value).map((s) => ({
            id: s.id,
            label: s.label,
            purpose: s.purpose,
          })),
        })),
        siteOptions: sitesResult.value
          .filter((entry) => entry.blueprint.workspaceId === actor.workspaceId)
          .map((entry) => ({
            slug: entry.slug,
            name: entry.blueprint.name,
            categories: entry.blueprint.categories.map((c) => ({ slug: c.slug, name: c.name })),
          })),
        relationshipOptions: (
          Object.keys(RELATIONSHIP_LABEL) as readonly RelationshipType[]
        ).map((value) => ({ value, label: RELATIONSHIP_LABEL[value] })),
        prefill: {
          title: variant.title ?? "",
          conclusion: variant.summary,
          disclosureMessage: variant.disclosure,
          body: variant.body,
        },
      });
    },
  };
}

function checkFields(input: PublishArticleInput): Result<true, DomainError> {
  if (!SLUG_PATTERN.test(input.slug)) {
    return err(
      validationError(
        "URL の名前には、半角の小文字・数字・ハイフンだけが使えます（例: quiet-laptop）。",
        "slug",
      ),
    );
  }
  if (input.title.trim() === "") return err(validationError("タイトルを入れてください。", "title"));
  if (input.conclusion.trim() === "") {
    return err(validationError("一文の結論を入れてください。", "conclusion"));
  }
  if (input.authorName.trim() === "") {
    return err(validationError("書き手の名前を入れてください。", "authorName"));
  }
  return ok(true);
}

function parseDate(value: string | null): Date | null {
  if (value === null || value.trim() === "") return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateString(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** 段落へ切る。空行で切り、空の段落は落とす。 */
function toParagraphs(body: string): readonly string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

/**
 * 入力を「読者に見せる形」へ写す。
 *
 * 保存するのはこの写しであり、書き込み側の集約ではない。
 * 書き込み側の型をそのまま保存すると、編集中の状態や採点が
 * 読者向けの読み取り経路に現れる。
 *
 * --- 成果リンクは商品カードとして出す ---
 * 版が持つ成果リンク（`offers`）は `productCards` になる。カードは
 * 順位・レビュー・比較のどの型の記事でも使える形で、これを出せば
 * 画面側は既にある道筋（`view-model.ts` → `ProductCard` → `AffiliateLink`）で
 * `/go/<合言葉>` まで通る。
 *
 * **順位表（`ranking`）はここで作らない。** 順位表の行は総合点と評価軸ごとの
 * 点数を持つ。成果リンクからは分からない値なので、作るには点を捏造するしかない。
 * 順位は Ranking の仕事であり、報酬側のデータからは決して作らない
 * （Editorial / Commercial の遮断そのもの）。順位記事の順位表は、
 * 採点の保存先（`score_cards`）が本物になったときにそちらから渡す。
 */
export function buildArticle(
  input: PublishArticleInput,
  variant: ContentVariant,
  at: Date,
  offers: readonly ArticleOffer[],
): PublishedArticle {
  const labels = new Map(sectionsFor(input.articleType).map((s) => [s.id, s.label]));
  const claims: readonly PublishedClaim[] = input.claims.map((c, i) => ({
    id: `${input.slug}-claim-${i + 1}`,
    statement: c.statement,
    kind: "fact",
    evidence: [
      {
        id: `${input.slug}-evidence-${i + 1}`,
        sourceLabel: c.sourceLabel,
        ...(c.sourceUrl === null ? {} : { url: c.sourceUrl }),
        checkedAt: c.checkedOn,
      },
    ],
  }));

  const written = authoredSectionsFor(input.articleType).filter(
    (s) => (input.sectionBodies[s.id] ?? "").trim() !== "",
  );
  // 言い切りは本文の節に添える。本文が無い記事では最初の節に添える
  // （どこにも添えないと、根拠が画面から消える）。
  const claimHost = written.some((s) => s.id === "body") ? "body" : (written[0]?.id ?? null);

  const sections: readonly PublishedSection[] = written.map((s) => ({
    id: s.id,
    heading: labels.get(s.id) ?? s.label,
    paragraphs: toParagraphs(input.sectionBodies[s.id] ?? ""),
    ...(s.id === claimHost && claims.length > 0 ? { claims } : {}),
  }));

  const productCards = toProductCards(offers);

  // 問いと答えが**両方**あるものだけ残す。片方だけの行は、
  // 読者から見ると「答えの無い見出し」か「何の答えか分からない段落」になる。
  const faq = (input.faq ?? [])
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question !== "" && item.answer !== "");

  return {
    slug: input.slug,
    siteSlug: input.siteSlug,
    type: input.articleType,
    title: input.title.trim(),
    summary: input.conclusion.trim(),
    categorySlug: input.categorySlug,
    publishedAt: toDateString(at),
    updatedAt: toDateString(at),
    author: {
      slug: String(variant.authorPersonaId),
      name: input.authorName.trim(),
      bio: input.authorBio.trim(),
      credentials: input.authorCredentials.filter((c) => c.trim() !== ""),
    },
    disclosureRequired: input.relationshipType !== null,
    sections,
    // 1 件も無いときは欄ごと出さない。空配列を入れると、画面側の
    // 「商品カードがあるか」の判定が真になり、見出しだけの空欄が読者に出る。
    ...(productCards.length === 0 ? {} : { productCards }),
    // 空配列を入れない理由は productCards と同じ（見出しだけの空欄を出さない）。
    ...(faq.length === 0 ? {} : { faq }),
  };
}
