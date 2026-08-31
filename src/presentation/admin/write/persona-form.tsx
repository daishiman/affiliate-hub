"use client";

import { useActionState, useState } from "react";
import type { Tone } from "@/domain/authoring";
import { Button, Field, FormResult, Select, TextArea, TextLink, ToolForm } from "@/presentation/ui";
import {
  createAudiencePersonaAction,
  createAuthorPersonaAction,
} from "./persona-form-action";
import {
  DEFAULT_TONE_VALUE,
  INITIAL_PERSONA_FORM_STATE,
  TONE_AXES,
  TONE_AXIS_LABELS,
  type PersonaFormState,
} from "./persona-form-state";

/**
 * 書き手・読者像を登録する欄。
 *
 * **一覧の中に登録欄を混ぜていない。** 一覧は「決めたものを見返す」画面で、
 * ここは「まだ無いものを決める」画面である。混ぜると、見返しに来た人の目の前に
 * 常に空の入力欄が並ぶ。
 *
 * 書き手と読者像を 1 つの部品にしていない理由は `persona-form-action.ts` と同じ。
 * 決める順番も決める人も違うので、片方だけ埋まった状態を保存できる形にしない。
 */

const PERSONA_TYPE_OPTIONS = [
  { value: "real_person", label: "実在の人物（名前を出して署名する）" },
  { value: "editorial_team", label: "編集部（個人名を出さない）" },
  { value: "brand_character", label: "ブランドキャラクター（架空の人格）" },
];

const KNOWLEDGE_LEVEL_OPTIONS = [
  { value: "beginner", label: "はじめて（前提から説明する）" },
  { value: "intermediate", label: "ある程度知っている" },
  { value: "expert", label: "詳しい（用語をそのまま使ってよい）" },
];

const AWARENESS_STAGE_OPTIONS = [
  { value: "unaware", label: "困っていることに気づいていない" },
  { value: "problem_aware", label: "困っていることは分かっている" },
  { value: "solution_aware", label: "解決の手段があることを知っている" },
  { value: "product_aware", label: "具体的な商品まで知っている" },
];

const DETAIL_LEVEL_OPTIONS = [
  { value: "short", label: "短く（結論だけ）" },
  { value: "standard", label: "ふつう" },
  { value: "detailed", label: "詳しく（根拠まで）" },
];

const LINE_HINT = "1 行に 1 件で書きます。読点で区切ると、区切ったつもりのない場所で切れます。";

/** 文体 6 軸の初期値。まんなかにする理由は `persona-form-state.ts` に書いた。 */
const INITIAL_TONE: Record<keyof Tone, string> = {
  formality: String(DEFAULT_TONE_VALUE),
  analytical: String(DEFAULT_TONE_VALUE),
  emotional: String(DEFAULT_TONE_VALUE),
  assertiveness: String(DEFAULT_TONE_VALUE),
  humor: String(DEFAULT_TONE_VALUE),
  emojiUsage: String(DEFAULT_TONE_VALUE),
};

/**
 * 書き手を登録する欄。
 *
 * **事実の範囲（`factBoundary`）を同じ画面で求める。** 後から足せる形にすると、
 * 範囲の空いた書き手で記事が書かれ、公開直前の判定で初めて止まる。
 * 止まるのは正しいが、そこまで書いた文章が丸ごと無駄になる。
 */
