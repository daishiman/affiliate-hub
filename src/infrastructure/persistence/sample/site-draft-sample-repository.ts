import type { EditorialSiteDraftRepositoryPort } from "@/application/ports/authoring";
import type { SiteBlueprint, SiteDraft } from "@/domain/authoring";
import { type WorkspaceId, markEditorial, ok } from "@/domain/shared";
import { registerStub } from "../../stub-registry";

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
  blockedBy: "site_drafts / site_blueprints テーブルの追加と D1 への接続",
});

export function sampleSiteDraftNotice(): string {
  return `${stub.label}は仮置きです。作ったブログはこの場では見られますが、しばらくすると消えます。`;
}

/**
 * 保存先。**モジュール直下に置く**（関数の中ではない）。
 * 組み立て (`createDeps()`) は要求のたびに呼ばれるため、
 * 中に置くと保存した内容が次の表示で消える。
 */
const DRAFTS: SiteDraft[] = [];
const CREATED: { slug: string; blueprint: SiteBlueprint }[] = [];

/**
 * ウィザードで作られたブログ。
 *
 * 見本のブログ一覧 (`site-sample-repository`) がこれを読み、
 * 見本の 3 本と同じ扱いで返す。**読者側の画面は区別しない。**
 */
export function createdSites(): readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[] {
  return CREATED;
}

export function createSampleSiteDraftRepository(): EditorialSiteDraftRepositoryPort {
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
      if (i === -1) DRAFTS.push(draft);
      else DRAFTS[i] = draft;
      return ok(draft);
    },
    async publishBlueprint(slug: string, blueprint: SiteBlueprint) {
      const i = CREATED.findIndex((c) => c.slug === slug);
      if (i === -1) CREATED.push({ slug, blueprint });
      else CREATED[i] = { slug, blueprint };
      return ok(blueprint);
    },
  });
}
