import type { ReactNode } from "react";
import type { SeoDashboardOutput } from "@/application/usecases/seo/manage-seo-auto-apply";
import type { Finding } from "@/domain/seo/aeo-measurement";
import { FINDING_RULE, MEASUREMENT_SOURCE_LABEL } from "@/domain/seo/aeo-measurement";
import {
  ActionNote, Callout, DataTable, EmptyView, Foldable, ListView, Note, Prose, Section, SummaryStrip, TextLink,
} from "@/presentation/ui";

import { seoReviewHref } from "./seo-review-href";

/** 取得件数と表示説明の上限を揃える。 */
export const FINDING_DISPLAY_LIMIT = 50;

/*
  画面が読む形は**ユースケースの型をそのまま**使う。ここで構造を書き写すと、
  所見に欄が 1 つ増えた日に、型は通るのに画面だけが古いまま残る。
*/
export function SeoDashboard({
  view,
  siteSlug,
  siteOptions,
  siteError,
  canManage,
  reviewSlot,
  renderRevert,
  pauseSlot,
  citationBudgetSlot,
}: {
  readonly view: SeoDashboardOutput;
  readonly siteSlug: string | undefined;
  readonly siteOptions: readonly { readonly slug: string; readonly name: string }[];
  readonly siteError: string | null;
  /*
    見るのと直すのは別の権限である（`manage-seo-auto-apply` の註）。
    押しても断られる釦を出さないために、**画面を作る側でも同じ境目を持つ**。
    ここを持たないと、読むだけの人には「押せるのに毎回断られる」画面になる。
  */
  readonly canManage: boolean;
  /** 操作はrouteが組み立て、表示部品は実行条件だけを渡す。 */
  readonly reviewSlot?: ReactNode;
  readonly renderRevert: (logId: string) => ReactNode;
  readonly pauseSlot: ReactNode;
  readonly citationBudgetSlot: ReactNode;
}) {
  // 記事を選んだ後は、その記事の差分と観測だけに集中する。
  // 全体ダッシュボードを同じ画面へ重ねると、どのブログを見ているかを再確認させてしまう。
  if (reviewSlot !== null && reviewSlot !== undefined) return <>{reviewSlot}</>;

  /*
    記事を直せば消える所見と、画面の作りを直さないと消えない所見を分ける。
    この境目は `FINDING_RULE` が持っている。画面で判定を書き直すと、
    規則を足した日にここだけ古くなる。
  */
  const articleFindings = view.findings.filter((f) => FINDING_RULE[f.code].fixTarget === "article");
  const templateFindings = view.findings.filter(
    (f) => FINDING_RULE[f.code].fixTarget === "template",
  );

  const stalledSources = view.sources.filter((s) => s.state === "stalled");
  const selectedSiteName = siteOptions.find((site) => site.slug === siteSlug)?.name ?? siteSlug;

  return (
    <>
      <Section title="いまの状況">
        {siteSlug === undefined ? null : (
          <Note>
            確認対象: {selectedSiteName}。<TextLink href="/admin/seo">全ブログを見る</TextLink>
          </Note>
        )}
        <SummaryStrip
          label="いまの状況"
          metrics={[
            {
              key: "findings",
              label: "表示中の所見",
              value: `${view.findings.length}件`,
              meaning:
                `${siteSlug === undefined ? "全ブログ" : "選択中のブログ"}から、直近の最大${FINDING_DISPLAY_LIMIT}件を表示しています。0件は、この範囲で所見がないという意味です。`,
            },
            {
              key: "unapplied",
              label: "修正候補の所見",
              value: `${view.unappliedCount}件`,
              meaning:
                "選択中の範囲にある未反映所見の数です。同じ記事に複数の所見があるため、記事数とは異なります。",
            },
            {
              key: "paused",
              label: "記事の修正受付",
              value: view.paused ? "停止中" : "操作できます",
              meaning: view.paused
                ? "書き換えだけを止めています。観測はこの間も続いています。"
                : "記事ごとの差分を確認して反映できます。定期実行は観測を行います。",
            },
          ]}
        />

        {/*
          「止まっている疑い」は所見の下ではなく上に出す。
          下に置くと、所見が多い日ほど画面の外へ流れ、
          **一番読ませたい日に一番読まれなくなる。**
        */}
        {view.autoApplyStalled ? (
          <Callout
            tone="warn"
            title="未反映の修正候補が残っています"
            reason={
              "未反映の所見が残っています。記事ごとの差分を確認して、反映するか判断してください。" +
              "反映できない場合は、確認画面に理由が表示されます。"
            }
          />
        ) : null}

        {stalledSources.map((s) => (
          <Callout
            key={s.source}
            tone="warn"
            title={`${s.label}が止まっています`}
            reason={`${s.message} この系統の所見は古いままです。減っていても、良くなったとは限りません。`}
          />
        ))}
      </Section>

      {reviewSlot}
      <Section title="記事の修正候補" lead="記事を選び、変更前と変更後を確認してから反映します。">
        {siteSlug === undefined ? (
          <>
            <Prose>どのブログを確認するかを選んでください。</Prose>
            {siteOptions.length === 0 ? (
              <Note>{siteError === null ? "まだブログがありません。先にブログを1つ作ってください。" : `ブログの一覧を読み出せません（${siteError}）。`}</Note>
            ) : (
              <ListView rows={siteOptions.map((site) => ({ key: site.slug, label: site.name, href: seoReviewHref(site.slug), note: "このブログの候補を見る" }))} />
            )}
          </>
        ) : view.candidates.length === 0 ? (
          <EmptyView title="確認できる記事の修正候補はありません" body="記事内容や画面の作りに関する所見も、下で確認できます。" />
        ) : (
          <>
            <Note>記事の候補を最大{FINDING_DISPLAY_LIMIT}件表示しています。反映できない記事には、差分の確認画面で理由を表示します。</Note>
            <DataTable caption="差分を確認する記事" columns={[
              { key: "article", label: "記事" }, { key: "findings", label: "未反映所見", numeric: true }, { key: "review", label: "次の操作" },
            ]} rows={view.candidates.map((candidate) => {
              const title = candidate.title.trim() || candidate.articleSlug;
              return { key: `${candidate.siteSlug}:${candidate.articleSlug}`, cells: [title, `${candidate.findingCount}件`,
                <TextLink key="review" href={seoReviewHref(candidate.siteSlug, candidate.articleSlug)}>{title}の差分と実績を見る</TextLink>,
              ] };
            })} />
          </>
        )}
        <Foldable summary={`記事内容の所見を見る（表示中${articleFindings.length}件）`}>
          {articleFindings.length === 0 ? <Note>表示中の記事の所見はありません。所見の表示上限と記事の候補は別に集計しています。</Note>
            : <FindingTable caption="表示中の記事の所見（重い順）" findings={articleFindings} />}
        </Foldable>
      </Section>

      <Section
        title="どこから見ているか"
        lead="3 つの系統で見ています。鍵が要るのは 2 つで、登録していなくても 1 つ目は動きます。"
      >
        <DataTable
          caption="作業場所全体で見た、系統ごとの最後の観測時刻と状態"
          columns={[
            { key: "label", label: "系統" },
            { key: "state", label: "状態" },
            { key: "last", label: "最後の観測" },
            { key: "message", label: "次にすること" },
          ]}
          rows={view.sources.map((s) => ({
            key: s.source,
            cells: [s.label, SOURCE_STATE_LABEL[s.state], formatAt(s.lastCollectedAt), s.message],
          }))}
        />
        <Foldable summary={staticAuditCoverageSummary(view.staticAuditCoverage)}>
          <StaticAuditCoveragePanel coverage={view.staticAuditCoverage} siteOptions={siteOptions} />
        </Foldable>
        <ActionNote>
          この系統表は作業場所全体の履歴です。選択中のブログをどこまで確認できたかは、上の
          「公開ページの確認範囲」で見てください。観測が止まっていれば、所見が減っても改善とは限りません。
        </ActionNote>
        <Foldable summary={citationBudgetSummary(view.citationMonthlyBudget)}>
          <Prose>
            この作業場所の全ブログで分け合う、今月（UTC）のWeb検索回数です。
            {view.citationMonthlyBudget.limitSearches === null
              ? " 月次上限が未設定のため、AIの被引用チェックは停止中です。"
              : view.citationMonthlyBudget.limitSearches === 0
                ? " 0回に設定したため、AIの被引用チェックは停止中です。"
                : ""}
          </Prose>
          <SummaryStrip
            label="AI検索の月次枠"
            metrics={[
              { key: "remaining", label: "残り", value: view.citationMonthlyBudget.remainingSearches === null ? "—" : `${view.citationMonthlyBudget.remainingSearches}回`, meaning: "追加で使える検索回数です。" },
              { key: "used", label: "確認済みの検索", value: `${view.citationMonthlyBudget.usedSearches}回`, meaning: "提供元の使用記録で確認できた検索回数です。" },
              { key: "reserved", label: "実行中の確保", value: `${view.citationMonthlyBudget.reservedSearches}回`, meaning: "外部へ問い合わせる前に確保し、その処理が終わるまで使う回数です。" },
              { key: "unconfirmed", label: "使用数を確認できなかった確保", value: `${view.citationMonthlyBudget.unconfirmedSearches}回`, meaning: "送信後に使用回数を確認できず、安全のため再利用しない回数です。" },
              { key: "limit", label: "月次上限", value: view.citationMonthlyBudget.limitSearches === null ? "未設定" : `${view.citationMonthlyBudget.limitSearches}回`, meaning: `${formatMonth(view.citationMonthlyBudget.monthKey)}（UTC）。翌月1日に新しい枠へ切り替わります。` },
            ]}
          />
          {view.citationMonthlyBudget.limitSearches !== null
              && view.citationMonthlyBudget.limitSearches > 0
              && view.citationMonthlyBudget.usedSearches + view.citationMonthlyBudget.unconfirmedSearches
                >= view.citationMonthlyBudget.limitSearches ? (
            <Callout tone="warn" title="今月の上限に達しました"
              reason="追加の被引用チェックは行いません。翌月1日（UTC）に新しい枠へ切り替わります。" />
          ) : null}
          {view.citationMonthlyBudget.reached && view.citationMonthlyBudget.reservedSearches > 0
              && view.citationMonthlyBudget.limitSearches !== null
              && view.citationMonthlyBudget.usedSearches + view.citationMonthlyBudget.unconfirmedSearches
                < view.citationMonthlyBudget.limitSearches ? (
            <Note>実行中の処理が残りを確保しています。確定時に使わなかった回数は今月の残りへ戻ります。</Note>
          ) : null}
          {citationBudgetSlot}
        </Foldable>
      </Section>

      <Section
        title="画面の作りを直さないと消えないもの"
        lead="canonical・構造化データ・見出しの段など、記事の文章ではなく画面の作りに原因がある所見です。ここは自動では直しません。"
      >
        {templateFindings.length === 0 ? (
          <EmptyView
            title="表示中の画面由来所見はありません"
            body="未確認のページや所見の表示上限があるため、問題が無いという判定ではありません。上の確認範囲と一緒に見てください。"
          />
        ) : (
          <>
            <FindingTable
              caption="画面の作りを直さないと消えない所見（重い順）"
              findings={templateFindings}
            />
            <ActionNote>
              これらは記事を何度書き換えても消えません。消えないことを見て「反映が効いていない」と
              読まないでください。直すのはテンプレートの側です。
            </ActionNote>
          </>
        )}
      </Section>

      <Section
        title="反映の記録"
        lead="1件ずつ取り消せます。反映後に別の編集がある場合は、その内容を保護して取り消しを止めます。"
      >
        {view.recentApplies.length === 0 ? (
          <EmptyView
            title="まだ反映の記録はありません"
            body={`この仕組みを入れたのは ${formatAt(view.introducedAt)} です。それより前に作られた記事は差分反映の対象外です。`}
          />
        ) : (
          <DataTable
            caption="最近の反映と、その取り消し"
            columns={[
              { key: "article", label: "記事" },
              { key: "diff", label: "何を変えたか" },
              { key: "at", label: "いつ" },
              { key: "effect", label: "ページ別実績" },
              { key: "revert", label: "取り消し" },
            ]}
            rows={view.recentApplies.map(({ entry }) => ({
              key: entry.id,
              cells: [
                entry.articleSlug,
                entry.diffSummary,
                formatAt(entry.appliedAt),
                <TextLink key="metrics" href={seoReviewHref(entry.siteSlug, entry.articleSlug)}>この記事の観測値を見る</TextLink>,
                entry.revertedAt !== null
                  ? `${formatAt(entry.revertedAt)}に取り消し済み`
                  : canManage
                    ? renderRevert(entry.id)
                    : "取り消せるのは、ブログの設定を変える権限を持つ人だけです。",
              ],
            }))}
          />
        )}
      </Section>

      <Section
        title="記事の修正を停止・再開する"
        lead="この作業場所の全ブログに適用されます。止めるのは書き換えだけで、観測は続きます。"
      >
        {canManage ? (
          pauseSlot
        ) : (
          <Note>
            止める・再開するは、ブログの設定を変える権限を持つ人の操作です。
            {view.paused ? "いまは止まっています。" : "いまは修正を受け付けています。"}
          </Note>
        )}
      </Section>
    </>
  );
}

