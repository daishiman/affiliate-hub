import type {
  EditorialSiteDraftRepositoryPort,
  SiteProvisionRequest,
} from "@/application/ports/authoring";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { SiteBlueprint, SiteDraft } from "@/domain/authoring";
import { SITE_PROVISIONING_REQUIRED_COUNTS, evaluateSiteComposition } from "@/domain/authoring/site-publication";
import { createSiteDraft } from "@/domain/authoring/site-draft";
import { defaultLayoutBandSeeds, defaultLayoutSlotSeeds } from "@/domain/blogops";
import { provisionSampleComposition } from "./blog-ops-sample-repository";
import {
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { registerStub, stubReason } from "../../stub-registry";
import { SAMPLE_WORKSPACE_ID } from "./sample-identity";

/**
 * ★ これは仮置きの保存先です（スタブ）。★
 *
 * ブログ作成ウィザードの下書きと、そこから作られたブログを
 * **プロセスの中だけ**に持つ。再起動すると消える。
 *
 * それでも入れているのは、「ブログを 1 本増やすのに
 * コードを 1 行も書かない」ことを、その場で確かめられるようにするため。
 * ウィザードで作ったブログは、そのまま `/s/<URL名>` で開ける。
 */
const stub = registerStub({
  id: "persistence:site-draft-memory",
  port: "SiteDraftRepositoryPort",
  label: "ブログ作成の下書き（プロセス内のみ）",
  blockedBy: "済み。保存先が無い環境（pnpm dev・自動テスト）での控えとして残す",
  fallbackFor: "src/infrastructure/persistence/d1/site-draft-repository.ts",
});

export function sampleSiteDraftNotice(): string {
  return `${stub.label}で動いています。作ったブログはこの場では見られますが、しばらくすると消えます（${stubReason(stub)}）。`;
}

/**
 * 保存先。**モジュール直下に置く**（関数の中ではない）。
 * 組み立て (`createDeps()`) は要求のたびに呼ばれるため、
 * 中に置くと保存した内容が次の表示で消える。
 */
/**
 * 見本の下書き 1 本。
 *
 * 2026-08-18 まで、ここは**空で始まっていた**。そのため
 * 「作りかけの一覧」と「下書きを開く」は、`pnpm dev` を立ち上げた直後には
 * 必ず空で、13 段階が埋まった状態の見え方を誰も確かめられなかった。
 * 道具（`get_site_draft` / `save_site_draft_step` / `create_site_from_draft`）も
 * 同じ理由で「見つかりません」までしか動いていなかった。
 *
 * 全部埋めてあるのは、**最後の「作る」まで進めるため**。
 * 途中で止まった見え方は、ウィザードを自分で 1 段目から進めれば作れる。
 * 逆に「埋まりきった状態」は、13 段を毎回埋めないと作れない。
 */
const SAMPLE_DRAFT: SiteDraft = {
  ...createSiteDraft({
    id: taggedString<"SiteDraftId">("sd_sample"),
    workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId,
  }),
  purpose: "はじめて一眼カメラを買う人が、レンズ選びで迷わないようにする",
  genre: "カメラ・交換レンズ",
  targetReader: "一眼カメラを買って半年以内の人",
  searchIntent: "次に買う 1 本をどう選べばよいか知りたい",
  uniqueExperience: "同じ被写体を全レンズで撮り比べた作例",
  conclusionStance: "用途ごとに 1 本ずつ挙げる",
  revenueModel: "affiliate",
  pattern: "beginner_guide",
  theme: "indigo-clay",
  name: "はじめてのレンズ",
  slug: "first-lens",
  articlePurpose: "候補を 3 本に絞らせる",
  ctaStrategy: "価格の確認だけに使う",
  evaluationAxis: "焦点距離と最短撮影距離",
  usageScene: "屋内で子どもを撮る",
  comparisonScope: "実売 10 万円以下",
  internalLinkStrategy: "案内から個別レビューへ送る",
  categories: [
    {
      slug: "prime-lenses",
      name: "単焦点レンズ",
      oneLine: "明るさで選ぶ 1 本目",
      initialArticleTypes: ["guide"],
    },
  ],
  articleTypes: ["guide", "comparison"],
  revision: 1,
} as SiteDraft;

const DRAFTS: SiteDraft[] = [SAMPLE_DRAFT];
const CREATED: { slug: string; blueprint: SiteBlueprint }[] = [];

/**
 * ウィザードで作られたブログ。
 *
 * 見本のブログ一覧 (`site-sample-repository`) がこれを読み、
 * 見本と同じ扱いで返す。**読者側の画面は区別しない。**
 */
export function createdSites(): readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[] {
  return CREATED;
}

export function createSampleSiteDraftRepository(
  auditLog?: AuditLogPort,
): EditorialSiteDraftRepositoryPort {
  return markEditorial({
    async find(workspaceId: WorkspaceId, id) {
      return ok(
        DRAFTS.find((d) => String(d.id) === String(id) && d.workspaceId === workspaceId) ?? null,
      );
    },
    async list(workspaceId: WorkspaceId) {
      return ok(DRAFTS.filter((d) => d.workspaceId === workspaceId));
    },
    async save(draft: SiteDraft) {
      const i = DRAFTS.findIndex((d) => String(d.id) === String(draft.id));
      if (i === -1) {
        if (draft.revision !== 0) {
          return err(
            domainError("CONFLICT", "この下書きは別の操作で更新されました。", {
              suggestedAction: "画面を開き直してから、もう一度保存してください。",
            }),
          );
        }
        const inserted = { ...draft, revision: 1 };
        DRAFTS.push(inserted);
        return ok(inserted);
      }
      if (DRAFTS[i]!.workspaceId !== draft.workspaceId || DRAFTS[i]!.revision !== draft.revision) {
        return err(
          domainError("CONFLICT", "この下書きは別の操作で更新されました。", {
            suggestedAction: "画面を開き直してから、もう一度保存してください。",
          }),
        );
      }
      const saved = { ...draft, revision: draft.revision + 1 };
      DRAFTS[i] = saved;
      return ok(saved);
    },
    async publishBlueprint(slug: string, blueprint: SiteBlueprint) {
      const i = CREATED.findIndex((c) => c.slug === slug);
      if (i === -1) CREATED.push({ slug, blueprint });
      else CREATED[i] = { slug, blueprint };
      return ok(blueprint);
    },
    async provisionSite(request: SiteProvisionRequest) {
      // 作業場は**渡された値**から取る（設計図の中の値から取らない）。
      const { blueprint, slug, workspaceId } = request;
      const clash = CREATED.find((c) => c.slug === slug);
      if (clash !== undefined) {
        return err(
          domainError("CONFLICT", "この URL の名前は使えません。", {
            suggestedAction: "別の URL の名前を付けて、もう一度作成してください。",
          }),
        );
      }
      const draftAt = DRAFTS.findIndex(
        (draft) =>
          String(draft.id) === String(request.completedDraft.id) &&
          draft.workspaceId === workspaceId,
      );
      const currentDraft = DRAFTS[draftAt];
      if (
        currentDraft === undefined ||
        currentDraft.revision !== request.expectedDraftRevision ||
        request.completedDraft.revision !== request.expectedDraftRevision ||
        currentDraft.createdSiteSlug !== null ||
        currentDraft.slug !== slug
      ) {
        return err(
          domainError("CONFLICT", "この下書きは別の操作で更新されました。", {
            suggestedAction: "画面を開き直してから、もう一度作成してください。",
          }),
        );
      }
      if (auditLog !== undefined) {
        const appended = await auditLog.append(request.audit);
        if (!appended.ok) return appended;
      }
      CREATED.push({ slug, blueprint });
      provisionSampleComposition({
        workspaceId,
        siteSlug: slug,
        displayName: request.displayName,
        oneLine: request.oneLine,
        bands: defaultLayoutBandSeeds(),
        slots: defaultLayoutSlotSeeds(),
      });
      DRAFTS[draftAt] = {
        ...request.completedDraft,
        revision: request.expectedDraftRevision + 1,
      };
      return ok({
        blueprint,
        composition: evaluateSiteComposition({
          ...SITE_PROVISIONING_REQUIRED_COUNTS,
          categories: blueprint.categories.length,
          articles: 0,
        }),
      });
    },

    /**
     * 取り下げ。この場でしか生きていない一覧から 1 件外す。
     *
     * **無かったものを消して成功にしない。** 見本として最初から入っている
     * 3 本はこの一覧に居ないので、ここへ来ると必ず断りになる。
     * それが正しい——見本はコードの中にあり、次に開けばまた居る。
     */
    async removeBlueprint(workspaceId: WorkspaceId, slug: string) {
      const i = CREATED.findIndex(
        (c) => c.slug === slug && c.blueprint.workspaceId === workspaceId,
      );
      if (i === -1) {
        return err(
          domainError("NOT_FOUND", "このブログは取り下げられませんでした。", {
            suggestedAction:
              "見本として最初から入っているブログは消せません。自分で作ったブログを選び直してください。",
          }),
        );
      }
      CREATED.splice(i, 1);
      return ok(true as const);
    },
  });
}
