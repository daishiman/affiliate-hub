import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * Analytics コンテキスト / 計測イベントの正本。
 *
 * **計測できることの一覧は、このファイルだけが持つ。**
 * 送る側（画面）・貯める側（保存先）・数える側（集計）がそれぞれ
 * イベント名の文字列を書くと、次のことが必ず起きる。
 *   - 画面が `cta_click`、集計が `click_cta` を見ていて、数字が永遠に 0
 *   - 項目を 1 つ足したのに、貯める側だけ古い形のまま
 * どちらも「壊れて見えない壊れ方」で、気づくのは数か月後になる。
 *
 * そこで**イベントの形をここで宣言し、送信・保存・集計の型をここから導く**。
 * 下の `TelemetryEvent` は手書きの型ではなく、この表から作られている。
 *
 * --- 計測点を画面に手で埋め込まない ---
 * このファイルはイベントの形だけを決める。**どこで発生するか**は、
 * 共通UIの部品が「自分が何か」を宣言することで決まる
 * (`src/presentation/ui/telemetry.tsx`)。
 * 画面ごとに送信コードを書くと、新しく作った画面だけ計測が抜ける。
 * 抜けても画面は正常に見えるため、抜けたことに気づけない。
 *
 * --- 同意が無くても壊れない ---
 * `consent: "none"` のイベントは、誰のものか分からない形でしか記録しない。
 * 同意が無い状態でも画面は普通に使え、数字は「人数」ではなく「回数」として残る。
 * 同意を前提にすると、断った人の分だけ画面が壊れる作りになりやすい。
 *
 * --- 入れてはいけないもの（例外なし） ---
 *   - 生の IP アドレス、詳しい位置
 *   - プロンプト本文、生成された文章そのもの（**参照 ID だけを持つ**）
 *   - 秘密情報、個人を直接特定できる値
 * `assertNoForbiddenField` が形の上でも落とす。
 */

/** 項目の型。`?` 付きは省略できる。 */
type FieldSpec = "string" | "number" | "boolean" | "string?" | "number?";

/**
 * 宣言（文字列）から実際の型を引く対応表。
 *
 * 引数に `extends FieldSpec` の縛りを付けない。付けると、下の
 * `TelemetryPayload` のように「表から辿った先」を渡すときに、
 * 型引数がまだ確定していない段階で縛りの検査が走って通らなくなる。
 * 表の側は `satisfies` で検査済みなので、ここで二重に縛る必要はない。
 * 知らない綴りは `never` になるため、間違いは黙って通らない。
 */
type FieldValue<S> = S extends "string"
  ? string
  : S extends "number"
    ? number
    : S extends "boolean"
      ? boolean
      : S extends "string?"
        ? string | undefined
        : S extends "number?"
          ? number | undefined
          : never;

/**
 * 同意の要る／要らない。
 *
 * `none`      : 同意が無くても記録する。個人を結び付けない数え方のみ。
 * `behaviour` : 読み方の細かい記録。同意が要る。
 */
export type ConsentRequirement = "none" | "behaviour";

/** イベントの分類。管理画面の並べ方に使う。 */
export type TelemetryCategory = "reader" | "commerce" | "ai" | "loop";

type EventSpec = {
  readonly label: string;
  readonly category: TelemetryCategory;
  readonly consent: ConsentRequirement;
  /** 何のために測るか。1 文で書けないものは計測しない。 */
  readonly why: string;
  readonly fields: Readonly<Record<string, FieldSpec>>;
};

/**
 * 計測できることの全一覧。
 *
 * ここに無いイベントは送れない（`buildTelemetryEvent` が弾く）。
 * 「とりあえず全部送っておく」を防ぐため、`why` を必須にしている。
 */
