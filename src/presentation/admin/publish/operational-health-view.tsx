import {
  OPERATIONAL_HEALTH_LABEL,
  type OperationalHealth,
  type OperationalHealthQuery,
} from "@/domain/blogops";
import { FilterBar } from "@/presentation/ui";

/** 記事とサイトで「適合・配信・鮮度」の読ませ方を統一する。 */
export function OperationalHealthView({ health }: { readonly health: OperationalHealth }) {
  return (
    <span
      aria-label={`適合: ${OPERATIONAL_HEALTH_LABEL.compliance[health.compliance]}、配信: ${OPERATIONAL_HEALTH_LABEL.delivery[health.delivery]}、鮮度: ${OPERATIONAL_HEALTH_LABEL.freshness[health.freshness]}`}
    >
      適合 {OPERATIONAL_HEALTH_LABEL.compliance[health.compliance]} ／ 配信{" "}
      {OPERATIONAL_HEALTH_LABEL.delivery[health.delivery]} ／ 鮮度{" "}
      {OPERATIONAL_HEALTH_LABEL.freshness[health.freshness]}
    </span>
  );
}

export function parseOperationalHealthQuery(
  params: Record<string, string | string[] | undefined>,
): OperationalHealthQuery {
  const health = params.health;
  const sort = params.sort;
  return {
    health: health === "attention" || health === "healthy" ? health : "all",
    sort: sort === "freshness" || sort === "name" ? sort : "attention",
  };
}

export function OperationalHealthControls({
  action,
  query,
  keep,
}: {
  readonly action: string;
  readonly query: OperationalHealthQuery;
  readonly keep?: Readonly<Record<string, string>>;
}) {
  const summary =
    query.health === "all" && query.sort === "attention"
      ? null
      : `健全性: ${query.health === "attention" ? "要確認" : query.health === "healthy" ? "健全" : "すべて"}、並び: ${query.sort === "freshness" ? "鮮度の低い順" : query.sort === "name" ? "名前順" : "要確認が先"}`;
  return (
    <FilterBar
      action={action}
      clearHref={action}
      keep={keep}
      legend="運用健全性の絞り込みと並び順"
      summary={summary}
      axes={[
        {
          key: "health",
          label: "状態",
          whatItTells: "適合・配信・鮮度のどれかに手入れが要るか。",
          options: [
            { value: "attention", label: "要確認" },
            { value: "healthy", label: "健全" },
          ],
          selected: query.health === "all" ? null : query.health,
          unavailableReason: null,
          commercial: false,
        },
        {
          key: "sort",
          label: "並び順",
          whatItTells: "どの順番で手を入れるか。",
          options: [
            { value: "attention", label: "要確認が先" },
            { value: "freshness", label: "鮮度の低い順" },
            { value: "name", label: "名前順" },
          ],
          selected: query.sort,
          unavailableReason: null,
          commercial: false,
        },
      ]}
    />
  );
}
