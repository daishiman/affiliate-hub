import type { ReaderToolDefinition } from "@/application/ports/reader-interaction";
import type { DomainError } from "@/domain/shared";
import { ErrorView, Note, SectionHeading } from "@/presentation/ui";
import { ReaderToolForm } from "./reader-tool-form";

/**
 * 道具の操作できる部分（入力欄・結果の読み方・結果）。
 *
 * 記事が書かれていてもいなくても、**同じものを出す**。
 * 画面を 2 通り書くと、片方だけ「結果の読み方」を落とした状態が作れる。
 * 数字だけが出て解釈が無い画面は、読者がそれを信じて物を買う場所になる。
 */
export function ReaderToolSection({
  action,
  definition,
  values,
  run,
}: {
  /** 送信先。自分自身の URL。 */
  readonly action: string;
  readonly definition: ReaderToolDefinition;
  readonly values: Readonly<Record<string, string>>;
  /** まだ 1 度も送っていなければ null。 */
  readonly run:
    | { readonly ok: true; readonly value: ToolRunView }
    | { readonly ok: false; readonly error: DomainError }
    | null;
}) {
  return (
    <>
      <ReaderToolForm
        action={action}
        toolSlug={definition.slug}
        toolPurpose={definition.purpose}
        inputs={definition.inputs}
        initialValues={values}
      />

      <section>
        <SectionHeading level={2}>結果の読み方</SectionHeading>
        <p>{definition.howToRead}</p>
      </section>

      {run === null ? null : run.ok ? (
        <section>
          <SectionHeading level={2}>結果</SectionHeading>
          <p>{run.value.summary}</p>
          <dl>
            {run.value.rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <Note>入力した数字から計算した目安です。実際の値は使い方や機器によって変わります。</Note>
        </section>
      ) : (
        // 入力の不足・書き間違いと、道具そのものの不備を、同じ見出しで出さない。
        // 読者から見て「自分が直せること」なのかどうかが、見出しで分かるようにする。
        <ErrorView
          title={
            run.error.code === "VALIDATION_FAILED" ? "入力を見直してください" : "まだ計算できません"
          }
          body={`${run.error.message}${
            run.error.suggestedAction === undefined ? "" : ` ${run.error.suggestedAction}`
          }`}
        />
      )}
    </>
  );
}

type ToolRunView = {
  readonly summary: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
};
