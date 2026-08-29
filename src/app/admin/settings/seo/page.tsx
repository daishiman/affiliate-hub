import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  AcknowledgeGuidelineReopenForm,
  RecheckGuidelineReferenceForm,
  RegisterGuidelineReferenceForm,
  VerifyGuidelineSourceForm,
} from "@/presentation/admin/guideline-reference-form";
import { currentActor, guidelineReferenceEntry } from "@/presentation/composition";
import type { GuidelineReferenceListRow } from "@/application/usecases/seo/manage-guideline-references";
import {
  INITIAL_GUIDELINE_REFERENCES,
  type ReferenceReviewStatus,
  referenceReviewStatus,
} from "@/domain/seo/guideline-reference";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  ExternalLink,
  Note,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * SEO/AI 検索の指針の出典レジストリ。
 *
 * --- 保存先が無いときも画面ごと消さない ---
 * 登録の口は出せないが、初期候補 (URL・発行元) の一覧は出す。
 * どの指針を追うべきかの案内は、保存先が無いときにも要る。
 *
 * --- 90 日の判定は 1 か所 ---
 * 状態の列はドメインの `referenceReviewStatus` の結果だけを写す。
 * 画面側で日数を数え直さない。
 */
export default async function SeoGuidelineSettingsPage() {
  const entry = await guidelineReferenceEntry();

  return (
    <AdminShell
      routeId="settings/seo"
      title="SEO/AI 検索の指針"
      lead="指針の出典と確認日を管理します。"
      actions={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
    >
      {!entry.ready ? (
        <>
          <Callout tone="warn" title="いま出典を登録できません" reason={entry.reason} />
          <Section title="追うべき指針の候補">
            <ReferenceTable
              rows={INITIAL_GUIDELINE_REFERENCES.map((reference) => ({
                reference,
                // 表示専用の枝でも判定は同じ関数を使う。基準日はサーバの今日。
                status: referenceReviewStatus(reference, new Date().toISOString().slice(0, 10)),
                registered: false,
              }))}
              caption="保存先が用意されるまでの案内です。登録はまだできません。"
            />
          </Section>
        </>
      ) : (
        <GuidelineReferenceManager entry={entry} />
      )}
    </AdminShell>
  );
}

type ReadyEntry = Extract<
  Awaited<ReturnType<typeof guidelineReferenceEntry>>,
  { readonly ready: true }
>;

async function GuidelineReferenceManager({ entry }: { readonly entry: ReadyEntry }) {
  const actor = await currentActor();
  const listed = await entry.manage.execute(actor, { action: "list" });

  if (!listed.ok) {
    return (
      <ErrorView
        title="指針の出典を出せませんでした"
        body={listed.error.message}
        suggestedAction={listed.error.suggestedAction ?? null}
        action={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
      />
    );
  }

  const registered = listed.value.rows.filter((row) => row.registered);
  const candidates = listed.value.rows.filter((row) => !row.registered);
  // 手当てが要る行から先に並べる。この画面へ来る理由の大半がそれだからである。
  // 原典未取得を確認済みより前に置くのは、日付が新しくても根拠として弱いため。
  const rank: Readonly<Record<ReferenceReviewStatus, number>> = {
    review_due: 0,
    unverified: 1,
    verified_fresh: 2,
  };
  const reviewFirst = [...registered].sort((a, b) => rank[a.status] - rank[b.status]);

  return (
    <>
      <Section title="登録済みの出典">
        {registered.length === 0 ? (
          <EmptyView
            title="まだ出典を登録していません"
            body="下の候補を登録するか、新しい出典を登録してください。"
          />
        ) : (
          <ReferenceTable
            rows={reviewFirst}
            caption="「再確認」は確認日から 90 日を超えた出典、「原典未取得」は本文をまだ取り込んでいない出典です。"
          />
        )}
      </Section>

      {listed.value.reopenRequests.length > 0 && (
        <Section title="仕様を評価し直す対象">
          <Callout
            tone="warn"
            title={`${listed.value.reopenRequests.length} 件の指針は、仕様の根拠を見直す必要があります`}
            reason="理由を確認し、必要なら原典を取り込んで、該当する仕様章を評価し直してください。本文変更の行は、再評価後に完了を記録できます。"
          />
          <DataTable
            caption="出典と、その出典を根拠にしている仕様章です。"
            columns={[
              { key: "url", label: "出典" },
              { key: "reason", label: "理由" },
              { key: "chapters", label: "評価し直す章" },
              { key: "complete", label: "再評価後" },
            ]}
            rows={listed.value.reopenRequests.map((request) => ({
              key: request.referenceId,
              cells: [
                <ExternalLink key="url" href={request.url}>
                  {request.url}
                </ExternalLink>,
                REOPEN_REASON_LABELS[request.reason],
                request.chapters.map((chapter) => `system-spec/${chapter}.md`).join("、"),
                request.reason === "content_changed" ? (
                  <AcknowledgeGuidelineReopenForm
                    key="complete"
                    id={request.referenceId}
                    expectedContentSha256={request.contentSha256}
                  />
                ) : (
                  "原典を取り込み、該当章を評価してください"
                ),
              ],
            }))}
          />
        </Section>
      )}

      {registered.length > 0 && (
        <Section title="原典を取り込む">
          <Note>
            原典を開いて本文を貼り付けます。保存するのは取得時刻と本文の指紋だけで、本文は残しません。
            前回の指紋と変わっていれば、上の「仕様を評価し直す対象」に出ます。
          </Note>
          {registered.map((row) => (
            <VerifyGuidelineSourceForm
              key={row.reference.id}
              id={row.reference.id}
              title={row.reference.title}
            />
          ))}
        </Section>
      )}

      {reviewFirst.length > 0 && (
        <Section title="確認日を更新する">
          <Note>
            原典を取り込まずに日付だけ動かすと、状態は「原典未取得」のままです。
            読み直しただけの記録なので、それでよいときに使います。
          </Note>
          {reviewFirst.map((row) => (
            <RecheckGuidelineReferenceForm
              key={row.reference.id}
              id={row.reference.id}
              title={row.reference.title}
            />
          ))}
        </Section>
      )}

      {candidates.length > 0 && (
        <Section title="初期候補 (未登録)">
          <ReferenceTable
            rows={candidates}
            caption="コードに書いてある候補です。登録するまで保存先には入りません。"
          />
          {candidates.map((row) => (
            <RegisterGuidelineReferenceForm
              key={row.reference.id}
              prefill={{
                title: row.reference.title,
                url: row.reference.url,
                publisher: row.reference.publisher,
                region: row.reference.region,
                checkedAt: row.reference.checkedAt,
                ...(row.reference.note === undefined ? {} : { note: row.reference.note }),
              }}
            />
          ))}
        </Section>
      )}

      <Section title="新しい出典を登録する">
        <RegisterGuidelineReferenceForm />
        <Note>
          原典の URL を登録します。本文の写しは保存しません (古くなった写しが正本に見えるため)。
          登録した直後は「原典未取得」です。本文を取り込むと「原典確認済み」になります。
        </Note>
      </Section>
    </>
  );
}

/**
 * 状態の呼び名。
 *
 * 「確認済み」を原典未取得の行に使わない。要旨だけ読んだ行と原典を取った行が
 * 同じ言葉で並ぶと、画面の表示が実際の検証状態と食い違う。
 */
const STATUS_LABELS: Readonly<Record<ReferenceReviewStatus, string>> = {
  verified_fresh: "原典確認済み",
  review_due: "再確認",
  unverified: "原典未取得",
};

/** 再評価が要る理由の言い換え。何が起きたのでこの行が出ているのかを書く。 */
const REOPEN_REASON_LABELS = {
  content_changed: "原典の中身が前回と変わりました",
  review_due: "確認から 90 日を超えました",
  unverified: "原典の本文をまだ取得していません",
} as const;

/** 一覧表。登録済みと候補で同じ形にし、列の読み方を 1 度だけ覚えれば済むようにする。 */
function ReferenceTable({
  rows,
  caption,
}: {
  readonly rows: readonly GuidelineReferenceListRow[];
  readonly caption: string;
}) {
  return (
    <DataTable
      caption={caption}
      columns={[
        { key: "title", label: "タイトル" },
        { key: "publisher", label: "発行元" },
        { key: "region", label: "対象" },
        { key: "checkedAt", label: "確認日" },
        { key: "status", label: "状態" },
      ]}
      rows={rows.map((row) => ({
        key: row.reference.id,
        cells: [
          <ExternalLink key="url" href={row.reference.url}>
            {row.reference.title}
          </ExternalLink>,
          row.reference.publisher,
          row.reference.region === "jp" ? "日本" : "海外",
          row.reference.checkedAt,
          STATUS_LABELS[row.status],
        ],
      }))}
    />
  );
}
