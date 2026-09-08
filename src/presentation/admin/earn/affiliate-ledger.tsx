import type {
  AffiliateLinkRow,
  ListAffiliateLinksOutput,
} from "@/application/usecases/monetization/manage-affiliate-links";
import { DeleteConfirm } from "@/presentation/admin/delete-confirm";
import { disableAffiliateLinkAction } from "@/presentation/admin/delete-form-action";
import {
  Callout,
  EmptyView,
  FactList,
  FilterBar,
  ListView,
  Note,
  Prose,
  Section,
  TextLink,
} from "@/presentation/ui";

/**
 * 登録済み成果リンクの走査面。
 *
 * --- なぜ画面から切り出してあるのか ---
 *
 * `docs/spec/feat-reference-blog-admin-ux/component-contract.md` は
 * `AffiliateLedger` と `PlacementList` を部品として約束している。
 * ところが実体は `src/app/admin/affiliate/links/page.tsx` の中に
 * **名前の無いインライン JSX** として書かれていた。名前が無いと、
 * 契約の行と実装の場所を突き合わせる手がかりがどこにも無くなり、
 * 「契約には在るが実装は無い」と「在るが名乗っていない」が区別できない。
 * 契約表の `ファイル` 列（= export path）と機械検査
 * (`tests/architecture/component-contract-identity.test.ts`) が
 * 成り立つのは、部品がこの名前で実在している場合だけである。
 *
 * 見た目と挙動は切り出し前と同一。並べ替えも文言の変更もしていない。
 */

const LEDGER_PATH = "/admin/affiliate/links";

/**
 * site/page/block の逆引き。
 *
 * 行のラベルは「掲載中: サイト / 記事 / ブロック（位置 N・最終表示 …）」で、
 * 押すと**その記事の公開ページ**へ飛ぶ。掲載を消す口はここに置かない
 * （止めるのはリンク単位で、掲載単位ではないため）。
 */
export function PlacementList({
  placements,
}: {
  readonly placements: AffiliateLinkRow["placements"];
}) {
  if (placements.length === 0) {
    return (
      <Note>掲載先はありません。古い行はリンクIDが未登録のため、要確認として残しています。</Note>
    );
  }
  return (
    <ListView
      rows={placements.map((placement) => ({
        key: placement.placementId,
        label:
          `${placement.status === "active" ? "掲載中" : "掲載終了"}: ` +
          `${placement.siteSlug} / ${placement.articleSlug} / ` +
          `${placement.blockId ?? placement.placement}` +
          `（位置 ${placement.position + 1}` +
          `${placement.lastRenderedAt === null ? "・表示確認なし" : `・最終表示 ${placement.lastRenderedAt.slice(0, 10)}`}）`,
        href: `/s/${encodeURIComponent(placement.siteSlug)}/blog/${encodeURIComponent(placement.articleSlug)}`,
      }))}
    />
  );
}

/**
 * 要確認リンクと掲載数の走査。絞り込みの軸（状態・提携先・要確認）と、
 * 1 行ずつの内訳・停止操作を持つ。
 */
export function AffiliateLedger({
  result,
  state,
  provider,
  attention,
}: {
  readonly result: ListAffiliateLinksOutput;
  readonly state: AffiliateLinkRow["state"] | null;
  readonly provider: string | null;
  readonly attention: boolean | null;
}) {
  return (
    <>
      <FilterBar
        action={LEDGER_PATH}
        legend="確認するリンクを絞り込む"
        clearHref={LEDGER_PATH}
        summary={
          state === null && provider === null && attention === null
            ? null
            : `${result.totalCount}件中 ${result.rows.length}件を表示しています。`
        }
        axes={[
          {
            key: "state",
            label: "状態",
            whatItTells: "読者に表示中・期限切れ・停止済みを分けます。",
            selected: state,
            unavailableReason: null,
            commercial: false,
            options: [
              { value: "usable", label: "読者に出ています" },
              { value: "expired", label: "期限が切れています" },
              { value: "disabled", label: "止めました" },
            ],
          },
          {
            key: "provider",
            label: "提携先",
            whatItTells: "どのASP・提携先から発行されたかで分けます。",
            selected: provider,
            unavailableReason:
              result.providerOptions.length === 0
                ? "提携先を確認できるリンクがありません。"
                : null,
            commercial: true,
            options: result.providerOptions,
          },
          {
            key: "attention",
            label: "要確認",
            whatItTells: "最終確認が古い・掲載先が無い・停止中のものだけにします。",
            selected: attention === true ? "yes" : null,
            unavailableReason: null,
            commercial: false,
            options: [{ value: "yes", label: "要確認だけ" }],
          },
        ]}
      />

      <Section title="リンクの一覧">
        <Prose>
          {result.usableCount === 0
            ? "読者に出ているリンクが 1 件もありません。記事に成果リンクは表示されていません。"
            : `${result.usableCount}件が読者に出ています。ASP の管理画面に出ている商品名と見比べてください。`}
        </Prose>
        {result.rows.length === 0 ? (
          <EmptyView
            title="条件に合うリンクがありません"
            body="絞り込みを外すと、登録済みのリンクをすべて確認できます。"
            action={<TextLink href={LEDGER_PATH}>絞り込みを外す</TextLink>}
          />
        ) : (
          result.rows.map((row) => (
            <details key={row.affiliateLinkId}>
              <summary>
                {row.productName} — {row.providerLabel}・{row.stateLabel}・
                稼働中の掲載先{row.placementCount}件を見る
              </summary>
              <FactList
                rows={[
                  { key: "provider", label: "提携先", value: row.providerLabel },
                  { key: "state", label: "いまの状態", value: row.stateLabel },
                  {
                    key: "checked",
                    label: "最終確認",
                    value: row.lastCheckedAt?.slice(0, 10) ?? "未確認",
                  },
                  {
                    key: "placements",
                    label: "掲載の内訳",
                    value: `稼働中 ${row.placementCount}件 / 履歴 ${row.placements.length}件`,
                  },
                ]}
              />
              {row.oneLine === null ? null : <Prose>{row.oneLine}</Prose>}
              {row.attentionReasons.length > 0 ? (
                <Callout tone="warn" reason={`要確認: ${row.attentionReasons.join("・")}`} />
              ) : null}
              <PlacementList placements={row.placements} />
              {row.canDisable ? (
                <DeleteConfirm
                  action={disableAffiliateLinkAction}
                  toolName="affiliate_link_disable"
                  toolDescription="登録済みの成果リンクを止める。記事に貼ったままでも、公開のときに読者へ出なくなる。"
                  idName="affiliateLinkId"
                  idValue={row.affiliateLinkId}
                  label={row.productName}
                  verb="止める"
                  consequence="記事に貼ったままでも、公開のときに読者へ出なくなります。行は消えないので、いつまで出ていたかは後から辿れます。止めたリンクは元へ戻せません。表記を直すときは、受信箱から新しいリンクとして登録し直してください。"
                  acknowledgement="止めたら元へ戻せないことを確かめました"
                />
              ) : (
                <Note>このリンクは停止済みです。表記を直す場合は受信箱から登録し直してください。</Note>
              )}
            </details>
          ))
        )}
        <Note>
          リンクの全体（ASP が発行した URL）は出しません。成果の割り当て先が入っているためです。
        </Note>
      </Section>
    </>
  );
}
