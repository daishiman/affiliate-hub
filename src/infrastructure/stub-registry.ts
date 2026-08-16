import { err, notImplemented } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";

/**
 * スタブ台帳。
 *
 * たたき台には未実装の差し込み口が多数ある。
 * 「空の関数を置いて動いているように見せる」ことを禁じるため、
 * 未実装の実装は必ずここへ登録し、呼ばれたら NOT_IMPLEMENTED で失敗する。
 *
 * 登録内容はカバレッジ報告の元データになる。
 * 数字を手で数えないので、実装が進めば報告も自動で正しくなる。
 *
 *   pnpm test  →  tests/infrastructure/stub-registry.test.ts が一覧を出力する
 */

export type StubEntry = {
  /** 一意の識別子。`asp:amazon` のようにコロン区切り。 */
  readonly id: string;
  /** どのポートの実装か。 */
  readonly port: string;
  /** 利用者向けの説明。画面に出しても意味が通る日本語で書く。 */
  readonly label: string;
  /** なぜまだ実装していないか。「時間がなかった」ではなく、前提条件を書く。 */
  readonly blockedBy: string;
};

const entries = new Map<string, StubEntry>();

/**
 * 登録は冪等。同じ識別子を同じ内容で何度呼んでも 1 件のままにする
 * (アダプタは接続ごとに組み立てられるため、同じ id が複数回登録される)。
 * 内容が食い違う場合だけ失敗させる。取り違えを見逃さないため。
 */
export function registerStub(entry: StubEntry): StubEntry {
  const existing = entries.get(entry.id);
  if (existing !== undefined) {
    if (existing.port !== entry.port || existing.label !== entry.label) {
      throw new Error(`同じ識別子で内容の違うスタブが登録されました: ${entry.id}`);
    }
    return existing;
  }
  entries.set(entry.id, entry);
  return entry;
}

export function listStubs(): readonly StubEntry[] {
  return [...entries.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function stubCount(): number {
  return entries.size;
}

/**
 * スタブのメソッドが返す失敗。
 *
 * `ok()` を返してはならない。空の成功は「実装済み」と区別がつかない。
 */
export function stubFailure(entry: StubEntry, method: string): DomainError {
  return {
    ...notImplemented(`${entry.label} の ${method}`),
    details: { stubId: entry.id, port: entry.port, blockedBy: entry.blockedBy },
  };
}

export async function stubCall<T>(
  entry: StubEntry,
  method: string,
): Promise<Result<T, DomainError>> {
  return err(stubFailure(entry, method));
}