export const TELEMETRY_EVENTS = {
  page_view: {
    label: "ページを開いた",
    category: "reader",
    consent: "none",
    why: "どの記事が読まれているかを知る。人数ではなく回数として数える。",
    fields: {
      path: "string",
      siteSlug: "string",
      articleId: "string?",
      /** 参照元は「検索から / SNSから / 直接」の粗い区分だけ。URL 全体は持たない。 */
      referrerKind: "string",
    },
  },

  scroll_depth: {
    label: "どこまで読み進めたか",
    category: "reader",
    consent: "behaviour",
    why: "記事のどこで読むのをやめているかを知り、構成の直しどころを見つける。",
    fields: { path: "string", siteSlug: "string", percent: "number" },
  },

  section_dwell: {
    label: "節ごとに見ていた時間",
    category: "reader",
    consent: "behaviour",
    why: "時間をかけて読まれた節と、飛ばされた節を区別する。",
    fields: {
      path: "string",
      siteSlug: "string",
      /** 節の識別子。見出しブロック・比較表・CTA など、構造上のまとまり。 */
      sectionId: "string",
      sectionKind: "string",
      seconds: "number",
    },
  },

  element_click: {
    label: "どこを押したか",
    category: "reader",
    consent: "behaviour",
    why: "押された場所を知る。押されない導線は文言か位置が合っていない。",
    fields: {
      path: "string",
      siteSlug: "string",
      /** 部品が宣言する「自分が何か」。画面ごとに文字列を作らない。 */
      elementKind: "string",
      elementId: "string",
      /** 押した先が分かる短い名前。本文をそのまま入れない。 */
      label: "string?",
    },
  },

  ranking_row_click: {
    label: "順位表の行を押した",
    category: "commerce",
    consent: "behaviour",
    why: "何位の商品が実際に選ばれているかを知る。順位の付け方の検証に使う。",
    fields: {
      path: "string",
      siteSlug: "string",
      productId: "string",
      rank: "number",
    },
  },

  affiliate_click: {
    label: "成果リンクを押した",
    category: "commerce",
    consent: "none",
    why: "どのリンクが押されたかを数える。報酬の突合に要る。個人には結び付けない。",
    fields: {
      path: "string",
      siteSlug: "string",
      linkId: "string",
      productId: "string?",
      /** 記事のどこに置いたリンクか（本文中 / 比較表 / 記事末尾）。 */
      placement: "string",
      /**
       * どちらの経路で数えたか。`redirect` は転送の入口（`/go/`）で
       * サーバが数えたもの、`browser` は画面が送ったもの。
       *
       * **同じクリックを 2 度数えないための印であり、欠測の量を測る材料でもある。**
       * 転送の入口を通るリンクは画面側で数えない決まりだが、決まりだけでは
       * いつか破れる。どちらで数えたかを残しておけば、破れたことが数字に出る。
       */
      recordedVia: "string",
    },
  },

  internal_link_click: {
    label: "サイト内の別ページへ移った",
    category: "reader",
    consent: "behaviour",
    why: "回遊の経路を知る。関連記事の出し方の見直しに使う。",
    fields: { path: "string", siteSlug: "string", toPath: "string", placement: "string" },
  },

  search_performed: {
    label: "サイト内で探した",
    category: "reader",
    consent: "behaviour",
    why: "探しても見つからない言葉を知る。記事の不足がここに出る。",
    fields: {
      siteSlug: "string",
      /** 検索語。**同意がある場合だけ送る**（consent: behaviour）。 */
      query: "string",
      resultCount: "number",
    },
  },

  filter_changed: {
    label: "絞り込みを変えた",
    category: "reader",
    consent: "behaviour",
    why: "読者が実際に気にしている条件を知る。比較表の列の並べ替えに使う。",
    fields: { path: "string", siteSlug: "string", axis: "string", value: "string" },
  },

  page_exit: {
    label: "ページを離れた",
    category: "reader",
    consent: "behaviour",
    why: "離脱した位置と滞在時間。読み終えたのか、途中でやめたのかを分ける。",
    fields: {
      path: "string",
      siteSlug: "string",
      percent: "number",
      seconds: "number",
    },
  },

  ai_model_usage: {
    label: "AI を使った",
    category: "ai",
    consent: "none",
    why: "どのブログで誰がどのモデルをいくら使ったかを知る。費用の把握と割り当てに要る。",
    fields: {
      workspaceId: "string",
      brandId: "string?",
      siteSlug: "string?",
      /** 誰が動かしたか。人か、AI の実行用アカウントか。 */
      actorId: "string",
      modelId: "string",
      provider: "string",
      /** 何のための呼び出しか（下書き生成 / 見出し案 / 要約 など）。 */
      usecase: "string",
      promptTemplateId: "string?",
      promptTemplateVersion: "number?",
      inputTokens: "number",
      outputTokens: "number",
      durationMs: "number",
      success: "boolean",
      estimatedCostJpy: "number",
      /**
       * できあがったものへの**参照だけ**。
       * プロンプト本文や生成された文章そのものはここに入れない。
       * 入れると、消したはずの下書きが計測の記録として残り続ける。
       */
      artifactKind: "string?",
      artifactId: "string?",
    },
  },

  variant_exposure: {
    label: "どの型を見せたか",
    category: "loop",
    consent: "none",
    why: "改善ループの比較に要る。どの設定の組み合わせを見せたかを記録する。",
    fields: {
      path: "string",
      siteSlug: "string",
      /** Variant Spec の識別子。中身（設定の組み合わせ）は別に保存する。 */
      variantSpecId: "string",
      experimentId: "string?",
    },
  },
} as const satisfies Readonly<Record<string, EventSpec>>;

