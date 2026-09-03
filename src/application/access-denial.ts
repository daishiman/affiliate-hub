import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { type AuditAction, createAuditLogEntry } from "@/domain/compliance";
import {
  type ActorContext,
  type AuditLogId,
  type DomainError,
  type DomainErrorCode,
  taggedString,
} from "@/domain/shared";
import { auditActorOf } from "./audit";
import type { UseCase } from "./usecases/usecase";

/**
 * **断りを記録する、ただ 1 つの場所。**
 *
 * --- なぜ 1 か所なのか ---
 * 入口は 4 つある（画面の Server Action / REST / WebMCP / バックエンド MCP）。
 * 断りの記録を入口ごとに書くと、**必ずどれか 1 つが漏れる**。
 * 実際に同じ形の漏れが起きている: 存在を隠す本文の同一化（`maskExistence`）は
 * REST と MCP には入ったが、画面の経路には入っていなかった。
 * 入口が 4 つあることは分かっていて、それでも 2 つで止まった。
 *
 * だから断りは入口では書かない。**4 つの入口が共通して通る 1 点**——
 * ユースケースの `execute` の外側——で書く。入口を 5 つ目に増やしても、
 * その入口がユースケースを呼ぶ限り記録は残る。
 *
 * --- 「記録が無いこと」は見えない ---
 * 断りは押した人には見えるが、**守る側には何も見えない**。
 * 行が無ければ、誰も試していないのか、試して止めたのかが後から言えない。
 * 前者と後者では次にすることが違う（役の付け直しか、侵入の調査か）。
 *
 * 規範: 確定済み auth 章 AWS-ACC-02 / AWS-ACC-04、
 *       docs/spec/feat-auth-workspace/requirements-baseline.md
 */
export type AccessAuditDeps = {
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now?: () => Date;
};

/**
 * 断りの種類 → 記録の語。
 *
 * **`NOT_FOUND` を入れていない。** 存在しない ID を叩く 404 は日常で
 * （消えた記事へのリンク、古い控えを開いた画面）、これを記録すると
 * 断りの一覧が 404 で埋まり、その中に紛れた越境の試行が読めなくなる。
 * 記録の値打ちは件数ではなく、**並べて読めること**にある。
 *
 * 外向きには `TENANT_MISMATCH` も `NOT_FOUND` に潰れる（`maskExistence`）。
 * 潰す前のここでしか 2 つは区別できない。**だから潰す手前で記録する。**
 */
const DENIAL_ACTION_OF: Partial<Readonly<Record<DomainErrorCode, AuditAction>>> = {
  FORBIDDEN: "access.denied",
  UNAUTHENTICATED: "access.denied",
  TENANT_MISMATCH: "access.cross_workspace_blocked",
};

/** その断りを記録するか。記録するなら語を返す。 */
export function denialActionOf(code: DomainErrorCode): AuditAction | null {
  return DENIAL_ACTION_OF[code] ?? null;
}

/**
 * 入力から、断られた対象の目印を拾う。
 *
 * 拾えないことがある（一覧の取得など、対象を指していない操作）。
 * そのときは `(指定なし)` を入れる。**空文字にしない**——
 * ドメイン側が空を断るので、行そのものが消える。
 * 目印が無いことと、記録できなかったことを同じ形にしない。
 */
function targetIdOf(input: unknown): string {
  if (typeof input !== "object" || input === null) return "(指定なし)";
  const record = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string" || value.trim() === "") continue;
    if (/id$|slug$/i.test(key)) return value;
  }
  return "(指定なし)";
}

/**
 * 断りを 1 行残す。
 *
 * **記録に失敗しても、断りは断りのまま返す。** 記録できないことを理由に
 * 操作を通すと、保存先を落とせば権限検査を外せることになる。
 * 逆に、記録できないことを理由に別の失敗へ差し替えもしない。
 * 押した人には「権限がありません」が届くのが正しく、
 * 保存先の不調はその人が直せるものではない。
 */
export async function recordAccessDenial(
  deps: AccessAuditDeps,
  actor: ActorContext,
  input: {
    readonly error: DomainError;
    /** 何をしようとしたか（ユースケースの名前）。 */
    readonly attempted: string;
    readonly targetType: string;
    readonly targetId: string;
  },
): Promise<void> {
  const action = denialActionOf(input.error.code);
  if (action === null) return;

  const entry = createAuditLogEntry({
    id: taggedString<"AuditLogId">(`al_${deps.ids.newId()}`) as AuditLogId,
    workspaceId: actor.workspaceId,
    action,
    actor: auditActorOf(actor),
    targetType: input.targetType,
    targetId: input.targetId,
    /*
     * 断られた事実を `after` に開いて書く。
     * 受け入れ条件が名指しで求めているのは actor / workspace / action / result の 4 つで、
     * 前の 2 つは行そのものが持っている。残る 2 つをここへ置く。
     *
     * `code` は**潰す前の**種類である。外へ出た本文（`対象が見つかりません。`）からは
     * もう読めない。読める場所をここ以外に作らない。
     */
    after: {
      result: "denied",
      code: input.error.code,
      attempted: input.attempted,
    },
    requestId: actor.requestId ?? `req_${deps.ids.newId()}`,
    occurredAt: (deps.now ?? (() => new Date()))(),
  });
  if (!entry.ok) return;
  await deps.auditLog.append(entry.value);
}

/**
 * ユースケースの束を、断りが記録される形に包む。
 *
 * **包む場所は組み立て境界にする。** 画面は `src/presentation/composition.ts`、
 * REST / WebMCP / MCP は `src/presentation/tools/catalog.ts` がその境界である。
 * 各ユースケースの中で書くと、100 か所ある権限検査のうち
 * どれか 1 つを新しく足した人が書き忘れる。書き忘れは緑のまま通る
 * （断りは正しく返っているので、既存のどの検査も赤にならない）。
 *
 * 包んでも返す値は変えない。**断りの本文も番号も 1 バイトも動かさない。**
 * ここが値を変えると、記録を足したことが利用者の見る文言を変えることになり、
 * 「記録を外せば直る」という直し方が生まれる。
 */
export function withAccessDenialAudit<Input, Output>(
  deps: AccessAuditDeps,
  attempted: string,
  useCase: UseCase<Input, Output>,
): UseCase<Input, Output> {
  return {
    async execute(actor, input) {
      const result = await useCase.execute(actor, input);
      if (!result.ok) {
        await recordAccessDenial(deps, actor, {
          error: result.error,
          attempted,
          targetType: attempted,
          targetId: targetIdOf(input),
        });
      }
      return result;
    },
  };
}

/** 名前つきのユースケース群を、上の単一プリミティブでまとめて包む。 */
export function auditDenials<T extends Record<string, UseCase<never, unknown>>>(
  deps: AccessAuditDeps,
  group: T,
): T {
  const wrapped: Record<string, UseCase<never, unknown>> = {};
  for (const [name, useCase] of Object.entries(group)) {
    wrapped[name] = withAccessDenialAudit(deps, name, useCase);
  }
  return wrapped as T;
}