function StaticAuditCoveragePanel({
  coverage,
  siteOptions,
}: {
  readonly coverage: SeoDashboardOutput["staticAuditCoverage"];
  readonly siteOptions: readonly { readonly slug: string; readonly name: string }[];
}) {
  if (coverage.length === 0) {
    return <Note>公開ページの確認範囲はまだ集計されていません。最初の定期確認を待ってください。</Note>;
  }
  const totals = coverage.reduce((sum, row) => ({
    total: sum.total + row.total,
    current: sum.current + row.current,
    never: sum.never + row.never,
    failed: sum.failed + row.failed,
    stale: sum.stale + row.stale,
    findings: sum.findings + row.currentFindingCount,
    notStarted: sum.notStarted + (row.status === "not_started" ? 1 : 0),
    inventoryLimited: sum.inventoryLimited + (row.status === "limited" && !row.inventoryComplete ? 1 : 0),
    capacityLimited: sum.capacityLimited + (row.status === "limited" && row.inventoryComplete ? 1 : 0),
  }), { total: 0, current: 0, never: 0, failed: 0, stale: 0, findings: 0, notStarted: 0, inventoryLimited: 0, capacityLimited: 0 });
  const hasLimit = totals.inventoryLimited > 0 || totals.capacityLimited > 0;
  const limitReason = [
    totals.inventoryLimited > 0
      ? `公開ページが1,000件を超えたブログが${totals.inventoryLimited}件あります。対象を減らすまで全体の所見を更新せず、前回の所見を保持します。`
      : "",
    totals.capacityLimited > 0
      ? `観測結果の合計が安全な一括確認容量を超えたブログが${totals.capacityLimited}件あります。前回の所見を保持し、14日後に再試行します。`
      : "",
  ].filter(Boolean).join(" ");
  const complete = totals.total > 0 && totals.current === totals.total
    && coverage.every((row) => row.inventoryComplete && row.status === "published");
  const hasCompletedSnapshot = coverage.some((row) => row.lastCompletedAt !== null);
  return (
    <>
      <SummaryStrip label="公開ページの確認範囲" metrics={[
        { key: "current", label: "現在の内容を確認済み", value: totals.inventoryLimited > 0 ? `${totals.current}件（対象は1,000件超）` : `${totals.current}/${totals.total}件`, meaning: totals.inventoryLimited > 0 ? "対象上限を超えて総数は未確定です。現在の内容を正常に読めたページだけを示します。" : "公開対象の総数に対して、現在の内容を正常に読めたページ数です。" },
        { key: "never", label: "未確認", value: totals.inventoryLimited > 0 ? `${totals.never}件以上` : `${totals.never}件`, meaning: totals.inventoryLimited > 0 ? "総数が未確定のため、検出済みの下限です。取得に失敗したページは右の欄へ分けています。" : "確認結果がまだ無いページです。取得に失敗したページは右の欄へ分けています。" },
        { key: "failed", label: "取得失敗", value: `${totals.failed}件`, meaning: "直近の取得に失敗し、次回に再試行するページです。" },
        { key: "stale", label: "再確認待ち", value: `${totals.stale}件`, meaning: "前回確認後に更新されたか、確認から14日を過ぎたページです。" },
        { key: "not-started", label: "確認を始めていないブログ", value: `${totals.notStarted}件`, meaning: "公開中ですが、対象ページの集計をまだ始めていないブログです。" },
        { key: "findings", label: complete ? "全件確認後の所見" : hasCompletedSnapshot ? "前回の全件確認で残った所見" : "保持中の所見", value: `${totals.findings}件`, meaning: complete ? "現在の全公開ページを確認して残った所見です。" : hasCompletedSnapshot ? "途中経過では所見を消さず、直前に全件確認できた結果を保持します。" : "全体確認の結果は未確定です。確認途中に既存所見を解消済みにはしません。" },
      ]} />
      {!complete ? (
        <Callout tone="warn" title={hasLimit ? "公開ページの確認上限に達しました" : "公開ページの確認は途中です"}
          reason={hasLimit ? limitReason : "未確認・取得失敗・再確認待ちが解消し、全ページの確認結果が揃うまで、問題が無いとは判定しません。"} />
      ) : null}
      {coverage.length > 1 ? (
        <DataTable caption="ブログ別の公開ページ確認範囲" columns={[
          { key: "site", label: "ブログ" },
          { key: "current", label: "確認済み", numeric: true },
          { key: "remaining", label: "未確認・失敗・再確認待ち", numeric: true },
          { key: "findings", label: "所見", numeric: true },
        ]} rows={coverage.map((row) => ({
          key: row.siteSlug,
          cells: [<TextLink key="site" href={seoReviewHref(row.siteSlug)}>{siteOptions.find((site) => site.slug === row.siteSlug)?.name ?? row.siteSlug}</TextLink>, row.status === "not_started" ? "未開始" : row.status === "limited" && !row.inventoryComplete ? `${row.current}件／対象1,000件超` : row.status === "limited" ? `${row.current}/${row.total}件（容量上限）` : `${row.current}/${row.total}件`, row.status === "limited" && !row.inventoryComplete ? "1,000件超（未集計）" : `${row.never + row.failed + row.stale}件`, `${row.currentFindingCount}件`],
        }))} />
      ) : null}
    </>
  );
}

