"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Checkbox,
  Field,
  FormResult,
  FormValue,
  HumanOnlyForm,
  Select,
  TextArea,
} from "@/presentation/ui";
import { editDisclosureAction, editPolicyRuleAction } from "./compliance-action";
import { INITIAL_COMPLIANCE_STATE } from "./compliance-state";
import {
  EDITORIAL_INFLUENCE_OPTIONS,
  POLICY_CHANNEL_OPTIONS,
  POLICY_DOMAIN_OPTIONS,
  POLICY_SEVERITY_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "./compliance-labels";

/**
 * 広告表記も表記のきまりも、AI からは変えられない。
 *
 * ここは**検出される側が、検出の条件を書き換えられる**場所である。
 * 記事を書くのは AI で、その記事に当たるきまりを同じ AI が止められるなら、
 * 確認は形だけになる。広告表記も同じで、読者へ「広告です」と出すかどうかを
 * 出す側の機械に決めさせない。
 */
const HUMAN_ONLY_REASON =
  "記事を書くのは AI で、その記事に当たるきまりを同じ AI が止められると、" +
  "表現の確認は形だけになる。広告であることの表示も、出す側の機械ではなく" +
  "人が決める（景品表示法・ステマ規制の名宛人は事業者である）。";

/**
 * 広告表記を登録・変更する。
 *
 * **読者に出る文の入力欄が無い。**選ぶのは関係の種類と関与の範囲までで、
 * 文そのものは domain が組み立てる。ここに文の欄を置くと必ず短縮され、
 * 「PR」だけの判別しにくい表示になる。
 */
export function EditDisclosureForm({
  disclosureId = "",
  defaults,
}: {
  readonly disclosureId?: string;
  readonly defaults?: {
    readonly relationshipType: string;
    readonly advertiserOrSupplier: string;
    readonly editorialInfluence: string;
    readonly aiAssisted: boolean;
  };
}) {
  const [state, action, pending] = useActionState(editDisclosureAction, INITIAL_COMPLIANCE_STATE);
  const [relationshipType, setRelationshipType] = useState(defaults?.relationshipType ?? "");
  const [influence, setInfluence] = useState(defaults?.editorialInfluence ?? "");
  const [advertiser, setAdvertiser] = useState(defaults?.advertiserOrSupplier ?? "");
  const [reason, setReason] = useState("");

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      {disclosureId === "" ? null : <FormValue name="disclosureId" value={disclosureId} />}

      <Select
        name="relationshipType"
        label="広告主・提供元との関係"
        value={relationshipType}
        onValueChange={setRelationshipType}
        options={RELATIONSHIP_OPTIONS}
        placeholder="選んでください"
        error={state.field === "relationshipType" ? state.message : null}
        hint="ここで選んだ言葉が、そのまま読者に出る文の先頭になります。"
      />
      <Select
        name="editorialInfluence"
        label="広告主が内容へ関わった範囲"
        value={influence}
        onValueChange={setInfluence}
        options={EDITORIAL_INFLUENCE_OPTIONS}
        placeholder="選んでください"
        error={state.field === "editorialInfluence" ? state.message : null}
      />
      <Field
        name="advertiserOrSupplier"
        label="提供元の名前"
        value={advertiser}
        onValueChange={setAdvertiser}
        optional
        error={state.field === "advertiserOrSupplier" ? state.message : null}
        hint="広告主が内容確認を行う場合は必須です（誰の確認を経た記事かが読者に分からないため）。"
      />

      {/*
        はい/いいえ 1 つなので `CheckboxGroup`（複数から選ぶ欄）ではなく `Checkbox` を使う。
        素の `<input type="checkbox">` を直に置くと押しどころが下限に届かない。
        送信時は「入っているか」だけを見る。
      */}
      <Checkbox
        name="aiAssisted"
        label="本文の作成に AI を使っている（読者に出る文へ 1 文足されます）"
        defaultChecked={defaults?.aiAssisted ?? false}
      />

      <TextArea
        name="reason"
        label="変える理由"
        value={reason}
        onValueChange={setReason}
        optional
        rows={2}
        hint="操作の記録に残ります。空のままでも記録は残りますが、後から読む人には「なぜ変わったか」が分かりません。"
      />

      <Button type="submit" tone="primary" busy={pending} busyLabel="保存しています">
        この広告表記にする
      </Button>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/**
 * 表記のきまりを 1 件足す。
 *
 * 根拠と代わりの書き方を必須にしている。**止められた人が次に何をすればよいか**が
 * 無いきまりは、公開を止めるだけで直し方を教えない。
 */
export function AddPolicyRuleForm() {
  const [state, action, pending] = useActionState(editPolicyRuleAction, INITIAL_COMPLIANCE_STATE);
  const [name, setName] = useState("");
  const [domainScope, setDomainScope] = useState("general");
  const [channelScope, setChannelScope] = useState("any");
  const [severity, setSeverity] = useState("warn");
  const [pattern, setPattern] = useState("");
  const [basis, setBasis] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [reason, setReason] = useState("");

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="intent" value="save" />

      <Field
        name="name"
        label="きまりの名前"
        value={name}
        onValueChange={setName}
        error={state.field === "name" ? state.message : null}
        hint="記事を書く人が違反の一覧で見る名前です。"
      />
      <Select
        name="domainScope"
        label="効く分野"
        value={domainScope}
        onValueChange={setDomainScope}
        options={POLICY_DOMAIN_OPTIONS}
        error={state.field === "domainScope" ? state.message : null}
      />
      <Select
        name="channelScope"
        label="効く出し先"
        value={channelScope}
        onValueChange={setChannelScope}
        options={POLICY_CHANNEL_OPTIONS}
        error={state.field === "channelScope" ? state.message : null}
      />
      <Select
        name="severity"
        label="当たったときどうするか"
        value={severity}
        onValueChange={setSeverity}
        options={POLICY_SEVERITY_OPTIONS}
        error={state.field === "severity" ? state.message : null}
      />
      <Field
        name="pattern"
        label="見つける言い回し"
        value={pattern}
        onValueChange={setPattern}
        error={state.field === "pattern" ? state.message : null}
        hint="正規表現で書きます。例: 日本一|世界一（大文字小文字は区別しません）"
      />
      <Field
        name="basis"
        label="根拠"
        value={basis}
        onValueChange={setBasis}
        error={state.field === "basis" ? state.message : null}
        hint="どの法令・規約・社内規程によるか。書かれていないきまりは、後から誰も直せません。"
      />
      <TextArea
        name="suggestion"
        label="代わりの書き方"
        value={suggestion}
        onValueChange={setSuggestion}
        rows={2}
        error={state.field === "suggestion" ? state.message : null}
        hint="止められた人がそのまま使える言い換えを書きます。"
      />
      <TextArea
        name="reason"
        label="足す理由"
        value={reason}
        onValueChange={setReason}
        optional
        rows={2}
      />

      <Button type="submit" tone="primary" busy={pending} busyLabel="保存しています">
        このきまりを足す
      </Button>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/**
 * 効いているきまりを止める。
 *
 * **行は消さない。**消せる形にすると、過去の記事がどのきまりで確認されたのかが
 * 後から辿れなくなる。止めたことは操作の記録（`policy_rule.changed`）に残る。
 */
export function StopPolicyRuleForm({
  ruleId,
  name,
}: {
  readonly ruleId: string;
  readonly name: string;
}) {
  const [state, action, pending] = useActionState(editPolicyRuleAction, INITIAL_COMPLIANCE_STATE);
  const [reason, setReason] = useState("");

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="intent" value="set_enabled" />
      <FormValue name="ruleId" value={ruleId} />
      <FormValue name="enabled" value="false" />

      <TextArea
        name="reason"
        label={`「${name}」を止める理由`}
        value={reason}
        onValueChange={setReason}
        optional
        rows={2}
        hint="止めても、すでに承認された記事は確認し直されません。"
      />
      <Button type="submit" busy={pending} busyLabel="止めています">
        このきまりを止める
      </Button>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}
