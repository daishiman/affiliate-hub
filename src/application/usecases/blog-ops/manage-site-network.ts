import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  NETWORK_ROLE_LABEL,
  type NetworkRole,
  type NetworkStatus,
  type OperationalHealth,
  type SiteNetworkNode,
  buildNetworkTree,
  childrenOf,
  validateParent,
  validateNetworkRestore,
  validateSiteNetworkGraph,
  validateShortSlug,
  freshnessOf,
  deliveryHealth,
  deliveryOperationalState,
} from "@/domain/blogops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  err,
  notFound,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * サイト網（ハブ・サブサイト・ミニサイト）の管理。
 *
 * 参考構成では 1 本のブログが単独で立っておらず、
 * 中心のブログと、その配下の小さなブログが上下関係を持って並ぶ。
 * その上下関係を**データとして**持たせるのがここ。
 * コードに「このブログの下にはこれ」と書くと、
 * ブログを 1 本増やすたびにコードが増える。
 *
 * Editorial 区分。どのブログを上位に置くかを報酬額で決めさせない。
 */
export type ManageSiteNetworkDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

function guardEditorial(deps: ManageSiteNetworkDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `サイト網の管理に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額をブログの上下関係の入力にすることはできません。",
    );
  }
}

export type SiteNetworkRow = {
  readonly nodeId: string;
  readonly siteSlug: string;
  readonly role: NetworkRole;
  readonly roleLabel: string;
  readonly parentSlug: string | null;
  readonly name: string;
  readonly oneLine: string;
  readonly position: number;
  readonly status: NetworkStatus;
  /** 木の深さ。画面の字下げに使う。 */
  readonly depth: number;
  /**
   * 親が一覧に居ない状態。
   *
   * **落とさずに出す。** 落とすと、親を消した瞬間に配下が画面から消え、
   * 消えたことに誰も気付けない。ここに印を付けて出し、直す先を示す。
   */
  readonly orphaned: boolean;
  readonly health: OperationalHealth;
};

export type ListSiteNetworkOutput = {
  readonly rows: readonly SiteNetworkRow[];
  readonly total: number;
  readonly orphanCount: number;
  readonly emptyReason: string | null;
};

function toRows(
  nodes: readonly SiteNetworkNode[],
  health: Readonly<Record<string, OperationalHealth>>,
): readonly SiteNetworkRow[] {
  return buildNetworkTree(nodes).map((row) => ({
    nodeId: row.node.id,
    siteSlug: row.node.siteSlug,
    role: row.node.role,
    roleLabel: NETWORK_ROLE_LABEL[row.node.role],
    parentSlug: row.node.parentSlug,
    name: row.node.name,
    oneLine: row.node.oneLine,
    position: row.node.position,
    status: row.node.status,
    depth: row.depth,
    orphaned: row.orphaned,
    health: health[row.node.siteSlug] ?? {
      compliance: row.orphaned ? "attention" : "healthy",
      delivery: "unchecked",
      freshness: "unknown",
    },
  }));
}

export function createListSiteNetworkUseCase(
  deps: ManageSiteNetworkDeps,
): UseCase<Record<string, never>, ListSiteNetworkOutput> {
  guardEditorial(deps);
  return {
    async execute(actor: ActorContext): Promise<Result<ListSiteNetworkOutput, DomainError>> {
      /*
        **見るだけなら `content.read`。** 書き換えの 3 つ（足す・直す・外す）だけが
        `site.manage` を要る。同じ画面の一覧にまで `site.manage` を要求していた頃は、
        記事担当がつながりの行き止まりを見つけることすらできなかった。
        つながりの中身は姉妹サイトの帯として読者にも出るので、
        見ることに強い権限を要求する理由がない。
        （ブログ運用の他の一覧＝記事・タグ・固定ページ・版面も同じ `content.read`。）
      */
      const allowed = requireCapability(actor, "content.read", "サイト網の一覧");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.listNetwork(actor.workspaceId);
      if (!found.ok) return found;

      const [articles, parts, snapshots] = await Promise.all([
        deps.repository.listArticles(actor.workspaceId, null),
        deps.repository.listDeliveryParts(actor.workspaceId, null),
        deps.repository.listDeliverySnapshots(actor.workspaceId, null),
      ]);
      if (!articles.ok) return articles;
      if (!parts.ok) return parts;
      if (!snapshots.ok) return snapshots;

      const base = buildNetworkTree(found.value);
      const health = Object.fromEntries(
        base.map(({ node, orphaned }) => {
          const latest = articles.value
            .filter((article) => article.siteSlug === node.siteSlug)
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
          const deliveryState = deliveryOperationalState(
            deliveryHealth(
              parts.value.filter((part) => part.siteSlug === node.siteSlug),
              snapshots.value.filter((snapshot) => snapshot.siteSlug === node.siteSlug),
            ).map((row) => row.state),
          );
          return [
            node.siteSlug,
            {
              compliance: orphaned ? "attention" : "healthy",
              delivery: deliveryState,
              freshness:
                latest === undefined ? "unknown" : freshnessOf(latest.updatedAt, deps.now()),
            } satisfies OperationalHealth,
          ];
        }),
      );
      const rows = toRows(found.value, health);
      return ok({
        rows,
        total: rows.length,
        orphanCount: rows.filter((r) => r.orphaned).length,
        emptyReason:
          rows.length === 0
            ? "サイト網はまだ 1 件も登録されていません。中心にするブログを『ハブ』として足してください。"
            : null,
      });
    },
  };
}

export type DeletedSiteNetworkRow = {
  readonly nodeId: string;
  readonly siteSlug: string;
  readonly name: string;
  readonly roleLabel: string;
  readonly parentSlug: string | null;
  readonly deletedAt: string;
};

export type ListDeletedSiteNetworkOutput = {
  readonly rows: readonly DeletedSiteNetworkRow[];
  readonly total: number;
  readonly emptyReason: string | null;
};

export function createListDeletedSiteNetworkUseCase(
  deps: ManageSiteNetworkDeps,
): UseCase<Record<string, never>, ListDeletedSiteNetworkOutput> {
  guardEditorial(deps);
  return {
    async execute(actor) {
      const allowed = requireCapability(actor, "content.read", "削除済みサイト網の一覧");
      if (!allowed.ok) return allowed;
      const found = await deps.repository.listDeletedNetwork(actor.workspaceId);
      if (!found.ok) return found;
      const rows = found.value.map(({ node, deletedAt }) => ({
        nodeId: node.id,
        siteSlug: node.siteSlug,
        name: node.name,
        roleLabel: NETWORK_ROLE_LABEL[node.role],
        parentSlug: node.parentSlug,
        deletedAt: deletedAt.toISOString(),
      }));
      return ok({
        rows,
        total: rows.length,
        emptyReason: rows.length === 0 ? "削除済みのブログはありません。" : null,
      });
    },
  };
}

export type CreateSiteNetworkNodeInput = {
  readonly siteSlug: string;
  readonly role: NetworkRole;
  readonly parentSlug: string | null;
  readonly name: string;
  readonly oneLine: string;
};

export type CreateSiteNetworkNodeOutput = {
  readonly nodeId: string;
  readonly siteSlug: string;
};

export function createCreateSiteNetworkNodeUseCase(
  deps: ManageSiteNetworkDeps,
): UseCase<CreateSiteNetworkNodeInput, CreateSiteNetworkNodeOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: CreateSiteNetworkNodeInput,
    ): Promise<Result<CreateSiteNetworkNodeOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "サイト網への追加");
      if (!allowed.ok) return allowed;

      const slug = validateShortSlug(input.siteSlug);
      if (!slug.ok) return slug;
      const parent = validateParent(input.role, slug.value, input.parentSlug);
      if (!parent.ok) return parent;

      const name = input.name.trim();
      if (name === "") {
        return err(validationError("ブログの名前を入れてください。", "name"));
      }

      const existing = await deps.repository.listNetwork(actor.workspaceId);
      if (!existing.ok) return existing;
      const deleted = await deps.repository.listDeletedNetwork(actor.workspaceId);
      if (!deleted.ok) return deleted;
      if (
        existing.value.some((n) => n.siteSlug === slug.value) ||
        deleted.value.some((row) => row.node.siteSlug === slug.value)
      ) {
        return err(
          validationError(
            `URL の名前「${slug.value}」はサイト網に既にあります。同じ名前を 2 つ置くと、どちらの配下か決められません。`,
            "siteSlug",
          ),
        );
      }
      const nodeId = `snn_${deps.ids.newId()}`;
      const next = {
        id: nodeId,
        siteSlug: slug.value,
        role: input.role,
        parentSlug: parent.value,
        name,
        oneLine: input.oneLine.trim(),
        position: existing.value.length,
        status: "active",
      } as const;
      const valid = validateSiteNetworkGraph([...existing.value, next]);
      if (!valid.ok) return valid;

      const saved = await deps.repository.saveNetworkNode(actor.workspaceId, next);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry(deps, actor, {
        action: "site_network.created",
        targetType: "site_network_node",
        targetId: nodeId,
        after: { siteSlug: slug.value, role: input.role, parentSlug: parent.value },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`「${name}」をサイト網に足しました`, { nodeId }));
      }

      return ok({ nodeId, siteSlug: slug.value });
    },
  };
}

export type UpdateSiteNetworkNodeInput = {
  readonly nodeId: string;
  readonly name?: string;
  readonly oneLine?: string;
  readonly position?: number;
  readonly status?: NetworkStatus;
  readonly parentSlug?: string | null;
};

export type UpdateSiteNetworkNodeOutput = {
  readonly nodeId: string;
  readonly siteSlug: string;
  /** 実際に変わった項目名。1 つも変わらなければ空。 */
  readonly changed: readonly string[];
};

export function createUpdateSiteNetworkNodeUseCase(
  deps: ManageSiteNetworkDeps,
): UseCase<UpdateSiteNetworkNodeInput, UpdateSiteNetworkNodeOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: UpdateSiteNetworkNodeInput,
    ): Promise<Result<UpdateSiteNetworkNodeOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "サイト網の変更");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.findNetworkNode(actor.workspaceId, input.nodeId);
      if (!found.ok) return found;
      if (found.value === null) {
        return err(notFound("サイト網の節点", input.nodeId));
      }
      const before = found.value;

      const nextParent =
        input.parentSlug === undefined ? before.parentSlug : input.parentSlug;
      const parent = validateParent(before.role, before.siteSlug, nextParent);
      if (!parent.ok) return parent;

      const next = {
        id: before.id,
        siteSlug: before.siteSlug,
        role: before.role,
        parentSlug: parent.value,
        name: input.name?.trim() ?? before.name,
        oneLine: input.oneLine?.trim() ?? before.oneLine,
        position: input.position ?? before.position,
        status: input.status ?? before.status,
      };
      if (next.name === "") {
        return err(validationError("ブログの名前を空にはできません。", "name"));
      }

      const all = await deps.repository.listNetwork(actor.workspaceId);
      if (!all.ok) return all;
      const valid = validateSiteNetworkGraph(
        all.value.map((node) => (node.id === before.id ? next : node)),
      );
      if (!valid.ok) return valid;

      const changed: string[] = [];
      if (next.name !== before.name) changed.push("name");
      if (next.oneLine !== before.oneLine) changed.push("oneLine");
      if (next.position !== before.position) changed.push("position");
      if (next.status !== before.status) changed.push("status");
      if (next.parentSlug !== before.parentSlug) changed.push("parentSlug");
      if (changed.length === 0) {
        return ok({ nodeId: before.id, siteSlug: before.siteSlug, changed: [] });
      }

      const saved = await deps.repository.saveNetworkNode(actor.workspaceId, next);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry(deps, actor, {
        action: "site_network.changed",
        targetType: "site_network_node",
        targetId: before.id,
        before: { name: before.name, parentSlug: before.parentSlug, status: before.status },
        after: { name: next.name, parentSlug: next.parentSlug, status: next.status },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`「${next.name}」の設定を変えました`, { nodeId: before.id }));
      }

      return ok({ nodeId: before.id, siteSlug: before.siteSlug, changed });
    },
  };
}

export type DeleteSiteNetworkNodeInput = {
  readonly nodeId: string;
  readonly reason: string;
};

export type DeleteSiteNetworkNodeOutput = {
  readonly name: string;
  readonly siteSlug: string;
};

export function createDeleteSiteNetworkNodeUseCase(
  deps: ManageSiteNetworkDeps,
): UseCase<DeleteSiteNetworkNodeInput, DeleteSiteNetworkNodeOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: DeleteSiteNetworkNodeInput,
    ): Promise<Result<DeleteSiteNetworkNodeOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "サイト網からの削除");
      if (!allowed.ok) return allowed;

      const reason = input.reason.trim();
      if (reason === "") {
        return err(
          validationError(
            "外す理由を書いてください。公開 URL を取り下げた判断を後から確かめられるようにします。",
            "reason",
          ),
        );
      }

      const all = await deps.repository.listNetwork(actor.workspaceId);
      if (!all.ok) return all;
      const target = all.value.find((n) => n.id === input.nodeId);
      if (target === undefined) {
        return err(notFound("サイト網の節点", input.nodeId));
      }
      const currentGraph = validateSiteNetworkGraph(all.value);
      if (!currentGraph.ok) return currentGraph;
      const children = childrenOf(all.value, target.siteSlug);
      if (children.length > 0) {
        return err(
          validationError(
            `「${target.name}」を上位にしているブログが ${children.length} 件あります。先に配下を移動または削除してください。`,
          ),
        );
      }
      const nextGraph = validateSiteNetworkGraph(all.value.filter((node) => node.id !== target.id));
      if (!nextGraph.ok) return nextGraph;

      const deleted = await deps.repository.deleteNetworkNode(
        actor.workspaceId,
        input.nodeId,
        deps.now(),
      );
      if (!deleted.ok) return deleted;

      const entry = buildAuditEntry(deps, actor, {
        action: "site_network.deleted",
        targetType: "site_network_node",
        targetId: input.nodeId,
        before: { siteSlug: target.siteSlug, role: target.role, name: target.name },
        reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`「${target.name}」をサイト網から外しました`, { nodeId: input.nodeId }));
      }

      return ok({ name: target.name, siteSlug: target.siteSlug });
    },
  };
}

export type RestoreSiteNetworkNodeInput = { readonly nodeId: string };
export type RestoreSiteNetworkNodeOutput = {
  readonly nodeId: string;
  readonly siteSlug: string;
  readonly name: string;
};

export function createRestoreSiteNetworkNodeUseCase(
  deps: ManageSiteNetworkDeps,
): UseCase<RestoreSiteNetworkNodeInput, RestoreSiteNetworkNodeOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "site.manage", "サイト網の復元");
      if (!allowed.ok) return allowed;

      const [deleted, active] = await Promise.all([
        deps.repository.listDeletedNetwork(actor.workspaceId),
        deps.repository.listNetwork(actor.workspaceId),
      ]);
      if (!deleted.ok) return deleted;
      if (!active.ok) return active;
      const target = deleted.value.find((row) => row.node.id === input.nodeId);
      if (target === undefined) return err(notFound("削除済みサイト網の節点", input.nodeId));

      const valid = validateNetworkRestore(target.node, active.value);
      if (!valid.ok) return valid;
      const restored = await deps.repository.restoreNetworkNode(
        actor.workspaceId,
        input.nodeId,
        deps.now(),
      );
      if (!restored.ok) return restored;

      const entry = buildAuditEntry(deps, actor, {
        action: "site_network.restored",
        targetType: "site_network_node",
        targetId: target.node.id,
        after: {
          siteSlug: target.node.siteSlug,
          role: target.node.role,
          name: target.node.name,
        },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`「${target.node.name}」をサイト網へ戻しました`, {
            nodeId: target.node.id,
          }),
        );
      }
      return ok({
        nodeId: target.node.id,
        siteSlug: target.node.siteSlug,
        name: target.node.name,
      });
    },
  };
}