export type TelemetryEventKey = keyof typeof TELEMETRY_EVENTS;

export const TELEMETRY_EVENT_KEYS = Object.keys(TELEMETRY_EVENTS) as readonly TelemetryEventKey[];

/** 各イベントの中身の型。**手で書かず、上の表から導く。** */
export type TelemetryPayload<K extends TelemetryEventKey> = {
  readonly [F in keyof (typeof TELEMETRY_EVENTS)[K]["fields"]]: FieldValue<
    (typeof TELEMETRY_EVENTS)[K]["fields"][F]
  >;
};

/**
 * 送る・貯める・数えるが共通で使う形。
 *
 * `readerKey` は仮の目印であって、誰かを特定するものではない。
 * 作り方と消し方は `pseudonym.ts` が持つ。
 */
export type TelemetryEvent<K extends TelemetryEventKey = TelemetryEventKey> = {
  readonly key: K;
  readonly occurredAt: Date;
  /** 仮の目印。同意が無いときは null。 */
  readonly readerKey: string | null;
  readonly payload: TelemetryPayload<K>;
};

/**
 * 記録してはいけない項目名。
 *
 * 名前で落とすのは大雑把だが、**取りこぼしたときの被害が大きい**ので入口で止める。
 * 「後で消す」運用は必ず漏れる。
 */
const FORBIDDEN_FIELDS: readonly string[] = [
  "ip",
  "ipAddress",
  "remoteAddr",
  "latitude",
  "longitude",
  "geo",
  "email",
  "phone",
  "password",
  "token",
  "apiKey",
  "prompt",
  "promptText",
  "completion",
  "generatedText",
  "content",
  "body",
];

export function assertNoForbiddenField(
  payload: Readonly<Record<string, unknown>>,
): Result<true, DomainError> {
  const hit = Object.keys(payload).filter((k) =>
    FORBIDDEN_FIELDS.some((f) => f.toLowerCase() === k.toLowerCase()),
  );
  if (hit.length > 0) {
    return err(
      domainError("VALIDATION_FAILED", `計測に入れてはいけない項目が含まれています: ${hit.join("・")}`, {
        suggestedAction:
          "生の位置情報・連絡先・秘密情報・文章そのものは記録しません。参照する ID だけを送ってください。",
      }),
    );
  }
  return ok(true);
}

/**
 * イベントを組み立てる。**送信側はここを通す以外の方法を持たない。**
 *
 * 見ているのは 3 つ:
 *   1. 表に無いイベント名を拒む（打ち間違いをその場で落とす）
 *   2. 必須の項目が揃っているか（後から「その欄は空でした」を防ぐ）
 *   3. 記録してはいけない項目が混ざっていないか
 */