export function CreateAuthorPersonaForm() {
  const [state, action, pending] = useActionState(
    createAuthorPersonaAction,
    INITIAL_PERSONA_FORM_STATE,
  );
  const [displayName, setDisplayName] = useState("");
  const [personaType, setPersonaType] = useState("");
  const [role, setRole] = useState("");
  const [expertise, setExpertise] = useState("");
  const [verifiedCredentials, setVerifiedCredentials] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState("");
  const [firstPersonPronoun, setFirstPersonPronoun] = useState("");
  const [readerAddress, setReaderAddress] = useState("");
  const [tone, setTone] = useState<Record<keyof Tone, string>>(INITIAL_TONE);
  const [prohibitedPhrases, setProhibitedPhrases] = useState("");
  const [factBoundary, setFactBoundary] = useState("");
  const [disclosureStyle, setDisclosureStyle] = useState("");
  const [ctaStyle, setCtaStyle] = useState("");

  // ブランドキャラクターには資格も経験年数も持たせられない (§13.3)。
  // 断るのは domain だが、**入れられる欄を出したまま断ると**
  // 「入れたのに消された」に見える。選んだ時点で欄を引っ込める。
  const isFictional = personaType === "brand_character";

  return (
    <ToolForm
      action={action}
      toolName="save_author_persona"
      toolDescription="書き手を登録する。どの立場で、どの文体で、どこまでを事実として書けるかを決める"
    >
      <Field
        name="displayName"
        label="表示名"
        value={displayName}
        onValueChange={setDisplayName}
        error={state.field === "displayName" ? state.message : null}
        toolParamDescription="記事に出す書き手の名前"
      />
      <Select
        name="personaType"
        label="書き手の種類"
        value={personaType}
        onValueChange={setPersonaType}
        options={PERSONA_TYPE_OPTIONS}
        placeholder="選んでください"
        hint="架空の人格には資格や経験年数を持たせられません。読者を誤認させるためです。"
        error={state.field === "personaType" ? state.message : null}
        toolParamDescription="書き手の種類"
      />
      <Field
        name="role"
        label="肩書き"
        value={role}
        onValueChange={setRole}
        hint="「家電レビュー担当」のように、どの立場で書くかが分かる書き方にします。"
        error={state.field === "role" ? state.message : null}
        toolParamDescription="書き手の肩書き"
      />
      <TextArea
        name="expertise"
        label="得意分野"
        value={expertise}
        onValueChange={setExpertise}
        rows={3}
        optional
        hint={LINE_HINT}
        toolParamDescription="この書き手が詳しい分野（1 行に 1 件）"
      />

      {isFictional ? null : (
        <>
          <TextArea
            name="verifiedCredentials"
            label="実在する資格"
            value={verifiedCredentials}
            onValueChange={setVerifiedCredentials}
            rows={3}
            optional
            hint={`${LINE_HINT} 実際に持っている資格だけを書きます。`}
            error={state.field === "verifiedCredentials" ? state.message : null}
            toolParamDescription="実在する資格（1 行に 1 件）"
          />
          <Field
            name="experienceYears"
            label="経験年数"
            type="number"
            min={0}
            value={experienceYears}
            onValueChange={setExperienceYears}
            optional
            unit="年"
            error={state.field === "experienceYears" ? state.message : null}
            toolParamDescription="この分野の経験年数"
          />
        </>
      )}

      <Select
        name="knowledgeLevel"
        label="読者に対する詳しさ"
        value={knowledgeLevel}
        onValueChange={setKnowledgeLevel}
        options={KNOWLEDGE_LEVEL_OPTIONS}
        placeholder="選んでください"
        error={state.field === "knowledgeLevel" ? state.message : null}
        toolParamDescription="書き手の知識の水準"
      />
      <Field
        name="firstPersonPronoun"
        label="一人称"
        value={firstPersonPronoun}
        onValueChange={setFirstPersonPronoun}
        hint="「私」「編集部」など。文章の中でこの書き手が自分を指す言い方です。"
        error={state.field === "firstPersonPronoun" ? state.message : null}
        toolParamDescription="書き手の一人称"
      />
      <Field
        name="readerAddress"
        label="読者の呼び方"
        value={readerAddress}
        onValueChange={setReaderAddress}
        hint="「あなた」「みなさん」など。"
        error={state.field === "readerAddress" ? state.message : null}
        toolParamDescription="読者の呼び方"
      />

      <ToneFields values={tone} onChange={setTone} error={state.field === "tone" ? state.message : null} />

      <TextArea
        name="factBoundary"
        label="事実として書いてよい範囲"
        value={factBoundary}
        onValueChange={setFactBoundary}
        rows={4}
        hint={`${LINE_HINT} ここに無いことを一人称の体験として書くと、公開前に止まります。`}
        error={state.field === "factBoundary" ? state.message : null}
        toolParamDescription="この書き手が事実として書ける範囲（1 行に 1 件）"
      />
      <TextArea
        name="prohibitedPhrases"
        label="使わせない言い回し"
        value={prohibitedPhrases}
        onValueChange={setProhibitedPhrases}
        rows={3}
        optional
        hint={LINE_HINT}
        toolParamDescription="この書き手に使わせない言い回し（1 行に 1 件）"
      />
      <Field
        name="disclosureStyle"
        label="広告表記の書き方"
        value={disclosureStyle}
        onValueChange={setDisclosureStyle}
        hint="広告が含まれることを、この書き手がどう断るかの言い方です。"
        error={state.field === "disclosureStyle" ? state.message : null}
        toolParamDescription="広告表記の言い回し"
      />
      <Field
        name="ctaStyle"
        label="読者を誘うときの書き方"
        value={ctaStyle}
        onValueChange={setCtaStyle}
        hint="「気になったら公式サイトで確かめてください」のような、締めの言い方です。"
        error={state.field === "ctaStyle" ? state.message : null}
        toolParamDescription="読者への呼びかけの言い回し"
      />

      <FormResult
        state={state}
        doneAction={
          state.personaListPath === undefined ? undefined : (
            <TextLink href={state.personaListPath}>書き手の一覧へ</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "この書き手を登録する"}
      </Button>
    </ToolForm>
  );
}

/**
 * 文体の 6 軸の入力欄。
 *
 * 軸を 1 本ずつ書き下していない。軸は `Tone` が持っていて、増減はそちらで起きる。
 * ここで写しを持つと、足した軸が画面にだけ出ない状態が作れてしまう。
 *
 * --- なぜ数の欄なのか（3 つのうちから選んだ理由）---
 *
 * 「低め・ふつう・高め」の 3 段に畳む案を採らなかった。畳むと入力はたしかに
 * 易しくなるが、**この画面が表せない値が保存先に入り得る**。AI から
 * `save_author_persona` を 0.35 で呼ぶのは正当な使い方で、そのとき
 * 3 段の欄は 0.35 をどれとしても表示できない。画面と道具で入れられる値が
 * 違うのは「画面でできることは AI からもできる」の裏返しの破れである。
 *
 * `range` も採らなかった。つまみの位置は目には分かるが、読み上げでは
 * いま幾つなのかが読まれない。6 本並ぶので、1 本ずつ確かめる手段が要る。
 *
 * 値域（0.0〜1.0）の判定はここに書かない。`createAuthorPersona` が持っていて、
 * 画面にも同じ判定を置くと、片方だけ直したときに通る値が食い違う。
 * `min`/`max` は入力の助けであって検査ではない。
 */
function ToneFields({
  values,
  onChange,
  error,
}: {
  readonly values: Record<keyof Tone, string>;
  readonly onChange: (next: Record<keyof Tone, string>) => void;
  readonly error: string | null;
}) {
  return (
    <>
      {TONE_AXES.map((axis, index) => (
        <Field
          key={axis}
          name={`tone.${axis}`}
          label={TONE_AXIS_LABELS[axis]}
          type="number"
          step={0.1}
          min={0}
          max={1}
          value={values[axis]}
          onValueChange={(next) => onChange({ ...values, [axis]: next })}
          // 目盛りの意味は 6 本で 1 度だけ言う。毎行に書くと、
          // 読むところが 6 倍になって、軸ごとの違いが埋もれる。
          hint={index === 0 ? "0.0（弱い）〜 1.0（強い）。決めていなければ 0.5 のままで構いません。" : undefined}
          // 断りは 6 軸まとめて 1 つしか返らない。どの軸が悪いかは業務側が
          // 区別していないので、区別しているふりをして各行に出さない。
          error={index === 0 ? error : null}
          toolParamDescription={`文体の「${TONE_AXIS_LABELS[axis]}」（0.0〜1.0）`}
        />
      ))}
    </>
  );
}

/**
 * 読者像を登録する欄。
 *
 * **判断基準を必須にしている。** ここが空の読者像で比較表を組むと、列が立たない。
 * 「あとで足す」を許すと、列の無い比較表が公開まで進む。
 */
export function CreateAudiencePersonaForm() {
  const [state, action, pending] = useActionState(
    createAudiencePersonaAction,
    INITIAL_PERSONA_FORM_STATE,
  );
  const [name, setName] = useState("");
  const [primaryJob, setPrimaryJob] = useState("");
  const [currentSituation, setCurrentSituation] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState("");
  const [awarenessStage, setAwarenessStage] = useState("");
  const [decisionCriteria, setDecisionCriteria] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [objections, setObjections] = useState("");
  const [budgetContext, setBudgetContext] = useState("");
  const [timeContext, setTimeContext] = useState("");
  const [preferredDetailLevel, setPreferredDetailLevel] = useState("");
  const [preferredTone, setPreferredTone] = useState("");
  const [desiredEmotionalState, setDesiredEmotionalState] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [prohibitedAssumptions, setProhibitedAssumptions] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="save_audience_persona"
      toolDescription="読者像を登録する。誰に向けて書くか、何を比べたいかを決める"
    >
      <Field
        name="name"
        label="呼び名"
        value={name}
        onValueChange={setName}
        hint="「はじめてのひとり暮らし」のように、誰のことか思い出せる名前にします。"
        error={state.field === "name" ? state.message : null}
        toolParamDescription="読者像の呼び名"
      />
      <Field
        name="primaryJob"
        label="片付けたい用事"
        value={primaryJob}
        onValueChange={setPrimaryJob}
        hint="1 文で書きます。この読者が「そもそも何をしたくて」検索したかです。"
        error={state.field === "primaryJob" ? state.message : null}
        toolParamDescription="この読者が片付けたい用事"
      />
      <TextArea
        name="currentSituation"
        label="いまの状況"
        value={currentSituation}
        onValueChange={setCurrentSituation}
        rows={3}
        optional
        toolParamDescription="この読者が置かれている状況"
      />
      <Field
        name="desiredOutcome"
        label="どうなりたいか"
        value={desiredOutcome}
        onValueChange={setDesiredOutcome}
        error={state.field === "desiredOutcome" ? state.message : null}
        toolParamDescription="この読者が望む結果"
      />
      <Select
        name="knowledgeLevel"
        label="この分野の詳しさ"
        value={knowledgeLevel}
        onValueChange={setKnowledgeLevel}
        options={KNOWLEDGE_LEVEL_OPTIONS}
        placeholder="選んでください"
        error={state.field === "knowledgeLevel" ? state.message : null}
        toolParamDescription="読者の知識の水準"
      />
      <Select
        name="awarenessStage"
        label="どこまで気づいているか"
        value={awarenessStage}
        onValueChange={setAwarenessStage}
        options={AWARENESS_STAGE_OPTIONS}
        placeholder="選んでください"
        hint="ここで記事の入り方が変わります。気づいていない読者に商品名から入ると読まれません。"
        error={state.field === "awarenessStage" ? state.message : null}
        toolParamDescription="読者の認知段階"
      />
      <TextArea
        name="decisionCriteria"
        label="何で決めるか"
        value={decisionCriteria}
        onValueChange={setDecisionCriteria}
        rows={4}
        hint={`${LINE_HINT} ここに書いたものが、そのまま比較表の列になります。`}
        error={state.field === "decisionCriteria" ? state.message : null}
        toolParamDescription="この読者の判断基準（1 行に 1 件）"
      />
      <TextArea
        name="painPoints"
        label="困っていること"
        value={painPoints}
        onValueChange={setPainPoints}
        rows={3}
        optional
        hint={LINE_HINT}
        toolParamDescription="この読者が困っていること（1 行に 1 件）"
      />
      <TextArea
        name="objections"
        label="ためらう理由"
        value={objections}
        onValueChange={setObjections}
        rows={3}
        optional
        hint={LINE_HINT}
        toolParamDescription="この読者が買うのをためらう理由（1 行に 1 件）"
      />
      <Field
        name="budgetContext"
        label="予算の事情"
        value={budgetContext}
        onValueChange={setBudgetContext}
        optional
        hint="空のままなら「決めていない」として扱います。"
        toolParamDescription="この読者の予算の事情"
      />
      <Field
        name="timeContext"
        label="時間の事情"
        value={timeContext}
        onValueChange={setTimeContext}
        optional
        hint="「今週中に買いたい」など。空のままなら「決めていない」として扱います。"
        toolParamDescription="この読者の時間の事情"
      />
      <Select
        name="preferredDetailLevel"
        label="どのくらい詳しく読みたいか"
        value={preferredDetailLevel}
        onValueChange={setPreferredDetailLevel}
        options={DETAIL_LEVEL_OPTIONS}
        placeholder="選んでください"
        error={state.field === "preferredDetailLevel" ? state.message : null}
        toolParamDescription="この読者が好む詳しさ"
      />
      <Field
        name="preferredTone"
        label="好まれる語り口"
        value={preferredTone}
        onValueChange={setPreferredTone}
        hint="「落ち着いた説明」「親しみやすく」など。"
        error={state.field === "preferredTone" ? state.message : null}
        toolParamDescription="この読者が好む語り口"
      />
      <Field
        name="desiredEmotionalState"
        label="読み終えたときの気持ち"
        value={desiredEmotionalState}
        onValueChange={setDesiredEmotionalState}
        hint="「これで選べると納得している」など。"
        error={state.field === "desiredEmotionalState" ? state.message : null}
        toolParamDescription="読み終えた読者の気持ち"
      />
      <Field
        name="nextAction"
        label="読み終えてしてほしいこと"
        value={nextAction}
        onValueChange={setNextAction}
        error={state.field === "nextAction" ? state.message : null}
        toolParamDescription="読み終えた読者にしてほしい行動"
      />
      <TextArea
        name="prohibitedAssumptions"
        label="決めつけてはいけないこと"
        value={prohibitedAssumptions}
        onValueChange={setProhibitedAssumptions}
        rows={3}
        optional
        hint={`${LINE_HINT} 「当然知っている」と書いてはいけないことです。`}
        toolParamDescription="決めつけてはいけないこと（1 行に 1 件）"
      />

      <FormResult
        state={state}
        doneAction={
          state.personaListPath === undefined ? undefined : (
            <TextLink href={state.personaListPath}>読者像の一覧へ</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "この読者像を登録する"}
      </Button>
    </ToolForm>
  );
}

export type { PersonaFormState };
