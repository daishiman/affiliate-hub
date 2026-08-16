/**
 * 取り込んだ文章を指示として実行させないための備え（生成基盤設計 §1-4）。
 *
 * 素材には外部由来の文章（商品説明・リンクの説明文・他所の評価）が混ざる。
 * その中に「これまでの指示を無視して」と書いておけば、
 * 素材を読ませた側の指示を上書きできてしまう。
 *
 * ここでの決めごとは 2 つ。
 *   1. **見つけても自動で消さない。** 消して通すと、
 *      仕掛けられたこと自体が誰にも見えなくなる。人の確認へ回す。
 *   2. 出てきた URL は素材にあるものだけを残す。
 *      素材に無い URL は、どこから来たか説明できない。
 */

export type InjectionPattern = {
  readonly id: string;
  readonly pattern: RegExp;
  /** 何を狙った書き方か。人が確認するときに読む。 */
  readonly whatItTries: string;
};

export const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  {
    id: "ignore_previous",
    pattern: /(以上|これまで|上記)の(指示|命令|ルール)を?(無視|忘れ)/,
    whatItTries: "先に渡した決まりを取り消させる書き方です。",
  },
  {
    id: "ignore_previous_en",
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
    whatItTries: "先に渡した決まりを取り消させる書き方です（英語）。",
  },
  {
    id: "system_prompt",
    pattern: /system\s*prompt|システムプロンプト/i,
    whatItTries: "土台の指示を引き出す、または置き換えようとする書き方です。",
  },
  {
    id: "role_override",
    pattern: /あなたは(今|これ)から|you\s+are\s+now\s+a/i,
    whatItTries: "役割を勝手に付け替えようとする書き方です。",
  },
  {
    id: "reveal_secret",
    pattern: /(APIキー|api[_\s-]?key|秘密の値|認証情報)を?(教え|出力|表示)/i,
    whatItTries: "秘密の値を出させようとする書き方です。",
  },
  {
    id: "tool_call",
    pattern: /(公開|送信|課金|削除)して(ください|くれ)|call\s+the\s+\w+\s+tool/i,
    whatItTries: "資料のふりをして操作を実行させようとする書き方です。",
  },
  {
    id: "fence_escape",
    pattern: /<<<\s*(END_)?UNTRUSTED_SOURCE\s*>>>|<\/untrusted_source>/i,
    whatItTries: "資料の囲みを自分で閉じて、指示の側へ抜け出そうとする書き方です。",
  },
];

export type InjectionFinding = {
  readonly patternId: string;
  readonly whatItTries: string;
  /** 見つかった箇所の前後。全文は載せない（そのまま読ませないため）。 */
  readonly excerpt: string;
};

/** 見つかった書き方を列挙する。**消さない。** */
export function detectInjection(text: string): readonly InjectionFinding[] {
  const findings: InjectionFinding[] = [];
  for (const p of INJECTION_PATTERNS) {
    const m = p.pattern.exec(text);
    if (!m) continue;
    const start = Math.max(0, m.index - 20);
    findings.push({
      patternId: p.id,
      whatItTries: p.whatItTries,
      excerpt: text.slice(start, m.index + m[0].length + 20),
    });
  }
  return findings;
}

export type MaterialReview = {
  readonly accepted: boolean;
  /** 受け付けなかったときの理由。画面にそのまま出す。 */
  readonly heldReason: string | null;
  readonly findings: readonly InjectionFinding[];
};

/**
 * 素材を生成へ渡してよいかを判定する。
 * 引っかかったら保留にして人の確認へ回す。自動では通さない。
 */
export function reviewMaterial(text: string): MaterialReview {
  const findings = detectInjection(text);
  if (findings.length === 0) {
    return { accepted: true, heldReason: null, findings };
  }
  return {
    accepted: false,
    heldReason: `取り込んだ文章に、指示として読ませようとする書き方が ${findings.length} 件あります。自動では消さず、担当者の確認へ回します。`,
    findings,
  };
}

/** 出力に現れた URL のうち、素材に無いもの。 */
export function unknownUrls(
  outputText: string,
  materialUrls: readonly string[],
): readonly string[] {
  const known = new Set(materialUrls);
  const found = outputText.match(/https?:\/\/[^\s"'<>）)]+/g) ?? [];
  return [...new Set(found.filter((u) => !known.has(u)))];
}

/** 形が合わないときにやり直してよい回数。これを超えたら失敗として残す。 */
export const MAX_SCHEMA_RETRIES = 3;

export type GenerationAttemptOutcome =
  | { readonly kind: "ok"; readonly attempts: number }
  | { readonly kind: "generation_failed"; readonly attempts: number; readonly reason: string };

/**
 * やり直しの打ち切り。
 *
 * 3 回失敗したら、**成功したことにしない**。
 * 未解決として記録し、人が見られる状態にする。
 */
export function concludeAttempts(attempts: number, lastError: string): GenerationAttemptOutcome {
  if (attempts <= MAX_SCHEMA_RETRIES) {
    return { kind: "ok", attempts };
  }
  return {
    kind: "generation_failed",
    attempts,
    reason: `決めた形で返ってこない状態が ${MAX_SCHEMA_RETRIES} 回続きました（最後の理由: ${lastError}）。`,
  };
}

/** 生成の処理に渡してよい権限。公開・送信・課金は持たせない。 */
export const GENERATION_ALLOWED_CAPABILITIES: readonly string[] = ["content.read", "product.read"];

export function generationMayHold(capability: string): boolean {
  return GENERATION_ALLOWED_CAPABILITIES.includes(capability);
}