export function buildTelemetryEvent<K extends TelemetryEventKey>(input: {
  readonly key: K;
  readonly occurredAt: Date;
  readonly readerKey: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}): Result<TelemetryEvent<K>, DomainError> {
  const spec = TELEMETRY_EVENTS[input.key] as EventSpec | undefined;
  if (spec === undefined) {
    return err(
      domainError("VALIDATION_FAILED", `知らない計測イベントです: ${String(input.key)}`, {
        suggestedAction: `使えるのは ${TELEMETRY_EVENT_KEYS.join("・")} です。`,
      }),
    );
  }

  const forbidden = assertNoForbiddenField(input.payload);
  if (!forbidden.ok) return forbidden;

  /*
   * **宣言していない項目は入れない。**
   *
   * 2026-08-21 まで、ここは宣言された項目を見るだけで、
   * 表に無い項目は素通りして `payload` にそのまま保存されていた。
   * 落とせていたのは `FORBIDDEN_FIELDS` の 17 語に当たった名前だけなので、
   * `editorNote` のような名前を付ければ**生成された文章そのものを記録に残せた**
   * （実測。`ai_model_usage` で通した）。
   * 禁止語の一覧は「うっかり」を止める網であって、
   * 「参照 ID だけを持つ」を支える根拠にはならない。名前は無限に作れる。
   *
   * 表に無い項目を落とすほうを正とする。計測を足すときは登録表に足す。
   * それがこの節（P 節前書き①）の決めごとそのものである。
   */
  const undeclared = Object.keys(input.payload).filter(
    (name) => !Object.hasOwn(spec.fields, name),
  );
  if (undeclared.length > 0) {
    return err(
      domainError(
        "VALIDATION_FAILED",
        `計測イベント ${String(input.key)} に、登録表に無い項目が入っています: ${undeclared.join("・")}`,
        {
          suggestedAction:
            "記録したい項目は domain/analytics/telemetry-events.ts の登録表へ足してください。表に無い項目は保存しません（文章そのものが紛れ込む道になるため）。",
        },
      ),
    );
  }

  const missing: string[] = [];
  for (const [name, fieldSpec] of Object.entries(spec.fields)) {
    const optional = fieldSpec.endsWith("?");
    const value = input.payload[name];
    if (value === undefined || value === null) {
      if (!optional) missing.push(name);
      continue;
    }
    const base = fieldSpec.replace("?", "");
    if (base === "number" && typeof value !== "number") missing.push(`${name}（数字ではない）`);
    if (base === "string" && typeof value !== "string") missing.push(`${name}（文字ではない）`);
    if (base === "boolean" && typeof value !== "boolean")
      missing.push(`${name}（はい/いいえではない）`);
  }
  if (missing.length > 0) {
    return err(
      domainError(
        "VALIDATION_FAILED",
        `計測イベント ${String(input.key)} の項目が揃っていません: ${missing.join("・")}`,
        { suggestedAction: "項目の一覧は domain/analytics/telemetry-events.ts が正本です。" },
      ),
    );
  }

  return ok({
    key: input.key,
    occurredAt: input.occurredAt,
    // 同意が要るイベントで目印が無い場合も、記録自体は残す（回数として数える）。
    readerKey: input.readerKey,
    payload: input.payload as TelemetryPayload<K>,
  });
}

/** そのイベントが同意を要するか。 */
export function requiresConsent(key: TelemetryEventKey): boolean {
  return TELEMETRY_EVENTS[key].consent === "behaviour";
}

/** 管理画面に出す一覧。画面はイベント名を書き起こさない。 */
export function listTelemetryEvents(): readonly {
  readonly key: TelemetryEventKey;
  readonly label: string;
  readonly category: TelemetryCategory;
  readonly consent: ConsentRequirement;
  readonly why: string;
  readonly fieldNames: readonly string[];
}[] {
  return TELEMETRY_EVENT_KEYS.map((key) => {
    const spec = TELEMETRY_EVENTS[key] as EventSpec;
    return {
      key,
      label: spec.label,
      category: spec.category,
      consent: spec.consent,
      why: spec.why,
      fieldNames: Object.keys(spec.fields),
    };
  });
}
