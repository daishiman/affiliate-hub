import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createGetSettingsOverviewUseCase,
  createListAuditLogUseCase,
  createListBrandsUseCase,
  createListDisclosuresUseCase,
  createListMembersUseCase,
  createListRolesUseCase,
} from "@/application/usecases/identity/manage-workspace";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 設定の道具。
 *
 * **役割を変える・担当者を招く道具はここに無い。**
 * 誰が何をできるかを変える操作は人が行うと決めており（`HUMAN_ONLY_CAPABILITIES`）、
 * AI から呼べる形では置かない。読むだけの道具に限っている。
 */
export function settingsTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const settings = {
    workspaces: deps.workspaces,
    memberships: deps.memberships,
    brands: deps.brands,
    disclosures: deps.disclosures,
    auditLog: deps.auditLog,
  };
  const empty = z.object({});

  return [
    defineTool({
      name: "get_settings_overview",
      description:
        "作業場所の契約区分・時間帯・通貨と、ブランド／ブログ／担当者の使用数と上限を返します。上限に達している場合はその理由も返します。",
      schema: empty,
      readOnly: true,
      useCase: createGetSettingsOverviewUseCase(settings),
    }),
    defineTool({
      name: "list_roles",
      description:
        "役割ごとにできることの一覧を返します。AI には、人が行うと決めた操作（承認・公開・担当者の管理など）は付きません。",
      schema: empty,
      readOnly: true,
      useCase: createListRolesUseCase(settings),
    }),
    defineTool({
      name: "list_members",
      description:
        "担当者の一覧を、役割・参加状態（参加中／招待中／解除済み）・担当ブランドの範囲つきで返します。",
      schema: empty,
      readOnly: true,
      useCase: createListMembersUseCase(settings),
    }),
    defineTool({
      name: "list_brands",
      description:
        "ブランドの一覧を、名乗り・文体・免責と、公開の前に埋める必要がある項目つきで返します。",
      schema: empty,
      readOnly: true,
      useCase: createListBrandsUseCase(settings),
    }),
    defineTool({
      name: "list_disclosures",
      description:
        "広告表記の設定と、読者へ表示する文言、リンクに付ける rel 属性、表示が必要な箇所の一覧を返します。",
      schema: empty,
      readOnly: true,
      useCase: createListDisclosuresUseCase(settings),
    }),
    defineTool({
      name: "list_audit_log",
      description:
        "操作の記録を新しい順に返します。承認が人によるものか AI によるものかを含みます。秘密情報は記録の時点で伏せられています。",
      schema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
      readOnly: true,
      useCase: createListAuditLogUseCase(settings),
    }),
  ];
}
