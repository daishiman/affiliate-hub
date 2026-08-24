import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type {
  CommercialAffiliateLinkRepositoryPort,
  CommercialLinkIngestionRepositoryPort,
} from "@/application/ports/monetization";
import { requireCapability } from "@/domain/identity";
import {
  type AffiliateLink,
  captureProductSnapshot,
  createAffiliateLink,
} from "@/domain/monetization";
import {
  type ActorContext,
  type AffiliateLinkId,
  type AffiliateProgramId,
  type DomainError,
  type LinkIngestionId,
  type ProductId,
  type Result,
  err,
  notFound,
  ok,
  readDataClass,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 受信箱の 1 件を、記事に出せる成果リンクとして登録する。
 *
 * --- なぜこの手続きが要るのか ---
 * `affiliate_links` は**読む側しか無かった**。記事の組み立ては
 * この表を引くのに、入れる口がどこにも無いので、実運用では表が空のまま。
 * 空なら版の `affiliateLinkIds` は何も引き当てず、公開された記事に
 * 成果リンクが 1 件も出ない（残課題 58 / REQ-E13）。
 *
 * --- 商品名をどこから写すか（この手続きの中心） ---
 * 行は商品名を必須にするが、`AffiliateLink` は商品名を持たない。
 * 埋められる候補は 3 つあり、**登録する人の入力だけ**を正本にした。
 *
 *   1. 商品の表（`products`）… **作る入口がまだ無く空**。実運用で引けない
 *   2. 受信箱の URL から取得… ASP の URL は転送で、取りに行くと SSRF の口が増える
 *   3. **登録する人が ASP の管理画面で見ている表記**（採用）
 *
 * 名前が無いまま登録することはできない（`captureProductSnapshot` が断る）。
 * 「—」や商品 ID で埋めると、その場で作った文字列が読者のカードに商品名として出る。
 *
 * 写しなので古くなる。古くなったら**上書きせず、止めてから登録し直す**
 * （`original_url` と同じ扱い。理由は `docs/product/design-decisions.md` §2）。
 *
 * --- 順位づけへ渡さない ---
 * ここが触るのは Commercial の口だけ。返す形にも報酬の欄は無い。
 * 記事の組み立てが読むのは Editorial の印が付いた別の口
 * （`d1/affiliate-link-repository.ts`）で、そちらは報酬を持てない。
 *
 * 規範: docs/spec/01-要求仕様書-v1.0.md §19.2 / REQ-E13、
 *       tasks/task-publish-article-affiliate-links.md、docs/product/design-decisions.md §2
 */
export type RegisterAffiliateLinkDeps = {
  readonly inbox: CommercialLinkIngestionRepositoryPort;
  readonly links: CommercialAffiliateLinkRepositoryPort;
  readonly ids: IdGeneratorPort;
  /** 誰がこのリンクを記事に出せる状態にしたかの記録。**残せなければ成功にしない。** */
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

export type RegisterAffiliateLinkInput = {
  readonly linkIngestionId: string;
  /** ASP の管理画面に出ている表記をそのまま。**推測で補わない。** */
  readonly productName: string;
  readonly brand?: string;
  readonly oneLine?: string;
};

export type RegisterAffiliateLinkOutput = {
  readonly affiliateLinkId: string;
  readonly productName: string;
  readonly message: string;
};

function guardCommercial(deps: RegisterAffiliateLinkDeps): void {
  if (readDataClass(deps.inbox) !== "commercial" || readDataClass(deps.links) !== "commercial") {
    throw new Error(
      "成果リンクのつなぎ目に商業データの印が付いていません。印が無いと順位づけ側へ渡せてしまいます。",
    );
  }
}

/** 記録に URL 全体を残さない。成果の割り当て先が URL に入っているため。 */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "—";
  }
}