function staticAuditCoverageSummary(coverage: SeoDashboardOutput["staticAuditCoverage"]): string {
  if (coverage.length === 0) return "公開ページの確認範囲：まだ集計していません";
  const notStarted = coverage.filter((row) => row.status === "not_started").length;
  const inventoryLimited = coverage.filter((row) => row.status === "limited" && !row.inventoryComplete).length;
  const capacityLimited = coverage.filter((row) => row.status === "limited" && row.inventoryComplete).length;
  const total = coverage.reduce((sum, row) => sum + row.total, 0);
  if (inventoryLimited > 0 || capacityLimited > 0) return `確認上限：${[
    inventoryLimited > 0 ? `公開ページ1,000件超${inventoryLimited}ブログ` : "",
    capacityLimited > 0 ? `一括確認容量超過${capacityLimited}ブログ` : "",
    notStarted > 0 ? `未開始${notStarted}ブログ` : "",
  ].filter(Boolean).join("・")}`;
  if (notStarted > 0) {
    const current = coverage.reduce((sum, row) => sum + row.current, 0);
    return `確認途中：公開ページ${current}/${total}件を確認済み・未開始${notStarted}ブログ`;
  }
  if (total === 0) return "確認する公開ページはありません";
  const current = coverage.reduce((sum, row) => sum + row.current, 0);
  const findings = coverage.reduce((sum, row) => sum + row.currentFindingCount, 0);
  const complete = current === total
    && coverage.every((row) => row.inventoryComplete && row.status === "published");
  if (complete) return `公開ページ${total}件を確認済み・所見${findings}件`;
  const never = coverage.reduce((sum, row) => sum + row.never, 0);
  const failed = coverage.reduce((sum, row) => sum + row.failed, 0);
  const stale = coverage.reduce((sum, row) => sum + row.stale, 0);
  return `確認途中：公開ページ${current}/${total}件を確認済み（未確認${never}・失敗${failed}・再確認待ち${stale}）`;
}

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return /^\d{4}$/.test(year ?? "") && /^\d{2}$/.test(month ?? "")
    ? `${Number(year)}年${Number(month)}月`
    : monthKey;
}

