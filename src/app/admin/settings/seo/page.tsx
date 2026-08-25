import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  RecheckGuidelineReferenceForm,
  RegisterGuidelineReferenceForm,
} from "@/presentation/admin/guideline-reference-form";
import { currentActor, guidelineReferenceEntry } from "@/presentation/composition";
import type { GuidelineReferenceListRow } from "@/application/usecases/seo/manage-guideline-references";
import {
  INITIAL_GUIDELINE_REFERENCES,
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
  // 再確認が要る行から先に並べる。この画面へ来る理由の大半がそれだからである。
  const reviewFirst = [...registered].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "review_due" ? -1 : 1,
  );

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
            caption="「再確認」は確認日から 90 日を超えた出典です。原典を読み直してから確認日を更新します。"
          />
        )}
      </Section>

      {reviewFirst.length > 0 && (
        <Section title="確認日を更新する">
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
        </Note>
      </Section>
    </>
  );
}

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
          row.status === "review_due" ? "再確認" : "確認済み",
        ],
      }))}
    />
  );
}