export function createRegisterAffiliateLinkUseCase(
  deps: RegisterAffiliateLinkDeps,
): UseCase<RegisterAffiliateLinkInput, RegisterAffiliateLinkOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: RegisterAffiliateLinkInput,
    ): Promise<Result<RegisterAffiliateLinkOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "成果リンクの登録");
      if (!allowed.ok) return allowed;

      /*
       * 受信箱から引く。**`actor.workspaceId` で引く**ので、
       * 他の作業場所の ID を渡しても「見つかりません」になる。
       * 入力の workspaceId を信じる形にしない（信じた時点で境界が消える）。
       */
      const found = await deps.inbox.findById(
        actor.workspaceId,
        taggedString<"LinkIngestionId">(input.linkIngestionId) as LinkIngestionId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("受信箱のリンク", input.linkIngestionId));
      const ingestion = found.value;

      /*
       * 商品まで決まっていないものは登録しない。
       *
       * 広告主が決まっていないと報酬の宛先が言えず、商品が決まっていないと
       * 記事のどのカードに出るかが決まらない。ここを通すと、
       * **記事に出てから「これは何のリンクか」を調べ直す**ことになる。
       */
      if (ingestion.state !== "matched" || ingestion.programId === null || ingestion.productId === null) {
        return err(
          validationError(
            "先に広告主と商品を決めてください。決まっていないリンクは記事に出せません。",
            "linkIngestionId",
          ),
        );
      }

      /*
       * 重複の相手として印が付いているものは登録しない。
       *
       * 受け取りでは重複を**捨てずに**残す（決めるのは人）。ここで通すと、
       * 同じ URL のリンクが 2 本記事に出て、クリックが 2 つの合言葉へ割れる。
       * 残すか捨てるかは受信箱で決めてから、本体のほうを登録する。
       */
      if (ingestion.duplicateOf !== null) {
        return err(
          validationError(
            "このリンクは、既に受信箱にある別のリンクと同じ URL です。どちらを使うかを受信箱で決めてから登録してください。",
            "linkIngestionId",
          ),
        );
      }

      const snapshot = captureProductSnapshot({
        productName: input.productName,
        brand: input.brand ?? null,
        oneLine: input.oneLine ?? null,
      });
      if (!snapshot.ok) return snapshot;

      const now = deps.now();

      // 既に同じ URL のリンクが生きているなら、2 本目を作らない。
      const existing = await deps.links.findUsableByOriginalUrl(
        actor.workspaceId,
        ingestion.submittedUrl,
        now,
      );
      if (!existing.ok) return existing;
      if (existing.value !== null) {
        return err(
          validationError(
            `この URL は成果リンクとして登録済みです（${String(existing.value.id)}）。表記を直すときは、いまのリンクを止めてから登録し直してください。`,
            "linkIngestionId",
          ),
        );
      }

      /*
       * URL は受け取ったものをそのまま渡す。**正規化した形（`normalizedUrl`）を渡さない。**
       * あれは重複判定のためだけに作った形で、成果の割り当てに要る値が
       * 落ちていることがある。渡すと成果が計上されない URL を読者へ出す。
       */
      const built = createAffiliateLink({
        id: taggedString<"AffiliateLinkId">(`al_${deps.ids.newId()}`) as AffiliateLinkId,
        workspaceId: actor.workspaceId,
        programId: ingestion.programId as AffiliateProgramId,
        productId: ingestion.productId as ProductId,
        originalUrl: ingestion.submittedUrl,
        // URL には足さない内部の識別子。クリック側で突き合わせる。
        trackingRef: `ref_${deps.ids.newId()}`,
        createdAt: now,
        // 期限は ASP から取れていない。**分からないものを入れない**
        // （入れると、切れていないリンクが切れた扱いで記事から消える）。
        expiresAt: null,
      });
      if (!built.ok) return built;

      const saved = await deps.links.save(built.value, snapshot.value);
      if (!saved.ok) return saved;

      /*
       * 誰がこのリンクを記事に出せる状態にしたか。**記録は保存の後**に書く。
       *
       * `targetType` は `affiliate_link`。受信箱の記録（`link_ingestion`）とは
       * 別の対象になるので、受け取りからここまでを 1 本で辿れるように
       * `linkIngestionId` を差分へ入れておく。
       *
       * **商品名を差分に残す。** 読者へ出た表記が後から変わったとき、
       * 「いつ、誰が、どう書いたか」はここでしか分からない。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_link.created",
        targetType: "affiliate_link",
        targetId: String(saved.value.id),
        after: {
          // URL 全体は残さない（成果の割り当て先が入っている）。
          host: hostOf(saved.value.originalUrl),
          linkIngestionId: String(ingestion.id),
          programId: String(saved.value.programId),
          productId: saved.value.productId === null ? null : String(saved.value.productId),
          productName: snapshot.value.productName,
          brand: snapshot.value.brand,
        },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("成果リンクは登録されています", appended.error.details));
      }

      return ok(toOutput(saved.value, snapshot.value.productName));
    },
  };
}

function toOutput(link: AffiliateLink, productName: string): RegisterAffiliateLinkOutput {
  return {
    affiliateLinkId: String(link.id),
    productName,
    message: `「${productName}」の成果リンクを登録しました。記事の版に付けると、公開したときに /go/ のリンクとして出ます。`,
  };
}