function citationBudgetSummary(budget: SeoDashboardOutput["citationMonthlyBudget"]): string {
  if (budget.limitSearches === null) return "AIの被引用チェック：月次上限が未設定";
  if (budget.limitSearches === 0) return "AIの被引用チェック：停止中（0回）";
  if (budget.usedSearches + budget.unconfirmedSearches >= budget.limitSearches) {
    return `AIの被引用チェック：今月の上限に到達（${formatMonth(budget.monthKey)}・UTC）`;
  }
  if (budget.reached && budget.reservedSearches > 0) {
    return `AIの被引用チェック：実行中（残りを確保中・${formatMonth(budget.monthKey)}・UTC）`;
  }
  return `AIの被引用チェック：残り${budget.remainingSearches ?? 0}回／上限${budget.limitSearches}回（${formatMonth(budget.monthKey)}・UTC）`;
}

const SOURCE_STATE_LABEL: Readonly<Record<string, string>> = {
  ok: "動いています",
  stalled: "止まっています",
  never_collected: "まだ 1 度も観測していません",
  not_configured: "鍵が未登録のため使っていません",
};

function FindingTable({
  caption,
  findings,
}: {
  readonly caption: string;
  readonly findings: readonly Finding[];
}) {
  return (
    <DataTable
      caption={caption}
      columns={[
        { key: "label", label: "所見" },
        { key: "page", label: "どの道" },
        { key: "detail", label: "中身" },
        { key: "hint", label: "どうすればよいか" },
        { key: "observed", label: "観測した時刻" },
      ]}
      rows={findings.map((f, i) => ({
        // 同じ道に同じ所見が 2 つ出ることは無いが、系統が違えば同じ組が出る。
        key: `${f.source}:${f.pageKey}:${f.code}:${i}`,
        cells: [
          FINDING_RULE[f.code].label,
          f.pageKey,
          f.detail,
          FINDING_RULE[f.code].hint,
          `${formatAt(f.observedAt)}（${labelOfSource(f.source)}）`,
        ],
      }))}
    />
  );
}

function labelOfSource(source: string): string {
  return MEASUREMENT_SOURCE_LABEL[source as keyof typeof MEASUREMENT_SOURCE_LABEL] ?? source;
}

/**
 * 時刻を人の読める形にする。
 *
 * 相対表記（「3 日前」）にしない。この画面で見るのは鮮度そのもので、
 * 「3 日前」だと**毎晩動いているはずのものが 3 日前で止まっている**ことに
 * 気づきにくい。日付が出ていれば、今日との差は自分で読める。
 */
function formatAt(at: string | null): string {
  if (at === null) return "—";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}
